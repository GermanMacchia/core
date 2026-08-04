package jwt

import (
	"errors"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	jwt.RegisteredClaims
	TenantID string   `json:"tenant_id"`
	PortalID string   `json:"portal_id,omitempty"`
	Role     string   `json:"role"`
	Services []string `json:"services"`
}

type Manager struct {
	secret []byte
}

func NewManager(secret string) *Manager {
	return &Manager{secret: []byte(secret)}
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
