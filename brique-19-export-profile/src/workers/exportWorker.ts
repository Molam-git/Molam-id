/**
 * Export Worker
 * Background job processor for data exports
 */

import { v4 as uuid } from "uuid";
import { query, getClient } from "../util/pg";
import { putObject, signDownloadUrl } from "../util/storage";
import { renderPdfBuffer, ExportData } from "../util/pdf";
import { nowPlusMinutes } from "../util/time";
import { publishDomainEvent } from "../util/events";

/**
 * Fetch export data from database views
 */
async function fetchExportData(userId: string): Promise<ExportData> {
  // Fetch profile
  const profileResult = await query(
    `SELECT * FROM v_export_user_profile WHERE user_id = $1`,
    [userId]
  );

  // Fetch contacts
  const contactsResult = await query(
    `SELECT * FROM v_export_user_contacts WHERE user_id = $1 ORDER BY display_name ASC`,
    [userId]
  );

  // Fetch events (last 1000)
  const eventsResult = await query(
    `SELECT * FROM v_export_id_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000`,
    [userId]
  );

  // Fetch active sessions
  const sessionsResult = await query(
    `SELECT * FROM v_export_user_sessions WHERE user_id = $1 ORDER BY session_started_at DESC`,
    [userId]
  );

  return {
    profile: profileResult.rows[0] || {},
    contacts: contactsResult.rows || [],
    events: eventsResult.rows || [],
    sessions: sessionsResult.rows || [],
  };
}

/**
 * Process export job
 */
export async function processExportJob(exportId: string): Promise<void> {
  console.log(
    JSON.stringify({
      level: "info",
      message: "Processing export job",
      export_id: exportId,
    })
  );

  const client = await getClient();

  try {
    // Lock the job for processing
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT * FROM molam_exports WHERE id = $1 FOR UPDATE`,
      [exportId]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      console.error(
        JSON.stringify({
          level: "error",
          message: "Export job not found",
          export_id: exportId,
        })
      );
      return;
    }

    const job = rows[0];

    // Skip if not queued
    if (job.status !== "queued") {
      await client.query("ROLLBACK");
      console.log(
        JSON.stringify({
          level: "info",
          message: "Export job already processed",
          export_id: exportId,
          status: job.status,
        })
      );
      return;
    }

    // Update status to processing
    await client.query(
      `UPDATE molam_exports SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [exportId]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(
      JSON.stringify({
        level: "error",
        message: "Failed to lock export job",
        export_id: exportId,
        error: String(error),
      })
    );
    return;
  } finally {
    client.release();
  }

  // Fetch the job again (outside transaction)
  const { rows: jobRows } = await query(
    `SELECT * FROM molam_exports WHERE id = $1`,
    [exportId]
  );

  const job = jobRows[0];

  try {
    // Fetch data
    console.log(
      JSON.stringify({
        level: "info",
        message: "Fetching export data",
        export_id: exportId,
        user_id: job.user_id,
      })
    );

    const data = await fetchExportData(job.user_id);

    // Generate JSON
    const jsonKey = `exports/${job.user_id}/${exportId}.json`;
    const jsonData = {
      export_id: exportId,
      generated_at: new Date().toISOString(),
      locale: job.locale,
      data,
    };
    const jsonBuffer = Buffer.from(JSON.stringify(jsonData, null, 2));

    console.log(
      JSON.stringify({
        level: "info",
        message: "Uploading JSON to S3",
        export_id: exportId,
        key: jsonKey,
      })
    );

    await putObject(jsonKey, jsonBuffer, "application/json");

    // Generate PDF
    console.log(
      JSON.stringify({
        level: "info",
        message: "Generating PDF",
        export_id: exportId,
      })
    );

    const pdfBuffer = await renderPdfBuffer(exportId, job.locale, data);
    const pdfKey = `exports/${job.user_id}/${exportId}.pdf`;

    console.log(
      JSON.stringify({
        level: "info",
        message: "Uploading PDF to S3",
        export_id: exportId,
        key: pdfKey,
      })
    );

    await putObject(pdfKey, pdfBuffer, "application/pdf");

    // Generate signed URLs (15 min expiry)
    const expiresAt = nowPlusMinutes(15);
    const jsonUrl = await signDownloadUrl(jsonKey, expiresAt);
    const pdfUrl = await signDownloadUrl(pdfKey, expiresAt);

    console.log(
      JSON.stringify({
        level: "info",
        message: "Export ready",
        export_id: exportId,
      })
    );

    // Update job status to ready
    await query(
      `UPDATE molam_exports
       SET status = 'ready',
           json_object_key = $2,
           pdf_object_key = $3,
           signed_json_url = $4,
           signed_pdf_url = $5,
           expires_at = $6,
           updated_at = NOW()
       WHERE id = $1`,
      [exportId, jsonKey, pdfKey, jsonUrl, pdfUrl, expiresAt]
    );

    // Audit log
    await query(
      `INSERT INTO molam_audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        job.requested_by,
        "id.export.ready",
        "export",
        exportId,
        JSON.stringify({
          export_id: exportId,
          target_user_id: job.user_id,
        }),
      ]
    );

    // Emit webhook
    await publishDomainEvent(
      "id.export.ready",
      {
        export_id: exportId,
        user_id: job.user_id,
        json_url: jsonUrl,
        pdf_url: pdfUrl,
        expires_at: expiresAt.toISOString(),
      },
      { userId: job.user_id }
    );

    console.log(
      JSON.stringify({
        level: "info",
        message: "Export job completed",
        export_id: exportId,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Export job failed",
        export_id: exportId,
        error: String(error),
      })
    );

    // Update job status to failed
    await query(
      `UPDATE molam_exports
       SET status = 'failed',
           error = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [exportId, String(error)]
    );

    // Audit log
    await query(
      `INSERT INTO molam_audit_logs (user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        job.requested_by,
        "id.export.failed",
        "export",
        exportId,
        JSON.stringify({
          export_id: exportId,
          target_user_id: job.user_id,
          error: String(error),
        }),
      ]
    );
  }
}

/**
 * Poll for queued exports
 */
export async function pollExports(): Promise<void> {
  try {
    const result = await query(
      `SELECT id FROM molam_exports WHERE status = 'queued' ORDER BY created_at ASC LIMIT 10`
    );

    if (result.rows.length === 0) {
      return;
    }

    console.log(
      JSON.stringify({
        level: "info",
        message: "Found queued exports",
        count: result.rows.length,
      })
    );

    // Process exports sequentially
    for (const row of result.rows) {
      await processExportJob(row.id);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Failed to poll exports",
        error: String(error),
      })
    );
  }
}

/**
 * Start export worker
 */
export async function startExportWorker(): Promise<void> {
  console.log(
    JSON.stringify({
      level: "info",
      message: "Export worker started",
    })
  );

  // Poll every 10 seconds
  setInterval(async () => {
    await pollExports();
  }, 10000);
}
