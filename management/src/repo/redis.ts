// Stub Redis - à implémenter avec redis client
export const redis = {
    del: async (key: string): Promise<void> => {
        console.log(`[Redis] DEL ${key}`);
        // Implémentation réelle avec redis client
    }
};