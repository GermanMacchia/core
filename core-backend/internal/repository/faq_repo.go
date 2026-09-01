package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tu-org/core-backend/internal/domain"
)

var _ domain.FaqRepository = (*FaqRepo)(nil)

type FaqRepo struct {
	db *pgxpool.Pool
}

func NewFaqRepo(db *pgxpool.Pool) *FaqRepo {
	return &FaqRepo{db: db}
}

func (r *FaqRepo) scanFaqs(ctx context.Context, rows pgx.Rows) ([]*domain.Faq, error) {
	var faqs []*domain.Faq
	for rows.Next() {
		var f domain.Faq
		if err := rows.Scan(&f.ID, &f.Question, &f.Answer, &f.SortOrder, &f.IsActive, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		faqs = append(faqs, &f)
	}
	return faqs, nil
}

func (r *FaqRepo) List(ctx context.Context, onlyActive bool) ([]*domain.Faq, error) {
	q := `SELECT id, question, answer, sort_order, is_active, created_at, updated_at FROM faqs`
	if onlyActive {
		q += ` WHERE is_active = TRUE`
	}
	q += ` ORDER BY sort_order`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("list faqs: %w", err)
	}
	defer rows.Close()

	faqs, err := r.scanFaqs(ctx, rows)
	if err != nil {
		return nil, err
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := r.hydrateServiceIDs(ctx, faqs); err != nil {
		return nil, err
	}
	if err := r.hydratePortalIDs(ctx, faqs); err != nil {
		return nil, err
	}
	return faqs, nil
}

// ListVisibleForTenant returns active FAQs visible to a tenant: FAQs with no
// assignments at all (visible to everyone), FAQs assigned to any service
// (visible tenant-wide), or FAQs assigned to one of the tenant's own portals.
func (r *FaqRepo) ListVisibleForTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.Faq, error) {
	rows, err := r.db.Query(ctx, `
		SELECT f.id, f.question, f.answer, f.sort_order, f.is_active, f.created_at, f.updated_at
		FROM faqs f
		WHERE f.is_active = TRUE
		  AND (
		    (NOT EXISTS (SELECT 1 FROM faq_services fs WHERE fs.faq_id = f.id)
		     AND NOT EXISTS (SELECT 1 FROM faq_portals fp WHERE fp.faq_id = f.id))
		    OR EXISTS (SELECT 1 FROM faq_services fs WHERE fs.faq_id = f.id)
		    OR EXISTS (
		         SELECT 1 FROM faq_portals fp
		         JOIN tenant_portals tp ON tp.id = fp.portal_id
		         WHERE fp.faq_id = f.id AND tp.tenant_id = $1
		       )
		  )
		ORDER BY f.sort_order
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list visible faqs: %w", err)
	}
	defer rows.Close()

	faqs, err := r.scanFaqs(ctx, rows)
	if err != nil {
		return nil, err
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := r.hydrateServiceIDs(ctx, faqs); err != nil {
		return nil, err
	}
	// Scrub portal_ids down to the caller's own tenant, even for FAQs made
	// globally visible via a service assignment — never leak another
	// tenant's portal UUIDs through this endpoint.
	if err := r.hydratePortalIDsForTenant(ctx, faqs, tenantID); err != nil {
		return nil, err
	}
	return faqs, nil
}

func (r *FaqRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Faq, error) {
	var f domain.Faq
	err := r.db.QueryRow(ctx, `
		SELECT id, question, answer, sort_order, is_active, created_at, updated_at
		FROM faqs WHERE id = $1
	`, id).Scan(&f.ID, &f.Question, &f.Answer, &f.SortOrder, &f.IsActive, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get faq by id: %w", err)
	}

	faqs := []*domain.Faq{&f}
	if err := r.hydrateServiceIDs(ctx, faqs); err != nil {
		return nil, err
	}
	if err := r.hydratePortalIDs(ctx, faqs); err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *FaqRepo) Create(ctx context.Context, input domain.CreateFaqInput) (*domain.Faq, error) {
	var f domain.Faq
	err := r.db.QueryRow(ctx, `
		INSERT INTO faqs (question, answer, sort_order)
		VALUES ($1, $2, $3)
		RETURNING id, question, answer, sort_order, is_active, created_at, updated_at
	`, input.Question, input.Answer, input.SortOrder).
		Scan(&f.ID, &f.Question, &f.Answer, &f.SortOrder, &f.IsActive, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create faq: %w", err)
	}
	f.ServiceIDs = []uuid.UUID{}
	f.PortalIDs = []uuid.UUID{}
	return &f, nil
}

func (r *FaqRepo) Update(ctx context.Context, id uuid.UUID, input domain.UpdateFaqInput) (*domain.Faq, error) {
	var f domain.Faq
	err := r.db.QueryRow(ctx, `
		UPDATE faqs SET
			question   = COALESCE($2, question),
			answer     = COALESCE($3, answer),
			sort_order = COALESCE($4, sort_order),
			is_active  = COALESCE($5, is_active),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, question, answer, sort_order, is_active, created_at, updated_at
	`, id, input.Question, input.Answer, input.SortOrder, input.IsActive).
		Scan(&f.ID, &f.Question, &f.Answer, &f.SortOrder, &f.IsActive, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update faq: %w", err)
	}

	faqs := []*domain.Faq{&f}
	if err := r.hydrateServiceIDs(ctx, faqs); err != nil {
		return nil, err
	}
	if err := r.hydratePortalIDs(ctx, faqs); err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *FaqRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE faqs SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *FaqRepo) AssignService(ctx context.Context, faqID, serviceID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO faq_services (faq_id, service_id) VALUES ($1, $2)
		ON CONFLICT (faq_id, service_id) DO NOTHING
	`, faqID, serviceID)
	return err
}

func (r *FaqRepo) UnassignService(ctx context.Context, faqID, serviceID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM faq_services WHERE faq_id = $1 AND service_id = $2`, faqID, serviceID)
	return err
}

func (r *FaqRepo) AssignPortal(ctx context.Context, faqID, portalID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO faq_portals (faq_id, portal_id) VALUES ($1, $2)
		ON CONFLICT (faq_id, portal_id) DO NOTHING
	`, faqID, portalID)
	return err
}

func (r *FaqRepo) UnassignPortal(ctx context.Context, faqID, portalID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM faq_portals WHERE faq_id = $1 AND portal_id = $2`, faqID, portalID)
	return err
}

func (r *FaqRepo) hydrateServiceIDs(ctx context.Context, faqs []*domain.Faq) error {
	if len(faqs) == 0 {
		return nil
	}
	ids := faqIDs(faqs)
	rows, err := r.db.Query(ctx, `SELECT faq_id, service_id FROM faq_services WHERE faq_id = ANY($1)`, ids)
	if err != nil {
		return fmt.Errorf("hydrate faq services: %w", err)
	}
	defer rows.Close()

	byFaq := map[uuid.UUID][]uuid.UUID{}
	for rows.Next() {
		var faqID, serviceID uuid.UUID
		if err := rows.Scan(&faqID, &serviceID); err != nil {
			return err
		}
		byFaq[faqID] = append(byFaq[faqID], serviceID)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, f := range faqs {
		f.ServiceIDs = byFaq[f.ID]
		if f.ServiceIDs == nil {
			f.ServiceIDs = []uuid.UUID{}
		}
	}
	return nil
}

func (r *FaqRepo) hydratePortalIDs(ctx context.Context, faqs []*domain.Faq) error {
	if len(faqs) == 0 {
		return nil
	}
	ids := faqIDs(faqs)
	rows, err := r.db.Query(ctx, `SELECT faq_id, portal_id FROM faq_portals WHERE faq_id = ANY($1)`, ids)
	if err != nil {
		return fmt.Errorf("hydrate faq portals: %w", err)
	}
	defer rows.Close()

	byFaq := map[uuid.UUID][]uuid.UUID{}
	for rows.Next() {
		var faqID, portalID uuid.UUID
		if err := rows.Scan(&faqID, &portalID); err != nil {
			return err
		}
		byFaq[faqID] = append(byFaq[faqID], portalID)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, f := range faqs {
		f.PortalIDs = byFaq[f.ID]
		if f.PortalIDs == nil {
			f.PortalIDs = []uuid.UUID{}
		}
	}
	return nil
}

func (r *FaqRepo) hydratePortalIDsForTenant(ctx context.Context, faqs []*domain.Faq, tenantID uuid.UUID) error {
	if len(faqs) == 0 {
		return nil
	}
	ids := faqIDs(faqs)
	rows, err := r.db.Query(ctx, `
		SELECT fp.faq_id, fp.portal_id
		FROM faq_portals fp
		JOIN tenant_portals tp ON tp.id = fp.portal_id
		WHERE fp.faq_id = ANY($1) AND tp.tenant_id = $2
	`, ids, tenantID)
	if err != nil {
		return fmt.Errorf("hydrate tenant faq portals: %w", err)
	}
	defer rows.Close()

	byFaq := map[uuid.UUID][]uuid.UUID{}
	for rows.Next() {
		var faqID, portalID uuid.UUID
		if err := rows.Scan(&faqID, &portalID); err != nil {
			return err
		}
		byFaq[faqID] = append(byFaq[faqID], portalID)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, f := range faqs {
		f.PortalIDs = byFaq[f.ID]
		if f.PortalIDs == nil {
			f.PortalIDs = []uuid.UUID{}
		}
	}
	return nil
}

func faqIDs(faqs []*domain.Faq) []uuid.UUID {
	ids := make([]uuid.UUID, len(faqs))
	for i, f := range faqs {
		ids[i] = f.ID
	}
	return ids
}
