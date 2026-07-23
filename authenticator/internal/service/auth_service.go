package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/tu-org/authenticator/internal/config"
	"github.com/tu-org/authenticator/internal/domain"
	"github.com/tu-org/authenticator/internal/repository"
	pkgjwt "github.com/tu-org/authenticator/pkg/jwt"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserInactive       = errors.New("user is inactive")
	ErrTenantSuspended    = errors.New("tenant is suspended or cancelled")
	ErrTokenExpired       = errors.New("token expired")
	ErrTokenRevoked       = errors.New("token revoked")
)

type AuthService struct {
	repo       *repository.AuthRepo
	audit      *repository.AuditRepo
	jwtManager *pkgjwt.Manager
	cfg        config.JWTConfig
}

func NewAuthService(repo *repository.AuthRepo, audit *repository.AuditRepo, jwtManager *pkgjwt.Manager, cfg config.JWTConfig) *AuthService {
	return &AuthService{repo: repo, audit: audit, jwtManager: jwtManager, cfg: cfg}
}

type LoginInput struct {
	TenantID  *uuid.UUID
	Email     string
	Password  string
	UserAgent string
	IPAddress string
}

type AuthResult struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	ExpiresAt    time.Time    `json:"expires_at"`
	User         *domain.User `json:"user"`
}

func (s *AuthService) Login(ctx context.Context, input LoginInput) (*AuthResult, error) {
	var (
		user *domain.User
		err  error
	)

	if input.TenantID != nil {
		user, err = s.repo.GetByEmail(ctx, *input.TenantID, input.Email)
	} else {
		user, err = s.repo.GetByEmailGlobal(ctx, input.Email)
	}
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if !user.IsActive {
		return nil, ErrUserInactive
	}

	tenantStatus, err := s.repo.GetTenantStatus(ctx, user.TenantID)
	if err != nil || tenantStatus == "suspended" || tenantStatus == "cancelled" {
		return nil, ErrTenantSuspended
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// El claim services refleja la suscripción del tenant para todos los
	// roles, superadmin incluido: los servicios validan contra este claim.
	services, _ := s.repo.GetTenantServiceIDs(ctx, user.TenantID)

	expAt := time.Now().Add(s.cfg.AccessTokenDuration())
	accessToken, err := s.jwtManager.GenerateAccess(
		user.ID, user.TenantID, user.PortalID, user.Email, string(user.Role), services, s.cfg.AccessTokenDuration(),
	)
	if err != nil {
		return nil, err
	}

	rawRefresh, err := generateSecureToken()
	if err != nil {
		return nil, err
	}

	rt := domain.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: hashToken(rawRefresh),
		ExpiresAt: time.Now().Add(s.cfg.RefreshTokenDuration()),
		UserAgent: input.UserAgent,
		IPAddress: input.IPAddress,
	}
	if err := s.repo.SaveRefreshToken(ctx, rt); err != nil {
		return nil, err
	}

	_ = s.repo.UpdateLastLogin(ctx, user.ID)

	if s.audit != nil {
		go s.audit.Log(context.Background(), repository.AuditEntry{
			TenantID:  &user.TenantID,
			UserID:    &user.ID,
			Action:    "auth.login",
			IPAddress: input.IPAddress,
		})
	}

	return &AuthResult{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		ExpiresAt:    expAt,
		User:         user,
	}, nil
}

func (s *AuthService) Refresh(ctx context.Context, rawToken, userAgent, ip string) (*AuthResult, error) {
	tokenHash := hashToken(rawToken)
	rt, err := s.repo.GetRefreshToken(ctx, tokenHash)
	if err != nil {
		return nil, ErrTokenRevoked
	}

	if rt.RevokedAt != nil {
		return nil, ErrTokenRevoked
	}
	if time.Now().After(rt.ExpiresAt) {
		return nil, ErrTokenExpired
	}

	user, err := s.repo.GetByID(ctx, rt.UserID)
	if err != nil {
		return nil, err
	}

	tenantStatus, err := s.repo.GetTenantStatus(ctx, user.TenantID)
	if err != nil || tenantStatus == "suspended" || tenantStatus == "cancelled" {
		return nil, ErrTenantSuspended
	}

	if err := s.repo.RevokeRefreshToken(ctx, tokenHash); err != nil {
		return nil, err
	}

	services, _ := s.repo.GetTenantServiceIDs(ctx, user.TenantID)

	expAt := time.Now().Add(s.cfg.AccessTokenDuration())
	accessToken, err := s.jwtManager.GenerateAccess(
		user.ID, user.TenantID, user.PortalID, user.Email, string(user.Role), services, s.cfg.AccessTokenDuration(),
	)
	if err != nil {
		return nil, err
	}

	rawRefresh, err := generateSecureToken()
	if err != nil {
		return nil, err
	}

	newRT := domain.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: hashToken(rawRefresh),
		ExpiresAt: time.Now().Add(s.cfg.RefreshTokenDuration()),
		UserAgent: userAgent,
		IPAddress: ip,
	}
	if err := s.repo.SaveRefreshToken(ctx, newRT); err != nil {
		return nil, err
	}

	return &AuthResult{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		ExpiresAt:    expAt,
		User:         user,
	}, nil
}

func (s *AuthService) Logout(ctx context.Context, rawToken string) error {
	hash := hashToken(rawToken)
	rt, err := s.repo.GetRefreshToken(ctx, hash)
	if err != nil {
		// Token not found or already revoked — treat as success.
		return nil
	}
	if err := s.repo.RevokeRefreshToken(ctx, hash); err != nil {
		return err
	}
	if s.audit != nil {
		entry := repository.AuditEntry{
			UserID:    &rt.UserID,
			Action:    "auth.logout",
			IPAddress: rt.IPAddress,
		}
		if user, err := s.repo.GetByID(ctx, rt.UserID); err == nil {
			entry.TenantID = &user.TenantID
		}
		go s.audit.Log(context.Background(), entry)
	}
	return nil
}

// Validate parses and validates a JWT, returning its claims.
func (s *AuthService) Validate(tokenStr string) (*pkgjwt.Claims, error) {
	return s.jwtManager.Parse(tokenStr)
}

func generateSecureToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
