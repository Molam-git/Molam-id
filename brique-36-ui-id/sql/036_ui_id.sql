-- =============================================================================
-- Brique 36 — UI de gestion ID (Documents légaux versionnés)
-- =============================================================================
-- Legal documents versioned for multi-language support
-- =============================================================================

-- Legal docs table
CREATE TABLE IF NOT EXISTS molam_legal_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('cgu','privacy','legal','cookies','data_protection')),
  lang TEXT NOT NULL CHECK (lang IN ('fr','en','wo','ar','es','pt')),
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  html_content TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_by UUID,
  UNIQUE (type, lang, version)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_legal_docs_type_lang ON molam_legal_docs(type, lang);
CREATE INDEX IF NOT EXISTS idx_legal_docs_published ON molam_legal_docs(published_at DESC);

-- Insert default French documents
INSERT INTO molam_legal_docs (type, lang, version, content, html_content) VALUES
(
  'cgu',
  'fr',
  1,
  'Conditions Générales d''Utilisation - Molam ID

Version 1.0 - Effective Date: January 1, 2025

1. Acceptance of Terms
By accessing and using Molam ID services, you accept and agree to be bound by these Terms and Conditions.

2. Service Description
Molam ID provides identity and authentication services for the Molam ecosystem (Pay, Eats, Shop, Talk, Ads, Free).

3. User Account
- You must provide accurate information
- You are responsible for maintaining account security
- You must be at least 13 years old to create an account

4. Privacy
Your use of Molam ID is also governed by our Privacy Policy.

5. Termination
We may terminate or suspend access immediately, without prior notice, for breach of these Terms.

Contact: support@molam.com',
  '<h1>Conditions Générales d''Utilisation - Molam ID</h1>
   <p><strong>Version 1.0 - Date effective: 1er janvier 2025</strong></p>
   <h2>1. Acceptation des conditions</h2>
   <p>En accédant et en utilisant les services Molam ID, vous acceptez et vous vous engagez à être lié par ces Conditions Générales.</p>
   <h2>2. Description du service</h2>
   <p>Molam ID fournit des services d''identité et d''authentification pour l''écosystème Molam (Pay, Eats, Shop, Talk, Ads, Free).</p>
   <h2>3. Compte utilisateur</h2>
   <ul>
     <li>Vous devez fournir des informations exactes</li>
     <li>Vous êtes responsable du maintien de la sécurité de votre compte</li>
     <li>Vous devez avoir au moins 13 ans pour créer un compte</li>
   </ul>
   <h2>4. Confidentialité</h2>
   <p>Votre utilisation de Molam ID est également régie par notre Politique de Confidentialité.</p>
   <h2>5. Résiliation</h2>
   <p>Nous pouvons résilier ou suspendre l''accès immédiatement, sans préavis, en cas de violation de ces Conditions.</p>
   <p>Contact: support@molam.com</p>'
),
(
  'privacy',
  'fr',
  1,
  'Politique de Confidentialité - Molam ID

Version 1.0 - Effective Date: January 1, 2025

1. Information We Collect
- Account information (email, phone, name)
- Authentication data (encrypted passwords, biometric data)
- Device information (fingerprint, IP address, location)
- Usage data (sessions, login history)

2. How We Use Your Information
- To provide authentication services
- To detect fraud and security threats
- To improve our services
- To comply with legal obligations

3. Data Sharing
We do not sell your personal data. We may share data with:
- Service providers (hosting, analytics)
- Law enforcement (when legally required)

4. Your Rights (GDPR)
- Right to access your data
- Right to rectification
- Right to erasure
- Right to data portability

5. Data Retention
We retain your data as long as your account is active or as needed to provide services.

Contact: privacy@molam.com',
  '<h1>Politique de Confidentialité - Molam ID</h1>
   <p><strong>Version 1.0 - Date effective: 1er janvier 2025</strong></p>
   <h2>1. Informations que nous collectons</h2>
   <ul>
     <li>Informations de compte (email, téléphone, nom)</li>
     <li>Données d''authentification (mots de passe chiffrés, données biométriques)</li>
     <li>Informations sur l''appareil (empreinte, adresse IP, localisation)</li>
     <li>Données d''utilisation (sessions, historique de connexion)</li>
   </ul>
   <h2>2. Comment nous utilisons vos informations</h2>
   <ul>
     <li>Pour fournir des services d''authentification</li>
     <li>Pour détecter la fraude et les menaces de sécurité</li>
     <li>Pour améliorer nos services</li>
     <li>Pour nous conformer aux obligations légales</li>
   </ul>
   <h2>3. Partage de données</h2>
   <p>Nous ne vendons pas vos données personnelles. Nous pouvons partager des données avec:</p>
   <ul>
     <li>Fournisseurs de services (hébergement, analyses)</li>
     <li>Forces de l''ordre (lorsque légalement requis)</li>
   </ul>
   <h2>4. Vos droits (RGPD)</h2>
   <ul>
     <li>Droit d''accès à vos données</li>
     <li>Droit de rectification</li>
     <li>Droit à l''effacement</li>
     <li>Droit à la portabilité des données</li>
   </ul>
   <h2>5. Conservation des données</h2>
   <p>Nous conservons vos données tant que votre compte est actif ou selon les besoins pour fournir des services.</p>
   <p>Contact: privacy@molam.com</p>'
),
(
  'legal',
  'fr',
  1,
  'Mentions Légales - Molam ID

Version 1.0

Éditeur: Molam Technologies
Siège social: [Address]
Capital social: [Amount]
RCS: [Number]
SIRET: [Number]
TVA: [VAT Number]

Directeur de publication: [Name]

Hébergeur: [Hosting Provider]
Address: [Hosting Address]
Contact: [Hosting Contact]

Propriété intellectuelle:
Le site et son contenu sont la propriété de Molam Technologies.
Toute reproduction est interdite sans autorisation.

Contact: legal@molam.com',
  '<h1>Mentions Légales - Molam ID</h1>
   <p><strong>Version 1.0</strong></p>
   <h2>Éditeur</h2>
   <p>Molam Technologies<br>
   Siège social: [Address]<br>
   Capital social: [Amount]<br>
   RCS: [Number]<br>
   SIRET: [Number]<br>
   TVA: [VAT Number]</p>
   <h2>Directeur de publication</h2>
   <p>[Name]</p>
   <h2>Hébergeur</h2>
   <p>[Hosting Provider]<br>
   Adresse: [Hosting Address]<br>
   Contact: [Hosting Contact]</p>
   <h2>Propriété intellectuelle</h2>
   <p>Le site et son contenu sont la propriété de Molam Technologies.
   Toute reproduction est interdite sans autorisation.</p>
   <p>Contact: legal@molam.com</p>'
)
ON CONFLICT (type, lang, version) DO NOTHING;

-- Insert English versions
INSERT INTO molam_legal_docs (type, lang, version, content, html_content) VALUES
(
  'cgu',
  'en',
  1,
  'Terms and Conditions - Molam ID

Version 1.0 - Effective Date: January 1, 2025

1. Acceptance of Terms
By accessing and using Molam ID services, you accept and agree to be bound by these Terms and Conditions.

2. Service Description
Molam ID provides identity and authentication services for the Molam ecosystem (Pay, Eats, Shop, Talk, Ads, Free).

3. User Account
- You must provide accurate information
- You are responsible for maintaining account security
- You must be at least 13 years old to create an account

4. Privacy
Your use of Molam ID is also governed by our Privacy Policy.

5. Termination
We may terminate or suspend access immediately, without prior notice, for breach of these Terms.

Contact: support@molam.com',
  '<h1>Terms and Conditions - Molam ID</h1><p><strong>Version 1.0 - Effective Date: January 1, 2025</strong></p>'
),
(
  'privacy',
  'en',
  1,
  'Privacy Policy - Molam ID

Version 1.0 - Effective Date: January 1, 2025

[English content]',
  '<h1>Privacy Policy - Molam ID</h1><p><strong>Version 1.0 - Effective Date: January 1, 2025</strong></p>'
),
(
  'legal',
  'en',
  1,
  'Legal Notice - Molam ID

Version 1.0

[English content]',
  '<h1>Legal Notice - Molam ID</h1><p><strong>Version 1.0</strong></p>'
)
ON CONFLICT (type, lang, version) DO NOTHING;

-- Comments
COMMENT ON TABLE molam_legal_docs IS 'Brique 36 - Versioned legal documents for Molam ID UI';
COMMENT ON COLUMN molam_legal_docs.type IS 'Document type: cgu, privacy, legal, cookies, data_protection';
COMMENT ON COLUMN molam_legal_docs.lang IS 'Language code: fr, en, wo, ar, es, pt';
COMMENT ON COLUMN molam_legal_docs.version IS 'Document version number';
COMMENT ON COLUMN molam_legal_docs.content IS 'Plain text content';
COMMENT ON COLUMN molam_legal_docs.html_content IS 'HTML formatted content';
