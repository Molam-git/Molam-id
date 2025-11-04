/**
 * Configuration de l'API
 *
 * IMPORTANT: Pour tester sur votre téléphone, remplacez localhost
 * par l'adresse IP de votre PC (ex: 192.168.1.100)
 *
 * Pour trouver votre IP:
 * Windows: ipconfig (cherchez "IPv4 Address")
 * Mac/Linux: ifconfig | grep inet
 */

// ⚠️ MODIFIEZ CETTE LIGNE avec votre IP locale (trouvée avec ipconfig)
const DEV_API_URL = 'http://192.168.1.22:3000';
const PROD_API_URL = 'https://api.molam.id';

// Détection automatique de l'environnement
const getApiUrl = () => {
  // En développement, utilisez votre IP locale
  if (__DEV__) {
    return DEV_API_URL;
  }

  // En production, utilisez votre domaine
  return PROD_API_URL;
};

export const API_CONFIG = {
  baseUrl: getApiUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};

export const API_URL = API_CONFIG.baseUrl;
