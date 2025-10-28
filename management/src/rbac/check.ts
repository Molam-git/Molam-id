// Stub pour la vérification des permissions
export async function checkPermission(userId: string, permission: string, context?: any): Promise<boolean> {
    // Implémentation réelle basée sur les rôles de l'utilisateur
    console.log(`Checking permission ${permission} for user ${userId}`, context);
    return true; // Temporaire - à implémenter
}