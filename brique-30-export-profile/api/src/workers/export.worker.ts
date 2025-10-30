// brique-30-export-profile/api/src/workers/export.worker.ts
// Worker for async processing of profile exports

import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { ExportService } from '../services/export/export.service';

// =====================================================
// CONFIGURATION
// =====================================================

const WORKER_CONFIG = {
  pollInterval: 5000, // 5 seconds
  batchSize: 5, // Process 5 exports at a time
  maxRetries: 3,
  cleanupInterval: 60 * 60 * 1000, // 1 hour
};

// =====================================================
// EXPORT WORKER
// =====================================================

export class ExportWorker {
  private exportService: ExportService;
  private isRunning: boolean = false;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private pool: Pool,
    private s3Client: S3Client,
    private config: {
      exportSecret: string;
      s3Bucket: string;
    }
  ) {
    this.exportService = new ExportService(pool, s3Client, config);
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) {
      console.log('[ExportWorker] Already running');
      return;
    }

    console.log('[ExportWorker] Starting export worker...');
    this.isRunning = true;

    // Start polling for pending exports
    this.poll();

    // Start cleanup job
    this.startCleanupJob();
  }

  /**
   * Stop the worker
   */
  stop(): void {
    console.log('[ExportWorker] Stopping export worker...');
    this.isRunning = false;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Poll for pending exports
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processBatch();
      } catch (error) {
        console.error('[ExportWorker] Poll error:', error);
      }

      // Wait before next poll
      await this.sleep(WORKER_CONFIG.pollInterval);
    }

    console.log('[ExportWorker] Worker stopped');
  }

  /**
   * Process a batch of pending exports
   */
  private async processBatch(): Promise<void> {
    // Get pending exports
    const result = await this.pool.query(
      `SELECT * FROM get_pending_exports($1)`,
      [WORKER_CONFIG.batchSize]
    );

    const pendingExports = result.rows;

    if (pendingExports.length === 0) {
      return; // No exports to process
    }

    console.log(`[ExportWorker] Processing ${pendingExports.length} export(s)`);

    // Process exports concurrently
    const promises = pendingExports.map((exp) =>
      this.processExportSafely(exp.export_id)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Process a single export with error handling
   */
  private async processExportSafely(exportId: number): Promise<void> {
    try {
      await this.exportService.processExport(exportId);
    } catch (error) {
      console.error(`[ExportWorker] Failed to process export ${exportId}:`, error);
    }
  }

  /**
   * Start cleanup job (runs periodically)
   */
  private startCleanupJob(): void {
    console.log('[ExportWorker] Starting cleanup job (runs every hour)');

    this.cleanupTimer = setInterval(async () => {
      try {
        const count = await this.exportService.cleanupExpiredExports();
        if (count > 0) {
          console.log(`[ExportWorker] Cleanup job: Marked ${count} exports as expired`);
        }
      } catch (error) {
        console.error('[ExportWorker] Cleanup job error:', error);
      }
    }, WORKER_CONFIG.cleanupInterval);

    // Run cleanup immediately on start
    this.exportService.cleanupExpiredExports().catch((error) => {
      console.error('[ExportWorker] Initial cleanup error:', error);
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =====================================================
// SQS WORKER (Production-ready alternative)
// =====================================================

/*
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

export class ExportWorkerSQS {
  private exportService: ExportService;
  private sqsClient: SQSClient;
  private queueUrl: string;
  private isRunning: boolean = false;

  constructor(
    pool: Pool,
    s3Client: S3Client,
    config: {
      exportSecret: string;
      s3Bucket: string;
      sqsQueueUrl: string;
    }
  ) {
    this.exportService = new ExportService(pool, s3Client, config);
    this.queueUrl = config.sqsQueueUrl;
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('[ExportWorkerSQS] Starting SQS consumer...');
    this.isRunning = true;

    while (this.isRunning) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // Long polling
          VisibilityTimeout: 300 // 5 minutes
        });

        const response = await this.sqsClient.send(command);

        if (response.Messages && response.Messages.length > 0) {
          for (const message of response.Messages) {
            try {
              const body = JSON.parse(message.Body || '{}');
              const exportId = body.export_id;

              if (exportId) {
                await this.exportService.processExport(exportId);

                // Delete message from queue
                await this.sqsClient.send(new DeleteMessageCommand({
                  QueueUrl: this.queueUrl,
                  ReceiptHandle: message.ReceiptHandle
                }));

                console.log(`[ExportWorkerSQS] Processed export ${exportId}`);
              }
            } catch (error) {
              console.error('[ExportWorkerSQS] Message processing error:', error);
            }
          }
        }
      } catch (error) {
        console.error('[ExportWorkerSQS] SQS error:', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  stop(): void {
    console.log('[ExportWorkerSQS] Stopping SQS consumer...');
    this.isRunning = false;
  }
}
*/

// =====================================================
// CLI ENTRY POINT
// =====================================================

if (require.main === module) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    }
  });

  const worker = new ExportWorker(pool, s3Client, {
    exportSecret: process.env.EXPORT_SECRET || 'change-me-in-production',
    s3Bucket: process.env.EXPORT_BUCKET || 'molam-exports'
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[ExportWorker] Received SIGINT, shutting down...');
    worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[ExportWorker] Received SIGTERM, shutting down...');
    worker.stop();
    process.exit(0);
  });

  worker.start();
}

// =====================================================
// EXAMPLE USAGE
// =====================================================

/*
// Start worker as a standalone process:
// node export.worker.js

// Or integrate into your application:
import { Pool } from 'pg';
import { S3Client } from '@aws-sdk/client-s3';
import { ExportWorker } from './workers/export.worker';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION
});

const worker = new ExportWorker(pool, s3Client, {
  exportSecret: process.env.EXPORT_SECRET!,
  s3Bucket: process.env.EXPORT_BUCKET!
});

worker.start();

// Stop worker on shutdown
process.on('SIGINT', () => {
  worker.stop();
  process.exit(0);
});
*/
