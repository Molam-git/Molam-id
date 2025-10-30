// src/server.ts
import app from './app.js';
import { env } from './config/env.js';
import { testConnection } from './services/db.js';
import { connectRedis } from './services/redis.js';
import { initEvents, closeEvents } from './services/events.js';

async function start() {
  try {
    // Test database connection
    await testConnection();

    // Connect to Redis
    await connectRedis();

    // Initialize event systems (Kafka/AMQP)
    await initEvents();

    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      console.log('');
      console.log('🚀 Molam ID - Password & PIN Reset Service');
      console.log(`📍 Port: ${env.PORT}`);
      console.log(`🌍 Languages: fr, en, wo, ar, sw, ha`);
      console.log(`🔒 Security: Argon2id + pepper, rate limiting, audit logs`);
      console.log(`📊 Metrics: http://localhost:${env.PORT}/metrics`);
      console.log(`❤️  Health: http://localhost:${env.PORT}/health`);
      console.log('');
      console.log('Endpoints:');
      console.log('  POST /api/id/password/forgot');
      console.log('  POST /api/id/password/verify');
      console.log('  POST /api/id/password/confirm');
      console.log('  POST /api/id/ussd/pin/reset/start');
      console.log('  POST /api/id/ussd/pin/reset/verify');
      console.log('  POST /api/id/ussd/pin/reset/confirm');
      console.log('  POST /api/id/ussd (webhook)');
      console.log('');
      console.log('USSD codes:');
      console.log('  *131#     - Main menu');
      console.log('  *131*1#   - Balance');
      console.log('  *131*2#   - Top-up');
      console.log('  *131*3#   - Transfer');
      console.log('  *131*99#  - PIN reset');
      console.log('');

      if (env.KAFKA_ENABLED) {
        console.log('✓ Kafka events enabled');
      }
      if (env.AMQP_ENABLED) {
        console.log('✓ AMQP events enabled');
      }
      if (env.SIRA_ENABLED) {
        console.log('✓ SIRA risk analysis enabled');
      }
      console.log('');
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n⏳ Shutting down gracefully...');

      server.close(async () => {
        console.log('✓ HTTP server closed');

        // Close event connections
        await closeEvents();
        console.log('✓ Event connections closed');

        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
