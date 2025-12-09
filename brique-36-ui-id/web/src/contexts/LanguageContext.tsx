import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'fr' | 'en' | 'wo' | 'ar' | 'es' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Détection automatique de la langue basée sur la localisation du navigateur
function detectBrowserLanguage(): Language {
  const browserLang = navigator.language || (navigator as any).userLanguage;
  const langCode = browserLang.toLowerCase().split('-')[0];

  // Mapping des codes de langue aux langues supportées
  const languageMap: Record<string, Language> = {
    'fr': 'fr',  // Français
    'en': 'en',  // Anglais
    'wo': 'wo',  // Wolof
    'ar': 'ar',  // Arabe
    'es': 'es',  // Espagnol
    'pt': 'pt',  // Portugais
  };

  return languageMap[langCode] || 'en'; // Anglais par défaut
}

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

    // Footer
    'footer.description': 'Votre identité numérique unifiée pour tous les services Molam',
    'footer.legal': 'Mentions légales',
    'footer.legal.aria': 'Navigation mentions légales',
    'footer.legal.terms': 'Conditions Générales d\'Utilisation',
    'footer.legal.privacy': 'Politique de Confidentialité',
    'footer.legal.legal': 'Mentions Légales',
    'footer.legal.cookies': 'Gestion des Cookies',
    'footer.legal.data': 'Protection des Données',
    'footer.support': 'Support',
    'footer.support.help': 'Centre d\'aide',
    'footer.support.contact': 'Nous contacter',
    'footer.rights': 'Tous droits réservés',
    'footer.badge.gdpr': 'Conforme RGPD',
    'footer.badge.secure': 'Sécurisé',
    'footer.badge.senegal': 'Made in USA',
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

    // Footer
    'footer.description': 'Your unified digital identity for all Molam services',
    'footer.legal': 'Legal',
    'footer.legal.aria': 'Legal navigation',
    'footer.legal.terms': 'Terms of Service',
    'footer.legal.privacy': 'Privacy Policy',
    'footer.legal.legal': 'Legal Notice',
    'footer.legal.cookies': 'Cookie Management',
    'footer.legal.data': 'Data Protection',
    'footer.support': 'Support',
    'footer.support.help': 'Help Center',
    'footer.support.contact': 'Contact us',
    'footer.rights': 'All rights reserved',
    'footer.badge.gdpr': 'GDPR Compliant',
    'footer.badge.secure': 'Secure',
    'footer.badge.senegal': 'Made in USA',
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

    // Footer
    'footer.description': 'Sa identite bu bees ci internet bu Molam',
    'footer.legal': 'Yoon yi ci loi',
    'footer.legal.aria': 'Yoon yi ci loi',
    'footer.legal.terms': 'Kondisioŋ yu bees yi',
    'footer.legal.privacy': 'Politig sutura',
    'footer.legal.legal': 'Yoon ci loi',
    'footer.legal.cookies': 'Gestion cookies',
    'footer.legal.data': 'Kiir données yi',
    'footer.support': 'Wante',
    'footer.support.help': 'Ndimbalu wante',
    'footer.support.contact': 'Jokkook ak nu',
    'footer.rights': 'Ñépp sag yi am na',
    'footer.badge.gdpr': 'RGPD',
    'footer.badge.secure': 'Kiir na',
    'footer.badge.senegal': 'Made in USA',
  },

  ar: {
    // Navigation
    'nav.home': 'الرئيسية',
    'nav.profile': 'الملف الشخصي',
    'nav.logout': 'تسجيل الخروج',
    'nav.login': 'تسجيل الدخول',
    'nav.signup': 'إنشاء حساب',

    // Login Page
    'login.title': 'تسجيل الدخول',
    'login.subtitle': 'الوصول إلى حساب Molam ID الخاص بك',
    'login.email_or_phone': 'البريد الإلكتروني أو الهاتف',
    'login.password': 'كلمة المرور',
    'login.submit': 'تسجيل الدخول',
    'login.no_account': 'ليس لديك حساب؟',
    'login.create_account': 'إنشاء حساب',
    'login.error': 'بيانات اعتماد غير صالحة',

    // Signup Page
    'signup.title': 'إنشاء حساب',
    'signup.subtitle': 'انضم إلى نظام Molam',
    'signup.first_name': 'الاسم الأول',
    'signup.last_name': 'اسم العائلة',
    'signup.phone': 'رقم الهاتف',
    'signup.email': 'البريد الإلكتروني (اختياري)',
    'signup.password': 'كلمة المرور',
    'signup.confirm_password': 'تأكيد كلمة المرور',
    'signup.accept_terms': 'أوافق على',
    'signup.terms': 'شروط الخدمة',
    'signup.privacy': 'سياسة الخصوصية',
    'signup.submit': 'إنشاء حسابي',
    'signup.creating': 'جاري الإنشاء...',
    'signup.already_account': 'هل لديك حساب بالفعل؟',
    'signup.login': 'تسجيل الدخول',
    'signup.error.passwords_mismatch': 'كلمات المرور غير متطابقة',
    'signup.error.accept_terms': 'يجب عليك قبول الشروط والأحكام',
    'signup.success': 'تم إنشاء الحساب بنجاح',

    // Profile Page
    'profile.loading': 'جاري تحميل الملف الشخصي...',
    'profile.title': 'Molam ID',
    'profile.section.personal': 'المعلومات الشخصية',
    'profile.full_name': 'الاسم الكامل',
    'profile.phone': 'الهاتف',
    'profile.email': 'البريد الإلكتروني',
    'profile.member_since': 'عضو منذ',
    'profile.not_provided': 'غير مقدم',
    'profile.not_available': 'غير متاح',

    // Accessibility Preferences
    'profile.section.accessibility': 'تفضيلات إمكانية الوصول',
    'profile.tts': 'النص إلى كلام',
    'profile.tts.description': 'قراءة صوتية للنصوص على الشاشة',
    'profile.theme': 'المظهر الداكن',
    'profile.theme.description': 'واجهة بوضع داكن لتقليل إجهاد العين',
    'profile.language': 'اللغة',
    'profile.language.description': 'اختر لغتك المفضلة',

    // Services
    'profile.section.services': 'خدمات Molam',
    'profile.services.description': 'هوية Molam ID الخاصة بك تمنحك الوصول إلى جميع الخدمات في نظام Molam:',

    // Common
    'common.user': 'مستخدم',
    'common.and': 'و',

    // Footer
    'footer.description': 'هويتك الرقمية الموحدة لجميع خدمات Molam',
    'footer.legal': 'قانوني',
    'footer.legal.aria': 'التنقل القانوني',
    'footer.legal.terms': 'شروط الخدمة',
    'footer.legal.privacy': 'سياسة الخصوصية',
    'footer.legal.legal': 'إشعار قانوني',
    'footer.legal.cookies': 'إدارة ملفات تعريف الارتباط',
    'footer.legal.data': 'حماية البيانات',
    'footer.support': 'الدعم',
    'footer.support.help': 'مركز المساعدة',
    'footer.support.contact': 'اتصل بنا',
    'footer.rights': 'جميع الحقوق محفوظة',
    'footer.badge.gdpr': 'متوافق مع GDPR',
    'footer.badge.secure': 'آمن',
    'footer.badge.senegal': 'صنع في أمريكا',
  },

  es: {
    // Navigation
    'nav.home': 'Inicio',
    'nav.profile': 'Perfil',
    'nav.logout': 'Cerrar sesión',
    'nav.login': 'Iniciar sesión',
    'nav.signup': 'Registrarse',

    // Login Page
    'login.title': 'Iniciar sesión',
    'login.subtitle': 'Accede a tu cuenta de Molam ID',
    'login.email_or_phone': 'Correo electrónico o teléfono',
    'login.password': 'Contraseña',
    'login.submit': 'Iniciar sesión',
    'login.no_account': '¿No tienes una cuenta?',
    'login.create_account': 'Crear cuenta',
    'login.error': 'Credenciales inválidas',

    // Signup Page
    'signup.title': 'Crear cuenta',
    'signup.subtitle': 'Únete al ecosistema Molam',
    'signup.first_name': 'Nombre',
    'signup.last_name': 'Apellido',
    'signup.phone': 'Número de teléfono',
    'signup.email': 'Correo electrónico (opcional)',
    'signup.password': 'Contraseña',
    'signup.confirm_password': 'Confirmar contraseña',
    'signup.accept_terms': 'Acepto los',
    'signup.terms': 'Términos de servicio',
    'signup.privacy': 'Política de privacidad',
    'signup.submit': 'Crear mi cuenta',
    'signup.creating': 'Creando...',
    'signup.already_account': '¿Ya tienes una cuenta?',
    'signup.login': 'Iniciar sesión',
    'signup.error.passwords_mismatch': 'Las contraseñas no coinciden',
    'signup.error.accept_terms': 'Debes aceptar los términos y condiciones',
    'signup.success': 'Cuenta creada exitosamente',

    // Profile Page
    'profile.loading': 'Cargando perfil...',
    'profile.title': 'Molam ID',
    'profile.section.personal': 'Información personal',
    'profile.full_name': 'Nombre completo',
    'profile.phone': 'Teléfono',
    'profile.email': 'Correo electrónico',
    'profile.member_since': 'Miembro desde',
    'profile.not_provided': 'No proporcionado',
    'profile.not_available': 'No disponible',

    // Accessibility Preferences
    'profile.section.accessibility': 'Preferencias de accesibilidad',
    'profile.tts': 'Texto a voz',
    'profile.tts.description': 'Lectura de audio del texto en pantalla',
    'profile.theme': 'Tema oscuro',
    'profile.theme.description': 'Interfaz en modo oscuro para reducir la fatiga visual',
    'profile.language': 'Idioma',
    'profile.language.description': 'Elige tu idioma preferido',

    // Services
    'profile.section.services': 'Servicios Molam',
    'profile.services.description': 'Tu Molam ID te da acceso a todos los servicios del ecosistema Molam:',

    // Common
    'common.user': 'Usuario',
    'common.and': 'y la',

    // Footer
    'footer.description': 'Tu identidad digital unificada para todos los servicios de Molam',
    'footer.legal': 'Legal',
    'footer.legal.aria': 'Navegación legal',
    'footer.legal.terms': 'Términos de servicio',
    'footer.legal.privacy': 'Política de privacidad',
    'footer.legal.legal': 'Aviso legal',
    'footer.legal.cookies': 'Gestión de cookies',
    'footer.legal.data': 'Protección de datos',
    'footer.support': 'Soporte',
    'footer.support.help': 'Centro de ayuda',
    'footer.support.contact': 'Contáctanos',
    'footer.rights': 'Todos los derechos reservados',
    'footer.badge.gdpr': 'Conforme con GDPR',
    'footer.badge.secure': 'Seguro',
    'footer.badge.senegal': 'Hecho en USA',
  },

  pt: {
    // Navigation
    'nav.home': 'Início',
    'nav.profile': 'Perfil',
    'nav.logout': 'Sair',
    'nav.login': 'Entrar',
    'nav.signup': 'Registrar',

    // Login Page
    'login.title': 'Entrar',
    'login.subtitle': 'Acesse sua conta Molam ID',
    'login.email_or_phone': 'E-mail ou telefone',
    'login.password': 'Senha',
    'login.submit': 'Entrar',
    'login.no_account': 'Não tem uma conta?',
    'login.create_account': 'Criar conta',
    'login.error': 'Credenciais inválidas',

    // Signup Page
    'signup.title': 'Criar conta',
    'signup.subtitle': 'Junte-se ao ecossistema Molam',
    'signup.first_name': 'Nome',
    'signup.last_name': 'Sobrenome',
    'signup.phone': 'Número de telefone',
    'signup.email': 'E-mail (opcional)',
    'signup.password': 'Senha',
    'signup.confirm_password': 'Confirmar senha',
    'signup.accept_terms': 'Eu aceito os',
    'signup.terms': 'Termos de serviço',
    'signup.privacy': 'Política de privacidade',
    'signup.submit': 'Criar minha conta',
    'signup.creating': 'Criando...',
    'signup.already_account': 'Já tem uma conta?',
    'signup.login': 'Entrar',
    'signup.error.passwords_mismatch': 'As senhas não coincidem',
    'signup.error.accept_terms': 'Você deve aceitar os termos e condições',
    'signup.success': 'Conta criada com sucesso',

    // Profile Page
    'profile.loading': 'Carregando perfil...',
    'profile.title': 'Molam ID',
    'profile.section.personal': 'Informações pessoais',
    'profile.full_name': 'Nome completo',
    'profile.phone': 'Telefone',
    'profile.email': 'E-mail',
    'profile.member_since': 'Membro desde',
    'profile.not_provided': 'Não fornecido',
    'profile.not_available': 'Não disponível',

    // Accessibility Preferences
    'profile.section.accessibility': 'Preferências de acessibilidade',
    'profile.tts': 'Texto para fala',
    'profile.tts.description': 'Leitura de áudio do texto na tela',
    'profile.theme': 'Tema escuro',
    'profile.theme.description': 'Interface em modo escuro para reduzir a fadiga visual',
    'profile.language': 'Idioma',
    'profile.language.description': 'Escolha seu idioma preferido',

    // Services
    'profile.section.services': 'Serviços Molam',
    'profile.services.description': 'Seu Molam ID dá acesso a todos os serviços do ecossistema Molam:',

    // Common
    'common.user': 'Usuário',
    'common.and': 'e a',

    // Footer
    'footer.description': 'Sua identidade digital unificada para todos os serviços Molam',
    'footer.legal': 'Legal',
    'footer.legal.aria': 'Navegação legal',
    'footer.legal.terms': 'Termos de serviço',
    'footer.legal.privacy': 'Política de privacidade',
    'footer.legal.legal': 'Aviso legal',
    'footer.legal.cookies': 'Gestão de cookies',
    'footer.legal.data': 'Proteção de dados',
    'footer.support': 'Suporte',
    'footer.support.help': 'Central de ajuda',
    'footer.support.contact': 'Entre em contato',
    'footer.rights': 'Todos os direitos reservados',
    'footer.badge.gdpr': 'Compatível com GDPR',
    'footer.badge.secure': 'Seguro',
    'footer.badge.senegal': 'Feito nos EUA',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Récupérer la langue depuis localStorage ou détecter automatiquement
    const saved = localStorage.getItem('language');
    if (saved) {
      return saved as Language;
    }
    // Détecter automatiquement la langue du navigateur
    return detectBrowserLanguage();
  });

  useEffect(() => {
    console.log('🌍 Language changed to:', language);

    // Sauvegarder la langue dans localStorage
    localStorage.setItem('language', language);

    // Mettre à jour l'attribut lang du HTML
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    console.log('🌍 Changing language to:', lang);
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    const translation = translations[language][key] || key;
    // Uncomment for debugging: console.log(`t('${key}') [${language}] =>`, translation);
    return translation;
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
