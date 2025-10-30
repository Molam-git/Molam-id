/**
 * Time Utilities
 */

/**
 * Get current time plus N minutes
 */
export function nowPlusMinutes(minutes: number): Date {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

/**
 * Get current time plus N hours
 */
export function nowPlusHours(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

/**
 * Get current time plus N days
 */
export function nowPlusDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Check if date is expired
 */
export function isExpired(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Format date for display
 */
export function formatDate(date: Date, locale = "fr-FR"): string {
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get seconds until expiry
 */
export function secondsUntil(date: Date): number {
  return Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
}
