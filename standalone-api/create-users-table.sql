-- =============================================================================
-- CREATE USERS TABLE
-- =============================================================================
-- Table pour stocker les utilisateurs Molam ID
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiants
  phone TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,

  -- Informations personnelles
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,

  -- Statut du compte
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_deleted BOOLEAN DEFAULT FALSE,

  -- Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ,

  -- Index de recherche
  CONSTRAINT users_phone_check CHECK (phone ~ '^\+[1-9][0-9]{1,14}$'),
  CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active, is_deleted);

-- Trigger pour mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Commentaires
COMMENT ON TABLE users IS 'Table principale des utilisateurs Molam ID';
COMMENT ON COLUMN users.phone IS 'Numéro de téléphone au format E.164 (+221...)';
COMMENT ON COLUMN users.email IS 'Adresse email unique de l''utilisateur';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt du mot de passe';
COMMENT ON COLUMN users.first_name IS 'Prénom de l''utilisateur';
COMMENT ON COLUMN users.last_name IS 'Nom de famille de l''utilisateur';
