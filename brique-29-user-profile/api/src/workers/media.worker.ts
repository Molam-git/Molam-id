// brique-29-user-profile/api/src/workers/media.worker.ts
// Async media processing worker for image resizing, thumbnails, optimization

import { Pool } from 'pg';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { Readable } from 'stream';

// =====================================================
// TYPES
// =====================================================

interface MediaAsset {
  asset_id: string;
  user_id: string;
  s3_bucket: string;
  s3_key: string;
  s3_region?: string;
  file_name: string;
  mime_type: string;
  media_type: string;
  processing_status: string;
}

interface ProcessingVariant {
  name: string;
  width: number;
  height?: number;
  fit: 'cover' | 'contain' | 'fill';
  quality?: number;
}

interface ProcessingResult {
  success: boolean;
  variants?: Record<string, any>;
  error?: string;
}

// =====================================================
// CONFIGURATION
// =====================================================

const VARIANTS: Record<string, ProcessingVariant[]> = {
  avatar: [
    { name: 'thumbnail', width: 64, height: 64, fit: 'cover', quality: 85 },
    { name: 'small', width: 150, height: 150, fit: 'cover', quality: 85 },
    { name: 'medium', width: 300, height: 300, fit: 'cover', quality: 90 }
  ],
  banner: [
    { name: 'thumbnail', width: 400, height: 150, fit: 'cover', quality: 85 },
    { name: 'medium', width: 800, height: 300, fit: 'cover', quality: 90 },
    { name: 'large', width: 1600, height: 600, fit: 'cover', quality: 90 }
  ],
  attachment: [
    { name: 'thumbnail', width: 200, height: 200, fit: 'contain', quality: 85 },
    { name: 'preview', width: 800, fit: 'contain', quality: 90 }
  ]
};

// =====================================================
// S3 CLIENT
// =====================================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

// =====================================================
// MEDIA PROCESSOR
// =====================================================

export class MediaProcessor {
  constructor(private pool: Pool) {}

  /**
   * Process a single media asset
   */
  async processAsset(assetId: string): Promise<ProcessingResult> {
    try {
      console.log(`[MediaProcessor] Processing asset ${assetId}`);

      // Get asset from database
      const asset = await this.getAsset(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Update status to processing
      await this.updateProcessingStatus(assetId, 'processing');

      // Download from S3
      const imageBuffer = await this.downloadFromS3(asset);

      // Get variants configuration
      const variantsConfig = VARIANTS[asset.media_type] || VARIANTS.attachment;

      // Process variants
      const variants: Record<string, any> = {};

      for (const variantConfig of variantsConfig) {
        console.log(`[MediaProcessor] Generating variant: ${variantConfig.name}`);

        const processedBuffer = await this.generateVariant(imageBuffer, variantConfig);

        // Upload variant to S3
        const variantKey = this.getVariantKey(asset.s3_key, variantConfig.name);
        await this.uploadToS3(asset.s3_bucket, variantKey, processedBuffer, asset.mime_type);

        // Store variant info
        variants[variantConfig.name] = {
          s3_key: variantKey,
          width: variantConfig.width,
          height: variantConfig.height,
          size_bytes: processedBuffer.length
        };
      }

      // Update asset with variants
      await this.updateProcessingStatus(assetId, 'completed', undefined, variants);

      console.log(`[MediaProcessor] Successfully processed asset ${assetId}`);

      return {
        success: true,
        variants
      };
    } catch (error: any) {
      console.error(`[MediaProcessor] Failed to process asset ${assetId}:`, error);

      await this.updateProcessingStatus(assetId, 'failed', error.message);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get asset from database
   */
  private async getAsset(assetId: string): Promise<MediaAsset | null> {
    const result = await this.pool.query(
      'SELECT * FROM molam_media_assets WHERE asset_id = $1 AND deleted_at IS NULL',
      [assetId]
    );

    return result.rows[0] || null;
  }

  /**
   * Update processing status
   */
  private async updateProcessingStatus(
    assetId: string,
    status: string,
    error?: string,
    variants?: Record<string, any>
  ): Promise<void> {
    const fields: string[] = ['processing_status = $2'];
    const values: any[] = [assetId, status];
    let paramIndex = 3;

    if (error !== undefined) {
      fields.push(`processing_error = $${paramIndex++}`);
      values.push(error);
    }

    if (variants !== undefined) {
      fields.push(`variants = $${paramIndex++}`);
      values.push(JSON.stringify(variants));
    }

    await this.pool.query(
      `UPDATE molam_media_assets SET ${fields.join(', ')}, updated_at = NOW() WHERE asset_id = $1`,
      values
    );
  }

  /**
   * Download image from S3
   */
  private async downloadFromS3(asset: MediaAsset): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: asset.s3_bucket,
      Key: asset.s3_key
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('Empty S3 response body');
    }

    // Convert stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Upload image to S3
   */
  private async uploadToS3(
    bucket: string,
    key: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000' // 1 year cache for variants
    });

    await s3Client.send(command);
  }

  /**
   * Generate image variant using sharp
   */
  private async generateVariant(
    imageBuffer: Buffer,
    config: ProcessingVariant
  ): Promise<Buffer> {
    let pipeline = sharp(imageBuffer);

    // Resize
    pipeline = pipeline.resize({
      width: config.width,
      height: config.height,
      fit: config.fit,
      withoutEnlargement: true
    });

    // Format conversion and quality
    pipeline = pipeline.jpeg({
      quality: config.quality || 85,
      mozjpeg: true
    });

    return pipeline.toBuffer();
  }

  /**
   * Get variant S3 key
   */
  private getVariantKey(originalKey: string, variantName: string): string {
    const parts = originalKey.split('.');
    const extension = parts.pop();
    const basePath = parts.join('.');

    return `${basePath}_${variantName}.${extension}`;
  }
}

// =====================================================
// WORKER (Queue Consumer)
// =====================================================

export class MediaWorker {
  private processor: MediaProcessor;
  private isRunning: boolean = false;
  private pollInterval: number = 5000; // 5 seconds

  constructor(private pool: Pool) {
    this.processor = new MediaProcessor(pool);
  }

  /**
   * Start the worker
   * In production, this would consume from SQS/RabbitMQ
   * For demo, we poll the database for pending assets
   */
  start(): void {
    if (this.isRunning) {
      console.log('[MediaWorker] Already running');
      return;
    }

    console.log('[MediaWorker] Starting worker...');
    this.isRunning = true;
    this.poll();
  }

  /**
   * Stop the worker
   */
  stop(): void {
    console.log('[MediaWorker] Stopping worker...');
    this.isRunning = false;
  }

  /**
   * Poll for pending assets
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        const pendingAssets = await this.getPendingAssets();

        if (pendingAssets.length > 0) {
          console.log(`[MediaWorker] Found ${pendingAssets.length} pending assets`);

          for (const asset of pendingAssets) {
            await this.processor.processAsset(asset.asset_id);
          }
        }
      } catch (error) {
        console.error('[MediaWorker] Poll error:', error);
      }

      // Wait before next poll
      await this.sleep(this.pollInterval);
    }

    console.log('[MediaWorker] Worker stopped');
  }

  /**
   * Get pending assets from database
   */
  private async getPendingAssets(): Promise<MediaAsset[]> {
    const result = await this.pool.query(
      `SELECT * FROM molam_media_assets
       WHERE processing_status = 'pending'
         AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 10`
    );

    return result.rows;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =====================================================
// SQS WORKER (Production-ready)
// =====================================================

/*
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

export class MediaWorkerSQS {
  private processor: MediaProcessor;
  private sqsClient: SQSClient;
  private queueUrl: string;
  private isRunning: boolean = false;

  constructor(private pool: Pool, queueUrl: string) {
    this.processor = new MediaProcessor(pool);
    this.queueUrl = queueUrl;
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('[MediaWorkerSQS] Starting SQS consumer...');
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
              const assetId = body.asset_id;

              if (assetId) {
                await this.processor.processAsset(assetId);

                // Delete message from queue
                await this.sqsClient.send(new DeleteMessageCommand({
                  QueueUrl: this.queueUrl,
                  ReceiptHandle: message.ReceiptHandle
                }));
              }
            } catch (error) {
              console.error('[MediaWorkerSQS] Message processing error:', error);
            }
          }
        }
      } catch (error) {
        console.error('[MediaWorkerSQS] SQS error:', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  stop(): void {
    console.log('[MediaWorkerSQS] Stopping SQS consumer...');
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

  const worker = new MediaWorker(pool);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[MediaWorker] Received SIGINT, shutting down...');
    worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[MediaWorker] Received SIGTERM, shutting down...');
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
// node media.worker.js

// Or integrate into your application:
import { Pool } from 'pg';
import { MediaWorker } from './workers/media.worker';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const worker = new MediaWorker(pool);
worker.start();

// Stop worker
process.on('SIGINT', () => {
  worker.stop();
  process.exit(0);
});
*/
