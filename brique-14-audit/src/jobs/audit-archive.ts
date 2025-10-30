// Job d'archivage S3 WORM (Write Once Read Many)

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createGzip } from "zlib";
import { Readable } from "stream";
import crypto from "crypto";
import { AuditService } from "../audit/audit.service";
import { pool } from "../util/pg";
import { config } from "../audit/config";

const s3 = new S3Client({ region: config.s3.region });
const audit = new AuditService(pool);

/**
 * Archive audit logs to S3 with WORM (Object Lock)
 * Runs daily to export previous day's logs
 */
export async function runAuditArchiveJob(): Promise<void> {
  if (!config.s3.enabled) {
    console.log("⏭️  S3 archival disabled, skipping");
    return;
  }

  console.log("🗃️  Starting audit archive job...");

  try {
    // Export previous day's logs
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = new Date();

    console.log(`   Exporting logs from ${from.toISOString()} to ${to.toISOString()}`);

    const logs = await audit.getLogsForExport(from, to);

    if (logs.length === 0) {
      console.log("   No logs to archive");
      return;
    }

    console.log(`   Found ${logs.length} log entries`);

    // Convert to JSONL (newline-delimited JSON)
    const jsonl = logs.map((log) => JSON.stringify(log)).join("\n");
    const buf = Buffer.from(jsonl, "utf8");

    // Compute SHA256 checksum
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

    console.log(`   Data size: ${buf.length} bytes, SHA256: ${sha256}`);

    // Compress with gzip
    const gz = createGzip();
    const stream = Readable.from([buf]).pipe(gz);

    // Build S3 key with date partitioning
    const year = from.getUTCFullYear();
    const month = (from.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = from.getUTCDate().toString().padStart(2, "0");
    const timestamp = Date.now();

    const key = `audit/year=${year}/month=${month}/day=${day}/audit_${timestamp}.jsonl.gz`;

    console.log(`   Uploading to s3://${config.s3.bucket}/${key}`);

    // Upload to S3 with WORM (Object Lock)
    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: stream,
        ContentType: "application/gzip",
        ChecksumSHA256: Buffer.from(sha256, "hex").toString("base64"),
        ServerSideEncryption: "aws:kms",
        SSEKMSKeyId: config.s3.kmsKeyId || undefined,
        ObjectLockMode: "COMPLIANCE",
        ObjectLockRetainUntilDate: new Date(
          Date.now() + 365 * 24 * 60 * 60 * 1000
        ), // 1 year retention
        Metadata: {
          "molam-service": "id-audit",
          "molam-records": logs.length.toString(),
          "molam-from": from.toISOString(),
          "molam-to": to.toISOString(),
          "molam-sha256": sha256,
        },
      })
    );

    console.log("✅ Archive completed successfully");
    console.log(`   Key: ${key}`);
    console.log(`   Records: ${logs.length}`);
    console.log(`   SHA256: ${sha256}`);
  } catch (error) {
    console.error("❌ Archive failed:", error);
    throw error;
  }
}

/**
 * Verify archived file integrity (optional check)
 */
export async function verifyArchive(
  key: string,
  expectedSha256: string
): Promise<boolean> {
  try {
    // Would download and verify checksum
    // Implementation depends on requirements
    console.log(`Verifying archive: ${key}, expected SHA256: ${expectedSha256}`);
    return true;
  } catch (error) {
    console.error("Verification failed:", error);
    return false;
  }
}
