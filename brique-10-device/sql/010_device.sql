-- 010_device.sql
-- Brique 10: Device Fingerprint & Session Binding

CREATE TYPE device_platform AS ENUM ('web','android','ios','feature');
CREATE TYPE device_trust AS ENUM ('unknown','low','medium','high','blocked');

-- Table des appareils (empreintes hachées)
CREATE TABLE IF NOT EXISTS molam_devices (
  device_pk UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint_sha256 BYTEA NOT NULL,
  platform device_platform NOT NULL,
  model TEXT,
  os_name TEXT,
  os_version TEXT,
  integrity_vendor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (device_fingerprint_sha256, platform)
);

-- Liaison utilisateur ↔ appareil
CREATE TABLE IF NOT EXISTS molam_device_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES molam_users(id) ON DELETE CASCADE,
  device_pk UUID NOT NULL REFERENCES molam_devices(device_pk) ON DELETE CASCADE,
  binding_status TEXT NOT NULL DEFAULT 'active',
  trust device_trust NOT NULL DEFAULT 'unknown',
  first_bound_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  seen_ip INET,
  seen_asn INT,
  via_channel TEXT,
  CONSTRAINT uniq_active_binding UNIQUE (user_id, device_pk, binding_status)
);

-- Attestations / preuves d'intégrité
CREATE TABLE IF NOT EXISTS molam_device_attestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_pk UUID NOT NULL REFERENCES molam_devices(device_pk) ON DELETE CASCADE,
  user_id UUID,
  vendor TEXT NOT NULL,
  verdict TEXT NOT NULL,
  score SMALLINT NOT NULL,
  payload_jws TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Événements audit immuable
CREATE TABLE IF NOT EXISTS molam_device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  device_pk UUID,
  event_type TEXT,
  detail JSONB,
  ip INET,
  asn INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_dev_bind_user ON molam_device_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_dev_bind_device ON molam_device_bindings(device_pk);
CREATE INDEX IF NOT EXISTS idx_dev_attest_device ON molam_device_attestations(device_pk);
CREATE INDEX IF NOT EXISTS idx_dev_events_user ON molam_device_events(user_id);
CREATE INDEX IF NOT EXISTS idx_dev_events_device ON molam_device_events(device_pk);
CREATE INDEX IF NOT EXISTS idx_dev_events_type ON molam_device_events(event_type);
