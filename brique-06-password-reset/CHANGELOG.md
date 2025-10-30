# Brique 6 - Changelog

## Version 2.0.0 (2025-10-27) - TypeScript Upgrade

### Major Changes

**Migration to TypeScript**
- ✅ Complete TypeScript 5.3 implementation
- ✅ Type-safe code with strict mode
- ✅ Better IDE support and autocomplete
- ✅ Reduced runtime errors

**New Features**

1. **SIRA Integration**
   - Risk signal webhooks
   - OTP anomaly detection (>40% failure rate)
   - Brute force attempt detection
   - Suspicious reset pattern analysis

2. **Event Publishing**
   - Kafka integration for domain events
   - RabbitMQ/AMQP support (alternative)
   - Events: `id.password.reset.completed`, `id.ussd.pin.reset.completed`

3. **Prometheus Metrics**
   - 9 custom metrics for observability
   - Request duration histograms
   - OTP failure tracking by country
   - Rate limiting counters

4. **Enhanced USSD**
   - Complete menu system (*131#)
   - Balance check (*131*1#) - stub for future wallet integration
   - Top-up (*131*2#) - stub
   - Transfer (*131*3#) - stub
   - PIN reset (*131*99#) - fully implemented

5. **Better Code Organization**
   - Separate routers (password.ts, pin.ts, ussd.ts)
   - Dedicated services (db, redis, otp, notifications, sessions, events, sira, metrics)
   - Middleware for rate limiting and metrics
   - Zod validation for type safety

### Files Created/Modified

**Configuration:**
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment template
- `DEPLOYMENT.md` - Deployment guide

**Source Code (TypeScript):**
- `src/config/env.ts` - Environment configuration
- `src/utils/crypto.ts` - Argon2id + pepper utilities
- `src/utils/phone.ts` - E.164 normalization, 50+ countries
- `src/utils/i18n.ts` - 6 languages (fr, en, wo, ar, sw, ha)
- `src/services/db.ts` - PostgreSQL pool
- `src/services/redis.ts` - Redis client
- `src/services/otp.service.ts` - OTP generation/verification
- `src/services/notifications.service.ts` - SMS/Email stubs
- `src/services/sessions.service.ts` - Session invalidation
- `src/services/metrics.ts` - Prometheus metrics
- `src/services/events.ts` - Kafka/AMQP publishers
- `src/services/sira.ts` - Risk analysis webhooks
- `src/middlewares/rateLimit.ts` - Sliding window rate limiter
- `src/middlewares/metrics.ts` - Request duration tracking
- `src/routes/password.ts` - Password reset endpoints
- `src/routes/pin.ts` - PIN reset endpoints (app/web)
- `src/routes/ussd.ts` - USSD webhook + menu system
- `src/app.ts` - Express application
- `src/server.ts` - Server entry point

**Tests:**
- `test_brique6.ts` - 12 comprehensive tests

**Documentation:**
- `README.md` - Complete API documentation
- `DEPLOYMENT.md` - Production deployment guide
- `CHANGELOG.md` - This file

### Dependencies Added

**Runtime:**
- `typescript@5.3.3` - TypeScript compiler
- `kafkajs@2.2.4` - Kafka client
- `amqplib@0.10.3` - RabbitMQ client
- `prom-client@15.1.0` - Prometheus metrics

**Dev Dependencies:**
- `@types/node@20.10.5`
- `@types/express@4.17.21`
- `@types/cors@2.8.17`
- `@types/jsonwebtoken@9.0.5`
- `@types/pg@8.10.9`
- `@types/amqplib@0.10.4`
- `tsx@4.7.0` - TypeScript executor

### Breaking Changes

- Service entry point changed: `src/server.js` → `dist/server.js`
- Build step now required: `npm run build`
- New environment variables: `KAFKA_ENABLED`, `AMQP_ENABLED`, `SIRA_ENABLED`

### Migration Guide

**From v1.0.0 to v2.0.0:**

1. Install new dependencies:
   ```bash
   npm install
   ```

2. Build TypeScript:
   ```bash
   npm run build
   ```

3. Update environment variables (optional):
   ```bash
   # Add to .env
   KAFKA_ENABLED=false
   AMQP_ENABLED=false
   SIRA_ENABLED=false
   METRICS_ENABLED=true
   ```

4. Start service:
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

### Performance Improvements

- Request duration tracking for bottleneck identification
- Metrics-driven optimization
- Better error handling with Zod validation
- Type safety reduces runtime errors

### Security Enhancements

- SIRA integration for anomaly detection
- Enhanced audit logging with correlation IDs
- Better rate limiting with metrics
- Comprehensive observability for security monitoring

## Version 1.0.0 (Previous) - JavaScript Implementation

**Initial Features:**
- Password reset (email/SMS)
- PIN reset (app/web + USSD)
- Multi-country support
- Multi-language (6 languages)
- Argon2id + pepper
- Rate limiting
- Audit logs
- Session invalidation

---

**Full specification implemented:** ✅

**Production ready:** ✅ (after configuring SMS/Email providers and infrastructure)

**Test coverage:** 12 tests covering all critical flows

**Documentation:** Complete (README.md, DEPLOYMENT.md)
