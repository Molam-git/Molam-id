/**
 * SIRA Score Integration Module
 * Brique 9 - AuthZ ext_authz
 *
 * Integrates with SIRA (Security Incident Risk Assessment) service
 * to fetch real-time risk scores for authorization decisions
 *
 * SIRA Score ranges:
 * - 0-40: High risk (deny most operations)
 * - 41-69: Medium risk (allow basic operations, deny high-value)
 * - 70-89: Low risk (allow most operations)
 * - 90-100: Very low risk (allow all operations)
 */

import dotenv from 'dotenv';

dotenv.config();

const SIRA_CONFIG = {
  apiUrl: process.env.SIRA_API_URL || 'http://sira-service:5000',
  enabled: process.env.SIRA_ENABLED === 'true',
  minScoreThreshold: parseInt(process.env.SIRA_MIN_SCORE_THRESHOLD || '70'),
  timeout: 2000, // 2 seconds timeout
  cacheTTL: 300, // 5 minutes cache
};

// In-memory cache for SIRA scores (to avoid excessive API calls)
const siraCache = new Map();

/**
 * Fetch SIRA score from external service
 * @param {string} userId - User ID
 * @returns {Promise<number>} SIRA score (0-100)
 */
async function fetchSiraScoreFromAPI(userId) {
  if (!SIRA_CONFIG.enabled) {
    console.log('SIRA integration disabled, returning default score');
    return 100; // Default to safe score when disabled
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SIRA_CONFIG.timeout);

    const response = await fetch(`${SIRA_CONFIG.apiUrl}/api/sira/score/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.SIRA_API_KEY || 'dev-key'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`SIRA API error: ${response.status}`);
      return 50; // Default to medium risk on error
    }

    const data = await response.json();
    return data.score || 50;

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('SIRA API timeout');
    } else {
      console.error('SIRA API fetch error:', error.message);
    }
    return 50; // Default to medium risk on error
  }
}

/**
 * Get SIRA score with caching
 * @param {string} userId - User ID
 * @returns {Promise<number>} SIRA score (0-100)
 */
export async function getSiraScore(userId) {
  // Check cache first
  const cached = siraCache.get(userId);
  if (cached && Date.now() - cached.timestamp < SIRA_CONFIG.cacheTTL * 1000) {
    console.log(`SIRA score cache hit for user ${userId}: ${cached.score}`);
    return cached.score;
  }

  // Fetch fresh score
  const score = await fetchSiraScoreFromAPI(userId);

  // Update cache
  siraCache.set(userId, {
    score,
    timestamp: Date.now()
  });

  console.log(`SIRA score fetched for user ${userId}: ${score}`);
  return score;
}

/**
 * Get SIRA risk level from score
 * @param {number} score - SIRA score (0-100)
 * @returns {string} Risk level: 'high', 'medium', 'low', 'very_low'
 */
export function getSiraRiskLevel(score) {
  if (score >= 90) return 'very_low';
  if (score >= 70) return 'low';
  if (score >= 41) return 'medium';
  return 'high';
}

/**
 * Check if action is allowed based on SIRA score
 * @param {number} score - SIRA score (0-100)
 * @param {string} action - Action type (e.g., 'transfer', 'read', 'write')
 * @param {object} context - Additional context (amount, etc.)
 * @returns {object} { allowed: boolean, reason: string }
 */
export function checkSiraPolicy(score, action, context = {}) {
  const riskLevel = getSiraRiskLevel(score);

  // High risk (0-40): Only allow read operations
  if (riskLevel === 'high') {
    if (action === 'read') {
      return { allowed: true, reason: 'Read operation allowed despite high risk' };
    }
    return { allowed: false, reason: `SIRA score ${score} is too low (high risk)` };
  }

  // Medium risk (41-69): Allow basic operations, deny high-value transfers
  if (riskLevel === 'medium') {
    if (action === 'transfer' && context.amount && context.amount > 100000) {
      return { allowed: false, reason: `High-value transfer blocked due to medium risk (SIRA: ${score})` };
    }
    if (action === 'delete' || action === 'admin') {
      return { allowed: false, reason: `Admin action blocked due to medium risk (SIRA: ${score})` };
    }
    return { allowed: true, reason: `Action allowed with medium risk (SIRA: ${score})` };
  }

  // Low risk (70-89): Allow most operations
  if (riskLevel === 'low') {
    if (action === 'admin' && score < 80) {
      return { allowed: false, reason: `Admin action requires SIRA score >= 80 (current: ${score})` };
    }
    return { allowed: true, reason: `Action allowed with low risk (SIRA: ${score})` };
  }

  // Very low risk (90-100): Allow all operations
  return { allowed: true, reason: `Action allowed with very low risk (SIRA: ${score})` };
}

/**
 * Invalidate cached SIRA score for a user
 * (call this when user behavior changes significantly)
 * @param {string} userId - User ID
 */
export function invalidateSiraCache(userId) {
  siraCache.delete(userId);
  console.log(`SIRA cache invalidated for user ${userId}`);
}

/**
 * Clear entire SIRA cache
 */
export function clearSiraCache() {
  siraCache.clear();
  console.log('SIRA cache cleared completely');
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
export function getSiraCacheStats() {
  return {
    size: siraCache.size,
    enabled: SIRA_CONFIG.enabled,
    minThreshold: SIRA_CONFIG.minScoreThreshold,
    ttl: SIRA_CONFIG.cacheTTL
  };
}

// Mock SIRA service for development/testing
export const mockSiraService = {
  /**
   * Simulate SIRA score calculation (for testing)
   * @param {string} userId - User ID
   * @param {object} userAttributes - User attributes
   * @returns {number} Simulated SIRA score
   */
  calculateMockScore(userId, userAttributes = {}) {
    let score = 70; // Base score

    // Adjust based on KYC level
    if (userAttributes.kyc_level === 'P3') score += 15;
    else if (userAttributes.kyc_level === 'P2') score += 10;
    else if (userAttributes.kyc_level === 'P1') score += 5;
    else score -= 10; // P0 or unverified

    // Adjust based on account age (simulated)
    const accountAgeMonths = Math.floor(Math.random() * 24); // 0-24 months
    score += Math.min(accountAgeMonths, 10); // Max +10 for old accounts

    // Adjust based on transaction history (simulated)
    const hasGoodHistory = Math.random() > 0.3; // 70% have good history
    if (hasGoodHistory) score += 5;
    else score -= 15;

    // Ensure score is in valid range
    return Math.max(0, Math.min(100, score));
  }
};

export default {
  getSiraScore,
  getSiraRiskLevel,
  checkSiraPolicy,
  invalidateSiraCache,
  clearSiraCache,
  getSiraCacheStats,
  mockSiraService
};
