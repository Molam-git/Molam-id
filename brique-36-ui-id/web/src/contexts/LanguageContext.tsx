import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'fr' | 'en' | 'wo';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Traductions
const translations: Record<Language, Record<string, string>> = {
  fr: {
    // Navigation
    'nav.home': 'Accueil',
    'nav.profile': 'Profil',
    'nav.logout': 'Déconnexion',
    'nav.login': 'Connexion',
    'nav.signup': 'Inscription',

    // Login Page
    'login.title': 'Connexion',
    'login.subtitle': 'Accédez à votre compte Molam ID',
    'login.email_or_phone': 'Email ou téléphone',
    'login.password': 'Mot de passe',
    'login.submit': 'Se connecter',
    'login.no_account': 'Pas encore de compte ?',
    'login.create_account': 'Créer un compte',
    'login.error': 'Identifiants invalides',

    // Signup Page
    'signup.title': 'Créer un compte',
    'signup.subtitle': 'Rejoignez l\'écosystème Molam',
    'signup.first_name': 'Prénom',
    'signup.last_name': 'Nom',
    'signup.phone': 'Numéro de téléphone',
    'signup.email': 'Email (optionnel)',
    'signup.password': 'Mot de passe',
    'signup.confirm_password': 'Confirmer le mot de passe',
    'signup.accept_terms': 'J\'accepte les',
    'signup.terms': 'Conditions Générales d\'Utilisation',
    'signup.privacy': 'Politique de Confidentialité',
    'signup.submit': 'Créer mon compte',
    'signup.creating': 'Création...',
    'signup.already_account': 'Déjà un compte ?',
    'signup.login': 'Se connecter',
    'signup.error.passwords_mismatch': 'Les mots de passe ne correspondent pas',
    'signup.error.accept_terms': 'Vous devez accepter les conditions générales',
    'signup.success': 'Compte créé avec succès',

    // Profile Page
    'profile.loading': 'Chargement du profil...',
    'profile.title': 'Molam ID',
    'profile.section.personal': 'Informations personnelles',
    'profile.full_name': 'Nom complet',
    'profile.phone': 'Téléphone',
    'profile.email': 'Email',
    'profile.member_since': 'Membre depuis',
    'profile.not_provided': 'Non renseigné',
    'profile.not_available': 'Non disponible',

    // Accessibility Preferences
    'profile.section.accessibility': 'Préférences d\'accessibilité',
    'profile.tts': 'Synthèse vocale',
    'profile.tts.description': 'Lecture audio des textes à l\'écran',
    'profile.theme': 'Thème sombre',
    'profile.theme.description': 'Interface en mode sombre pour réduire la fatigue oculaire',
    'profile.language': 'Langue',
    'profile.language.description': 'Choisissez votre langue préférée',

    // Services
    'profile.section.services': 'Services Molam',
    'profile.services.description': 'Votre identité Molam ID vous donne accès à tous les services de l\'écosystème Molam :',

    // Common
    'common.user': 'Utilisateur',
    'common.and': 'et la',
  },

  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.profile': 'Profile',
    'nav.logout': 'Logout',
    'nav.login': 'Login',
    'nav.signup': 'Sign Up',

    // Login Page
    'login.title': 'Login',
    'login.subtitle': 'Access your Molam ID account',
    'login.email_or_phone': 'Email or phone',
    'login.password': 'Password',
    'login.submit': 'Login',
    'login.no_account': 'Don\'t have an account?',
    'login.create_account': 'Create account',
    'login.error': 'Invalid credentials',

    // Signup Page
    'signup.title': 'Create Account',
    'signup.subtitle': 'Join the Molam ecosystem',
    'signup.first_name': 'First name',
    'signup.last_name': 'Last name',
    'signup.phone': 'Phone number',
    'signup.email': 'Email (optional)',
    'signup.password': 'Password',
    'signup.confirm_password': 'Confirm password',
    'signup.accept_terms': 'I accept the',
    'signup.terms': 'Terms of Service',
    'signup.privacy': 'Privacy Policy',
    'signup.submit': 'Create my account',
    'signup.creating': 'Creating...',
    'signup.already_account': 'Already have an account?',
    'signup.login': 'Login',
    'signup.error.passwords_mismatch': 'Passwords do not match',
    'signup.error.accept_terms': 'You must accept the terms and conditions',
    'signup.success': 'Account created successfully',

    // Profile Page
    'profile.loading': 'Loading profile...',
    'profile.title': 'Molam ID',
    'profile.section.personal': 'Personal Information',
    'profile.full_name': 'Full name',
    'profile.phone': 'Phone',
    'profile.email': 'Email',
    'profile.member_since': 'Member since',
    'profile.not_provided': 'Not provided',
    'profile.not_available': 'Not available',

    // Accessibility Preferences
    'profile.section.accessibility': 'Accessibility Preferences',
    'profile.tts': 'Text-to-Speech',
    'profile.tts.description': 'Audio reading of on-screen text',
    'profile.theme': 'Dark theme',
    'profile.theme.description': 'Dark mode interface to reduce eye strain',
    'profile.language': 'Language',
    'profile.language.description': 'Choose your preferred language',

    // Services
    'profile.section.services': 'Molam Services',
    'profile.services.description': 'Your Molam ID gives you access to all services in the Molam ecosystem:',

    // Common
    'common.user': 'User',
    'common.and': 'and the',
  },

  wo: {
    // Navigation
    'nav.home': 'Kër',
    'nav.profile': 'Profil',
    'nav.logout': 'Génn',
    'nav.login': 'Dugg',
    'nav.signup': 'Bindu',

    // Login Page
    'login.title': 'Dugg',
    'login.subtitle': 'Ubbi sa konte Molam ID',
    'login.email_or_phone': 'Email walla telefon',
    'login.password': 'Mot de passe',
    'login.submit': 'Dugg',
    'login.no_account': 'Amul konte?',
    'login.create_account': 'Bindu konte',
    'login.error': 'Ay xibaar yu baax',

    // Signup Page
    'signup.title': 'Bindu konte',
    'signup.subtitle': 'Bokk ci ekosistem Molam',
    'signup.first_name': 'Tur',
    'signup.last_name': 'Sant',
    'signup.phone': 'Nimero telefon',
    'signup.email': 'Email (bu njool)',
    'signup.password': 'Mot de passe',
    'signup.confirm_password': 'Wothie mot de passe',
    'signup.accept_terms': 'Dama jappe',
    'signup.terms': 'Kondisioŋ yu bees yi',
    'signup.privacy': 'Politig sutura',
    'signup.submit': 'Bindu sama konte',
    'signup.creating': 'Dafa bindu...',
    'signup.already_account': 'Am nga konte?',
    'signup.login': 'Dugg',
    'signup.error.passwords_mismatch': 'Mot de passe yi beneen la',
    'signup.error.accept_terms': 'War nga jappe kondisioŋ yi',
    'signup.success': 'Konte bi bindu na',

    // Profile Page
    'profile.loading': 'Dafa tàbb profil...',
    'profile.title': 'Molam ID',
    'profile.section.personal': 'Xibaar yu boroom',
    'profile.full_name': 'Tur ak sant',
    'profile.phone': 'Telefon',
    'profile.email': 'Email',
    'profile.member_since': 'Bokk nañu ci',
    'profile.not_provided': 'Amul',
    'profile.not_available': 'Amul',

    // Accessibility Preferences
    'profile.section.accessibility': 'Tann ci sarret',
    'profile.tts': 'Wax bu deglu',
    'profile.tts.description': 'Wax yi nga xool ci laptop',
    'profile.theme': 'Tema ñuul',
    'profile.theme.description': 'Tema ñuul ngir wañi bët yi',
    'profile.language': 'Làkk',
    'profile.language.description': 'Tann sa làkk',

    // Services
    'profile.section.services': 'Sërvisu Molam',
    'profile.services.description': 'Sa Molam ID di la jox yoon ci ñépp sërvisu Molam:',

    // Common
    'common.user': 'Jëfandikukat',
    'common.and': 'ak',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Récupérer la langue depuis localStorage ou utiliser 'fr' par défaut
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'fr';
  });

  useEffect(() => {
    // Sauvegarder la langue dans localStorage
    localStorage.setItem('language', language);

    // Mettre à jour l'attribut lang du HTML
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
