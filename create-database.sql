-- ============================================================================
-- MOLAM-ID - Script complet de création de la base de données
-- ============================================================================
-- Ce script crée la base de données 'molam' et toutes les tables nécessaires
-- pour l'ensemble des briques du système Molam-ID
--
-- Usage:
--   psql -U postgres -f create-database.sql
--
-- Ou via le script batch:
--   .\create-database.bat
-- ============================================================================

-- ============================================================================
-- 1. CRÉATION DE LA BASE DE DONNÉES
-- ============================================================================

-- Déconnexion de tous les utilisateurs connectés (si besoin)
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'molam'
  AND pid <> pg_backend_pid();

-- Suppression de la base si elle existe (ATTENTION: perte de données!)
DROP DATABASE IF EXISTS molam;

-- Création de l'utilisateur molam s'il n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'molam') THEN
    CREATE USER molam WITH PASSWORD 'molam_pass';
  END IF;
END
$$;

-- Création de la base de données
CREATE DATABASE molam
  WITH OWNER = molam
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8'
  TEMPLATE = template0;

-- Connexion à la base molam (nécessaire pour exécuter le reste)
\c molam

-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Donner les privilèges à l'utilisateur molam
GRANT ALL PRIVILEGES ON DATABASE molam TO molam;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO molam;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO molam;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO molam;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO molam;

-- ============================================================================
-- 2. MESSAGE DE CONFIRMATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Base de données "molam" créée avec succès!';
  RAISE NOTICE '   Utilisateur: molam';
  RAISE NOTICE '   Encodage: UTF8';
  RAISE NOTICE '   Extensions: uuid-ossp, pgcrypto';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Prochaine étape: Exécutez "npm run db:init" pour créer les tables';
END $$;
