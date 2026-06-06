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
	ErrTokenExpired       = errors.New("token expired")
	ErrTokenRevoked       = errors.New("token revoked")
)

type AuthService struct {
	repo       *repository.AuthRepo
	jwtManager *pkgjwt.Manager
	cfg        config.JWTConfig
}

func NewAuthService(repo *repository.AuthRepo, jwtManager *pkgjwt.Manager, cfg config.JWTConfig) *AuthService {
	return &AuthService{repo: repo, jwtManager: jwtManager, cfg: cfg}
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

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	expAt := time.Now().Add(s.cfg.AccessTokenDuration())
	accessToken, err := s.jwtManager.GenerateAccess(
		user.ID, user.TenantID, user.TenantSlug, string(user.Role), nil, s.cfg.AccessTokenDuration(),
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

	if err := s.repo.RevokeRefreshToken(ctx, tokenHash); err != nil {
		return nil, err
	}

	expAt := time.Now().Add(s.cfg.AccessTokenDuration())
	accessToken, err := s.jwtManager.GenerateAccess(
		user.ID, user.TenantID, user.TenantSlug, string(user.Role), nil, s.cfg.AccessTokenDuration(),
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
	return s.repo.RevokeRefreshToken(ctx, hashToken(rawToken))
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
