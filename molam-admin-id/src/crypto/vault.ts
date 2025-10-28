// Stub pour l'orchestration Vault/HSM
export async function vaultRotateJwtKey(): Promise<{ kid: string; alg: string }> {
    // Implémentation réelle : appeler Vault/HSM pour générer une nouvelle paire de clés
    // Marquer la précédente comme "retiring", retourner le nouveau KID
    console.log('[Vault] Rotating JWT key...');

    // Simulation - dans la réalité, ce serait un appel API à Vault
    return {
        kid: `kid_${Date.now()}`,
        alg: 'RS256'
    };
}