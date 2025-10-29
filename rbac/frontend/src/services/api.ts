// frontend/src/services/api.ts
import axios from 'axios';

// Configuration de base d'axios
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Intercepteur pour ajouter le token JWT automatiquement
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('molam_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Intercepteur pour gérer les erreurs globales
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expiré ou invalide - redirection vers login
            localStorage.removeItem('molam_token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;