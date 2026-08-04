package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditRepo struct {
	db *pgxpool.Pool
}

func NewAuditRepo(db *pgxpool.Pool) *AuditRepo {
	return &AuditRepo{db: db}
}

type AuditEntry struct {
	TenantID  *uuid.UUID
	UserID    *uuid.UUID
	Action    string
	IPAddress string
}

// Log writes an audit entry fire-and-forget; auth ops are never blocked by audit failures.
func (r *AuditRepo) Log(ctx context.Context, e AuditEntry) {
	_, _ = r.db.Exec(ctx, `
		INSERT INTO audit_logs (tenant_id, user_id, action, ip_address)
		VALUES ($1, $2, $3, NULLIF($4, '')::inet)
	`, e.TenantID, e.UserID, e.Action, e.IPAddress)
}
