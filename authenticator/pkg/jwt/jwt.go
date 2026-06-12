package jwt

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	jwt.RegisteredClaims
	TenantID string   `json:"tenant_id"`
	PortalID string   `json:"portal_id,omitempty"`
	Email    string   `json:"email"`
	Role     string   `json:"role"`
	Services []string `json:"services"`
}

type Manager struct {
	secret []byte
}

func NewManager(secret string) *Manager {
	return &Manager{secret: []byte(secret)}
}

func (m *Manager) GenerateAccess(
	userID, tenantID uuid.UUID,
	portalID *uuid.UUID,
	email, role string,
	services []string,
	ttl time.Duration,
) (string, error) {
	now := time.Now()
	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
			ID:        uuid.New().String(),
		},
		TenantID: tenantID.String(),
		Email:    email,
		Role:     role,
		Services: services,
	}
	if portalID != nil {
		claims.PortalID = portalID.String()
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *Manager) Parse(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (m *Manager) GetJTI(tokenStr string) (string, error) {
	claims, err := m.Parse(tokenStr)
	if err != nil {
		return "", err
	}
	return claims.ID, nil
}
