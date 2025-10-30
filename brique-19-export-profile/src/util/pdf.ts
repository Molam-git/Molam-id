/**
 * PDF Renderer for Export
 * Uses PDFKit to generate GDPR-compliant export PDFs
 */

import PDFDocument from "pdfkit";
import { t, isRTL } from "./i18n";

export interface ExportData {
  profile: any;
  contacts: any[];
  events: any[];
  sessions: any[];
}

/**
 * Render export data as PDF buffer
 */
export async function renderPdfBuffer(
  exportId: string,
  locale: string,
  data: ExportData
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        info: {
          Title: t(locale, "export.title"),
          Author: "Molam ID",
          Subject: t(locale, "export.subtitle"),
          Creator: "Molam ID Export Service",
        },
      });

      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(t(locale, "export.heading"), { align: isRTL(locale) ? "right" : "left" });

      doc
        .fontSize(12)
        .font("Helvetica")
        .text(t(locale, "export.subtitle"), { align: isRTL(locale) ? "right" : "left" });

      doc.moveDown();

      // Metadata
      doc
        .fontSize(10)
        .text(`${t(locale, "export.generatedAt")}: ${new Date().toISOString()}`);
      doc.text(`${t(locale, "export.exportId")}: ${exportId}`);
      doc.text(`${t(locale, "export.locale")}: ${locale}`);

      doc.moveDown(2);

      // Section 1: Profile
      renderSection(
        doc,
        locale,
        t(locale, "export.section.profile"),
        renderProfile(doc, locale, data.profile)
      );

      // Section 2: Contacts
      renderSection(
        doc,
        locale,
        t(locale, "export.section.contacts"),
        renderContacts(doc, locale, data.contacts)
      );

      // Section 3: Events
      renderSection(
        doc,
        locale,
        t(locale, "export.section.events"),
        renderEvents(doc, locale, data.events)
      );

      // Section 4: Sessions
      renderSection(
        doc,
        locale,
        t(locale, "export.section.sessions"),
        renderSessions(doc, locale, data.sessions)
      );

      // Footer on all pages
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .text(
            `${t(locale, "export.footer.page")} ${i + 1} / ${pages.count}`,
            50,
            doc.page.height - 50,
            { align: "center" }
          );
        doc.text(t(locale, "export.footer.gdpr"), 50, doc.page.height - 35, {
          align: "center",
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Render a section with title
 */
function renderSection(
  doc: PDFKit.PDFDocument,
  locale: string,
  title: string,
  contentFn: () => void
): void {
  doc
    .addPage()
    .fontSize(16)
    .font("Helvetica-Bold")
    .text(title, { underline: true });

  doc.moveDown();

  contentFn();
}

/**
 * Render profile section
 */
function renderProfile(
  doc: PDFKit.PDFDocument,
  locale: string,
  profile: any
): () => void {
  return () => {
    if (!profile || Object.keys(profile).length === 0) {
      doc.fontSize(10).text(t(locale, "export.noData"));
      return;
    }

    doc.fontSize(10).font("Helvetica");

    const fields = [
      { key: "molam_id", label: t(locale, "export.profile.molamId") },
      { key: "email", label: t(locale, "export.profile.email") },
      { key: "phone_e164", label: t(locale, "export.profile.phone") },
      {
        key: "first_name",
        label: t(locale, "export.profile.name"),
        transform: (p: any) => `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      },
      {
        key: "preferred_language",
        label: t(locale, "export.profile.language"),
      },
      {
        key: "preferred_currency",
        label: t(locale, "export.profile.currency"),
      },
      { key: "timezone", label: t(locale, "export.profile.timezone") },
      { key: "date_format", label: t(locale, "export.profile.dateFormat") },
      {
        key: "number_format",
        label: t(locale, "export.profile.numberFormat"),
      },
      { key: "theme", label: t(locale, "export.profile.theme") },
      {
        key: "notifications",
        label: t(locale, "export.profile.notifications"),
        transform: (p: any) =>
          JSON.stringify({
            email: p.notify_email,
            sms: p.notify_sms,
            push: p.notify_push,
          }),
      },
      {
        key: "user_created_at",
        label: t(locale, "export.profile.createdAt"),
      },
      {
        key: "preferences_updated_at",
        label: t(locale, "export.profile.updatedAt"),
      },
    ];

    fields.forEach((field) => {
      const value = field.transform
        ? field.transform(profile)
        : profile[field.key];
      if (value !== null && value !== undefined && value !== "") {
        doc.text(`${field.label}: ${value}`, { indent: 20 });
      }
    });
  };
}

/**
 * Render contacts section
 */
function renderContacts(
  doc: PDFKit.PDFDocument,
  locale: string,
  contacts: any[]
): () => void {
  return () => {
    if (!contacts || contacts.length === 0) {
      doc.fontSize(10).text(t(locale, "export.noData"));
      return;
    }

    doc.fontSize(10).font("Helvetica");

    contacts.slice(0, 100).forEach((contact, index) => {
      doc
        .font("Helvetica-Bold")
        .text(`${index + 1}. ${contact.display_name || "N/A"}`);
      doc.font("Helvetica");
      doc.text(
        `   ${t(locale, "export.contacts.channelType")}: ${contact.channel_type}`,
        { indent: 20 }
      );
      doc.text(
        `   ${t(locale, "export.contacts.channelValue")}: ${contact.channel_value}`,
        { indent: 20 }
      );
      if (contact.country_code) {
        doc.text(
          `   ${t(locale, "export.contacts.countryCode")}: ${contact.country_code}`,
          { indent: 20 }
        );
      }
      doc.text(
        `   ${t(locale, "export.contacts.createdAt")}: ${contact.created_at}`,
        { indent: 20 }
      );
      doc.moveDown(0.5);
    });

    if (contacts.length > 100) {
      doc
        .font("Helvetica-Oblique")
        .text(`... ${contacts.length - 100} more contacts (see JSON export)`);
    }
  };
}

/**
 * Render events section
 */
function renderEvents(
  doc: PDFKit.PDFDocument,
  locale: string,
  events: any[]
): () => void {
  return () => {
    if (!events || events.length === 0) {
      doc.fontSize(10).text(t(locale, "export.noData"));
      return;
    }

    doc.fontSize(10).font("Helvetica");

    events.slice(0, 50).forEach((event, index) => {
      doc
        .font("Helvetica-Bold")
        .text(`${index + 1}. ${event.action || "N/A"}`);
      doc.font("Helvetica");
      doc.text(
        `   ${t(locale, "export.events.timestamp")}: ${event.created_at}`,
        { indent: 20 }
      );
      if (event.resource_type) {
        doc.text(
          `   ${t(locale, "export.events.resource")}: ${event.resource_type}`,
          { indent: 20 }
        );
      }
      if (event.ip_address) {
        doc.text(
          `   ${t(locale, "export.events.ipAddress")}: ${event.ip_address}`,
          { indent: 20 }
        );
      }
      doc.moveDown(0.5);
    });

    if (events.length > 50) {
      doc
        .font("Helvetica-Oblique")
        .text(`... ${events.length - 50} more events (see JSON export)`);
    }
  };
}

/**
 * Render sessions section
 */
function renderSessions(
  doc: PDFKit.PDFDocument,
  locale: string,
  sessions: any[]
): () => void {
  return () => {
    if (!sessions || sessions.length === 0) {
      doc.fontSize(10).text(t(locale, "export.noData"));
      return;
    }

    doc.fontSize(10).font("Helvetica");

    sessions.forEach((session, index) => {
      doc
        .font("Helvetica-Bold")
        .text(`${index + 1}. ${session.device_name || "Unknown Device"}`);
      doc.font("Helvetica");
      doc.text(
        `   ${t(locale, "export.sessions.ipAddress")}: ${session.ip_address || "N/A"}`,
        { indent: 20 }
      );
      doc.text(
        `   ${t(locale, "export.sessions.startedAt")}: ${session.session_started_at}`,
        { indent: 20 }
      );
      doc.text(
        `   ${t(locale, "export.sessions.lastActivity")}: ${session.last_activity_at}`,
        { indent: 20 }
      );
      doc.text(
        `   ${t(locale, "export.sessions.expiresAt")}: ${session.session_expires_at}`,
        { indent: 20 }
      );
      doc.moveDown(0.5);
    });
  };
}
