// src/rbac/check.ts
export async function checkPermission(userId: string, permission: string, context?: any): Promise<boolean> {
    // Stub implementation - replace with actual RBAC logic
    console.log(`[RBAC] Checking permission ${permission} for user ${userId}`, context);

    // For development, allow all permissions
    // In production, implement proper role-based access control
    return true;
}