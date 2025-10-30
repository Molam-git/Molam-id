// src/services/sira.ts
// SIRA: Système d'Intégrité et de Risque Anticipé (Risk analysis service)
import { env } from '../config/env.js';

export interface SIRASignal {
  signal_type: 'otp_anomaly' | 'brute_force_attempt' | 'suspicious_reset_pattern';
  user_id?: string;
  country_code?: string;
  metadata: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

/**
 * Send risk signal to SIRA webhook
 */
export async function sendSIRASignal(signal: SIRASignal): Promise<void> {
  if (!env.SIRA_ENABLED || !env.SIRA_WEBHOOK_URL) {
    return;
  }

  try {
    const response = await fetch(env.SIRA_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Molam-Service': 'molam-id-password-reset',
      },
      body: JSON.stringify(signal),
    });

    if (!response.ok) {
      console.error(`SIRA webhook error: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error('SIRA webhook request failed:', err);
  }
}

/**
 * Analyze OTP failure rate and send SIRA signal if threshold exceeded
 */
export async function analyzeOTPFailureRate(
  country: string,
  totalAttempts: number,
  failedAttempts: number
): Promise<void> {
  if (totalAttempts < 10) return; // Need minimum sample size

  const failureRate = failedAttempts / totalAttempts;

  if (failureRate > env.SIRA_THRESHOLD_OTP_FAILURE_RATE) {
    await sendSIRASignal({
      signal_type: 'otp_anomaly',
      country_code: country,
      metadata: {
        total_attempts: totalAttempts,
        failed_attempts: failedAttempts,
        failure_rate: failureRate,
        threshold: env.SIRA_THRESHOLD_OTP_FAILURE_RATE,
      },
      severity: failureRate > 0.6 ? 'high' : 'medium',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Detect brute force attempts (multiple requests from same IP/identity)
 */
export async function detectBruteForce(
  identifier: string,
  attempts: number,
  timeWindow: number
): Promise<void> {
  const threshold = 10; // 10 attempts in time window

  if (attempts > threshold) {
    await sendSIRASignal({
      signal_type: 'brute_force_attempt',
      metadata: {
        identifier,
        attempts,
        time_window_seconds: timeWindow,
        threshold,
      },
      severity: attempts > 20 ? 'critical' : 'high',
      timestamp: new Date().toISOString(),
    });
  }
}
