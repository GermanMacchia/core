-- +migrate Up
CREATE TABLE config_definitions (
    key         VARCHAR(100) NOT NULL,
    scope       VARCHAR(20)  NOT NULL CHECK (scope IN ('service', 'portal', 'tenant', 'plan')),
    type        VARCHAR(20)  NOT NULL CHECK (type  IN ('bool', 'string', 'string[]')),
    description TEXT,
    default_val TEXT,
    PRIMARY KEY (key, scope)
);

-- scope: service — keys válidas en services.config y portal_services.config_override
INSERT INTO config_definitions (key, scope, type, description, default_val) VALUES
    ('public',        'service', 'bool',     'Si true, el shell monta el MFE sin JWT',                                              'false'),
    ('auth_api_url',  'service', 'string',   'URL del auth API inyectada al MFE como authApiUrl',                                   NULL),
    ('allowed_roles', 'service', 'string[]', 'Roles que pueden montar este MFE. Si ausente, cualquier usuario autenticado accede',  NULL);

-- scope: portal — keys válidas en tenant_portals.config
INSERT INTO config_definitions (key, scope, type, description, default_val) VALUES
    ('auth_api_url', 'portal', 'string', 'Fallback de authApiUrl para servicios que no declaran el propio',                NULL),
    ('login_slug',   'portal', 'string', 'Slug del MFE de login. Si ausente, el portal es público (no se enforcea auth)',  NULL);

-- scope: tenant — keys válidas en tenants.config
INSERT INTO config_definitions (key, scope, type, description, default_val) VALUES
    ('logo_url',      'tenant', 'string', 'URL del logo del tenant mostrado en la barra del shell',  NULL),
    ('primary_color', 'tenant', 'string', 'Color primario de la UI del shell (ej: #3B82F6)',         NULL);

-- +migrate Down
DROP TABLE config_definitions;
