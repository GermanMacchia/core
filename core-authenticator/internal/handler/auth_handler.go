package handler

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/tu-org/core-authenticator/internal/service"
	"github.com/tu-org/core-authenticator/pkg/response"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		TenantID string `json:"tenant_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.BadRequest(w, "invalid request body")
		return
	}
	if body.Email == "" || body.Password == "" {
		response.BadRequest(w, "email and password are required")
		return
	}

	var tenantID *uuid.UUID
	if body.TenantID != "" {
		parsed, err := uuid.Parse(body.TenantID)
		if err != nil {
			response.BadRequest(w, "invalid tenant_id")
			return
		}
		tenantID = &parsed
	}

	result, err := h.auth.Login(r.Context(), service.LoginInput{
		TenantID:  tenantID,
		Email:     body.Email,
		Password:  body.Password,
		UserAgent: r.UserAgent(),
		IPAddress: remoteIP(r),
	})
	if err != nil {
		switch err {
		case service.ErrInvalidCredentials:
			response.Error(w, http.StatusUnauthorized, "invalid credentials")
		case service.ErrUserInactive:
			response.Error(w, http.StatusForbidden, "user is inactive")
		case service.ErrTenantSuspended:
			response.Error(w, http.StatusForbidden, "tenant is suspended or cancelled")
		default:
			response.InternalError(w)
		}
		return
	}

	response.JSON(w, http.StatusOK, result)
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RefreshToken == "" {
		response.BadRequest(w, "refresh_token is required")
		return
	}

	result, err := h.auth.Refresh(r.Context(), body.RefreshToken, r.UserAgent(), remoteIP(r))
	if err != nil {
		switch err {
		case service.ErrTokenExpired, service.ErrTokenRevoked:
			response.Error(w, http.StatusUnauthorized, err.Error())
		case service.ErrTenantSuspended:
			response.Error(w, http.StatusForbidden, "tenant is suspended or cancelled")
		default:
			response.InternalError(w)
		}
		return
	}

	response.JSON(w, http.StatusOK, result)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RefreshToken == "" {
		response.BadRequest(w, "refresh_token is required")
		return
	}

	if err := h.auth.Logout(r.Context(), body.RefreshToken); err != nil {
		response.InternalError(w)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

func remoteIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// Validate introspects a Bearer JWT and returns the decoded claims.
// Used by other microservices to verify tokens without needing the JWT secret.
func (h *AuthHandler) Validate(w http.ResponseWriter, r *http.Request) {
	header := r.Header.Get("Authorization")
	if header == "" || !strings.HasPrefix(header, "Bearer ") {
		response.Unauthorized(w)
		return
	}

	tokenStr := strings.TrimPrefix(header, "Bearer ")
	claims, err := h.auth.Validate(tokenStr)
	if err != nil {
		response.Error(w, http.StatusUnauthorized, "invalid or expired token")
		return
	}

	body := map[string]any{
		"sub":       claims.Subject,
		"tenant_id": claims.TenantID,
		"role":      claims.Role,
		"services":  claims.Services,
		"exp":       claims.ExpiresAt.Time.Unix(),
	}

	// Additive fresh-grant resolution: opt-in via X-Service-ID so existing
	// callers that don't know about it yet are completely unaffected. Any
	// failure to resolve (missing/invalid header, no grant, ambiguous
	// business) silently leaves these fields out of the response — it never
	// turns into a request failure, and never distinguishes "no header" from
	// "no grant" to the caller.
	if serviceID, err := uuid.Parse(r.Header.Get("X-Service-ID")); err == nil {
		if userID, err := uuid.Parse(claims.Subject); err == nil {
			var businessID *uuid.UUID
			raw := r.Header.Get("X-Business-ID")
			if raw == "" {
				// Deprecated: legacy header name, read only as a fallback. Remove once
				// all consumers send X-Business-ID.
				raw = r.Header.Get("X-Service-Instance-ID")
			}
			if raw != "" {
				if parsed, err := uuid.Parse(raw); err == nil {
					businessID = &parsed
				}
			}
			if access, err := h.auth.ResolveServiceAccess(r.Context(), userID, serviceID, businessID); err == nil && access != nil {
				body["business_id"] = access.BusinessID.String()
				// Deprecated: legacy key carrying the same value as business_id. Remove
				// once all consumers read business_id.
				body["service_instance_id"] = access.BusinessID.String()
				body["resolved_role"] = access.Role
			}
		}
	}

	response.JSON(w, http.StatusOK, body)
}
