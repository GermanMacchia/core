-- +goose Up
CREATE TABLE roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

INSERT INTO roles (id, name, description) VALUES
    ('00000000-0000-0000-0000-000000000101', 'superadmin', 'Acceso total a la plataforma'),
    ('00000000-0000-0000-0000-000000000102', 'admin',      'Administrador del tenant'),
    ('00000000-0000-0000-0000-000000000103', 'member',     'Miembro del tenant'),
    ('00000000-0000-0000-0000-000000000104', 'viewer',     'Acceso de solo lectura');

ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles(id);
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = users.role::text);
ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
ALTER TABLE users DROP COLUMN role;

-- +goose Down
ALTER TABLE users ADD COLUMN role VARCHAR(50);
UPDATE users u SET role = r.name FROM roles r WHERE r.id = u.role_id;
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users DROP COLUMN role_id;
DROP TABLE roles;
