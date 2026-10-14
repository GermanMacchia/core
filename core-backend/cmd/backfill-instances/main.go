// Command backfill-instances is a one-off migration helper for
// migrations/026 (see migrations/023_add_is_internal_to_services.sql through
// 025_create_service_instances.sql). It must be run once, after 023-025 are
// applied and before 027_add_tenant_service_id_to_portal_services.sql runs
// (027's backfill UPDATE reads the tenant_services rows this command writes).
//
// It derives tenant_services rows from today's only adhesion signal
// (portal_services JOIN tenant_portals), then creates exactly one
// service_instances row per resulting tenant_services row (today's reality is
// strictly 1:1 tenant<->business). It is safe to re-run: every write is
// idempotent (ON CONFLICT DO NOTHING / existence checks).
//
// Usage: go run ./cmd/backfill-instances
package main

import (
	"context"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/tu-org/core-backend/internal/config"
	"github.com/tu-org/core-backend/internal/db"
	"github.com/tu-org/core-backend/internal/slugutil"
)

type tenantServicePair struct {
	tenantID  uuid.UUID
	serviceID uuid.UUID
	isEnabled bool
}

type pendingInstance struct {
	tenantServiceID uuid.UUID
	serviceID       uuid.UUID
	tenantName      string
}

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("load config", zap.Error(err))
	}

	ctx := context.Background()

	pool, err := db.NewPool(ctx, cfg.DB)
	if err != nil {
		logger.Fatal("connect db", zap.Error(err))
	}
	defer pool.Close()

	tx, err := pool.Begin(ctx)
	if err != nil {
		logger.Fatal("begin tx", zap.Error(err))
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	// Step 1: derive (tenant_id, service_id) adhesion pairs from the current
	// live delivery signal — a service is "adhered to" today if it is
	// attached to at least one of the tenant's portals.
	rows, err := tx.Query(ctx, `
		SELECT p.tenant_id, ps.service_id, bool_or(ps.is_enabled) AS is_enabled
		FROM portal_services ps
		JOIN tenant_portals p ON p.id = ps.portal_id
		GROUP BY p.tenant_id, ps.service_id
	`)
	if err != nil {
		logger.Fatal("query portal_services adhesion signal", zap.Error(err))
	}

	var pairs []tenantServicePair
	for rows.Next() {
		var p tenantServicePair
		if err := rows.Scan(&p.tenantID, &p.serviceID, &p.isEnabled); err != nil {
			rows.Close()
			logger.Fatal("scan adhesion pair", zap.Error(err))
		}
		pairs = append(pairs, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		logger.Fatal("iterate adhesion pairs", zap.Error(err))
	}

	tenantServiceCount := 0
	for _, p := range pairs {
		tag, err := tx.Exec(ctx, `
			INSERT INTO tenant_services (tenant_id, service_id, is_enabled)
			VALUES ($1, $2, $3)
			ON CONFLICT (tenant_id, service_id) DO NOTHING
		`, p.tenantID, p.serviceID, p.isEnabled)
		if err != nil {
			logger.Fatal("insert tenant_services",
				zap.Stringer("tenant_id", p.tenantID),
				zap.Stringer("service_id", p.serviceID),
				zap.Error(err))
		}
		tenantServiceCount += int(tag.RowsAffected())
	}

	// Step 2: one service_instances row per tenant_services row that doesn't
	// have one yet, named/slugged after the tenant (today's reality: tenant
	// IS the business, 1:1).
	instRows, err := tx.Query(ctx, `
		SELECT ts.id, ts.service_id, t.name
		FROM tenant_services ts
		JOIN tenants t ON t.id = ts.tenant_id
		LEFT JOIN service_instances si ON si.tenant_service_id = ts.id
		WHERE si.id IS NULL
	`)
	if err != nil {
		logger.Fatal("query tenant_services missing instances", zap.Error(err))
	}

	var pending []pendingInstance
	for instRows.Next() {
		var p pendingInstance
		if err := instRows.Scan(&p.tenantServiceID, &p.serviceID, &p.tenantName); err != nil {
			instRows.Close()
			logger.Fatal("scan pending instance", zap.Error(err))
		}
		pending = append(pending, p)
	}
	instRows.Close()
	if err := instRows.Err(); err != nil {
		logger.Fatal("iterate pending instances", zap.Error(err))
	}

	instanceCount := 0
	for _, p := range pending {
		base := slugutil.Slugify(p.tenantName)
		if base == "" {
			// Degenerate tenant name (e.g. all punctuation/diacritics-only):
			// fall back to a stable, still-unique-enough identifier instead
			// of writing an empty slug.
			base = "tenant-" + p.tenantServiceID.String()[:8]
		}

		// Slugs are unique per service (migrations/035): two tenants with the
		// same name adhering to the same service get -2, -3, ...
		slug, err := slugutil.Unique(base, func(candidate string) (bool, error) {
			var exists bool
			err := tx.QueryRow(ctx, `
				SELECT EXISTS (SELECT 1 FROM service_instances WHERE service_id = $1 AND slug = $2)
			`, p.serviceID, candidate).Scan(&exists)
			return exists, err
		})
		if err != nil {
			logger.Fatal("resolve unique instance slug",
				zap.Stringer("tenant_service_id", p.tenantServiceID),
				zap.Error(err))
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO service_instances (tenant_service_id, service_id, name, slug)
			VALUES ($1, $2, $3, $4)
		`, p.tenantServiceID, p.serviceID, p.tenantName, slug); err != nil {
			logger.Fatal("insert service_instances",
				zap.Stringer("tenant_service_id", p.tenantServiceID),
				zap.Error(err))
		}
		instanceCount++
	}

	if err := tx.Commit(ctx); err != nil {
		logger.Fatal("commit tx", zap.Error(err))
	}

	logger.Info("backfill-instances complete",
		zap.Int("tenant_services_inserted", tenantServiceCount),
		zap.Int("service_instances_inserted", instanceCount),
	)
}
