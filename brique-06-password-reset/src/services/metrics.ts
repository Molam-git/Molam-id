// src/services/metrics.ts
import client from 'prom-client';
import { env } from '../config/env.js';

// Create a Registry
export const register = new client.Registry();

// Add default metrics (memory, CPU, etc.)
if (env.METRICS_ENABLED) {
  client.collectDefaultMetrics({ register });
}

// Custom metrics
export const metrics = {
  // Password reset requests
  passwordResetRequests: new client.Counter({
    name: 'molam_id_password_reset_requests_total',
    help: 'Total password reset requests',
    labelNames: ['country', 'channel'], // channel: email|sms
    registers: [register],
  }),

  passwordResetSuccess: new client.Counter({
    name: 'molam_id_password_reset_success_total',
    help: 'Total successful password resets',
    labelNames: ['country'],
    registers: [register],
  }),

  // PIN reset requests
  ussdPinResetRequests: new client.Counter({
    name: 'molam_id_ussd_pin_reset_requests_total',
    help: 'Total USSD PIN reset requests',
    labelNames: ['country', 'channel'], // channel: sms|ussd
    registers: [register],
  }),

  ussdPinResetSuccess: new client.Counter({
    name: 'molam_id_ussd_pin_reset_success_total',
    help: 'Total successful PIN resets',
    labelNames: ['country'],
    registers: [register],
  }),

  // OTP metrics
  otpGenerated: new client.Counter({
    name: 'molam_id_otp_generated_total',
    help: 'Total OTPs generated',
    labelNames: ['kind', 'country'], // kind: password|ussd_pin
    registers: [register],
  }),

  otpFailures: new client.Counter({
    name: 'molam_id_otp_failures_total',
    help: 'Total OTP verification failures',
    labelNames: ['kind', 'country', 'reason'], // reason: expired|invalid|max_attempts
    registers: [register],
  }),

  // Rate limiting
  rateLimited: new client.Counter({
    name: 'molam_id_rate_limited_total',
    help: 'Total rate-limited requests',
    labelNames: ['route'],
    registers: [register],
  }),

  // USSD webhook
  ussdRequests: new client.Counter({
    name: 'molam_id_ussd_requests_total',
    help: 'Total USSD webhook requests',
    labelNames: ['short_code', 'country'],
    registers: [register],
  }),

  // Request duration histogram
  requestDuration: new client.Histogram({
    name: 'molam_id_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5],
    registers: [register],
  }),
};
