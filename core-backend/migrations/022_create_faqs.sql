-- +goose Up
CREATE TABLE faqs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faq_services (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_id     UUID NOT NULL REFERENCES faqs(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(faq_id, service_id)
);

CREATE INDEX idx_faq_services_faq     ON faq_services(faq_id);
CREATE INDEX idx_faq_services_service ON faq_services(service_id);

CREATE TABLE faq_portals (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faq_id    UUID NOT NULL REFERENCES faqs(id) ON DELETE CASCADE,
  portal_id UUID NOT NULL REFERENCES tenant_portals(id) ON DELETE CASCADE,
  UNIQUE(faq_id, portal_id)
);

CREATE INDEX idx_faq_portals_faq    ON faq_portals(faq_id);
CREATE INDEX idx_faq_portals_portal ON faq_portals(portal_id);

-- +goose Down
DROP TABLE faq_portals;
DROP TABLE faq_services;
DROP TABLE faqs;
