/**
 * User Contacts Routes
 * GET /v1/profile/contacts - List contacts
 * POST /v1/profile/contacts - Add contact
 * DELETE /v1/profile/contacts/:id - Delete contact
 */

import { Router } from "express";
import { z } from "zod";
import { authMiddleware, logRequest } from "../util/auth";
import { requireAuth, AuthUser } from "../util/rbac";
import {
  asyncHandler,
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "../util/errors";
import { query, transaction } from "../util/pg";
import {
  getCachedUserContacts,
  cacheUserContacts,
  invalidateUserContactsCache,
} from "../util/redis";
import { emitContactAdded, emitContactDeleted } from "../util/events";
import { normalizePhoneE164 } from "../util/phone";

const router = Router();

/**
 * Validation schemas
 */
const contactSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .max(100)
    .describe("User-defined contact name"),
  channelType: z
    .enum(["molam_id", "phone", "email", "merchant", "agent"])
    .describe("Contact channel type"),
  channelValue: z.string().min(1).describe("Contact identifier"),
  countryCode: z
    .string()
    .length(3)
    .optional()
    .describe("ISO 3166-1 alpha-3 country code"),
  metadata: z.record(z.any()).optional().describe("Additional metadata"),
});

type ContactCreate = z.infer<typeof contactSchema>;

/**
 * GET /v1/profile/contacts
 * List user's favorite contacts
 */
router.get(
  "/v1/profile/contacts",
  authMiddleware,
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser;
    logRequest(req, { action: "list_contacts" });

    const query_text = (req.query.q as string) || null;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    // Try cache first (only for full list without filters)
    let contacts: any[] | null = null;

    if (!query_text) {
      contacts = await getCachedUserContacts(user.user_id);
    }

    if (!contacts) {
      // Fetch from database
      const result = await query(
        `
        SELECT
          c.id,
          c.display_name,
          c.channel_type,
          c.channel_value,
          c.country_code,
          c.contact_user_id,
          c.metadata,
          c.created_at,
          u.molam_id AS contact_molam_id,
          u.first_name AS contact_first_name,
          u.last_name AS contact_last_name
        FROM molam_user_contacts c
        LEFT JOIN molam_users u ON u.id = c.contact_user_id
        WHERE c.owner_user_id = $1
          AND ($2::TEXT IS NULL OR c.display_name ILIKE $3 OR c.channel_value ILIKE $3)
        ORDER BY c.display_name ASC
        LIMIT $4
      `,
        [user.user_id, query_text, query_text ? `%${query_text}%` : null, limit]
      );

      contacts = result.rows.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        channelType: row.channel_type,
        channelValue: row.channel_value,
        countryCode: row.country_code,
        metadata: row.metadata,
        createdAt: row.created_at,
        contactUser: row.contact_user_id
          ? {
              id: row.contact_user_id,
              molamId: row.contact_molam_id,
              firstName: row.contact_first_name,
              lastName: row.contact_last_name,
            }
          : null,
      }));

      // Cache if no filters
      if (!query_text) {
        await cacheUserContacts(user.user_id, contacts);
      }
    }

    res.json({
      contacts,
      total: contacts.length,
    });
  })
);

/**
 * POST /v1/profile/contacts
 * Add a new favorite contact
 */
router.post(
  "/v1/profile/contacts",
  authMiddleware,
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser;
    logRequest(req, { action: "add_contact" });

    // Validate input
    const input = contactSchema.parse(req.body);

    // Normalize channel value
    let normalizedValue = input.channelValue;
    let countryCode = input.countryCode || "SEN";

    if (input.channelType === "phone") {
      // Normalize to E.164
      const normalized = normalizePhoneE164(input.channelValue, countryCode);

      if (!normalized.valid) {
        throw new BadRequestError(
          normalized.error || "Invalid phone number"
        );
      }

      normalizedValue = normalized.e164!;
      countryCode = normalized.country_code!;
    } else if (input.channelType === "email") {
      // Normalize email to lowercase
      normalizedValue = input.channelValue.toLowerCase().trim();

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedValue)) {
        throw new BadRequestError("Invalid email address");
      }
    } else if (input.channelType === "molam_id") {
      // Validate molam_id format (e.g., @username or UUID)
      normalizedValue = input.channelValue.toLowerCase().trim();
    }

    let contactId = "";
    let contactUserId: string | null = null;

    await transaction(async (client) => {
      // Check for duplicates
      const existing = await client.query(
        `
        SELECT id FROM molam_user_contacts
        WHERE owner_user_id = $1
          AND channel_type = $2
          AND channel_value = $3
      `,
        [user.user_id, input.channelType, normalizedValue]
      );

      if (existing.rows.length > 0) {
        throw new ConflictError("Contact already exists");
      }

      // Resolve contact_user_id
      if (input.channelType === "molam_id") {
        const resolved = await client.query(
          `SELECT id FROM molam_users WHERE molam_id = $1`,
          [normalizedValue]
        );
        contactUserId = resolved.rows[0]?.id || null;
      } else if (input.channelType === "phone") {
        const resolved = await client.query(
          `SELECT id FROM molam_users WHERE phone_e164 = $1`,
          [normalizedValue]
        );
        contactUserId = resolved.rows[0]?.id || null;
      } else if (input.channelType === "email") {
        const resolved = await client.query(
          `SELECT id FROM molam_users WHERE LOWER(email) = $1`,
          [normalizedValue]
        );
        contactUserId = resolved.rows[0]?.id || null;
      }

      // Insert contact
      const result = await client.query(
        `
        INSERT INTO molam_user_contacts (
          owner_user_id,
          contact_user_id,
          display_name,
          channel_type,
          channel_value,
          country_code,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `,
        [
          user.user_id,
          contactUserId,
          input.displayName,
          input.channelType,
          normalizedValue,
          countryCode,
          JSON.stringify(input.metadata || {}),
        ]
      );

      contactId = result.rows[0].id;

      // Audit log
      await client.query(
        `
        INSERT INTO molam_audit_logs (
          user_id, action, resource_type, resource_id, metadata, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          user.user_id,
          "contact.add",
          "contact",
          contactId,
          JSON.stringify({
            channel_type: input.channelType,
            channel_value: normalizedValue,
            display_name: input.displayName,
          }),
          req.ip,
        ]
      );
    });

    // Invalidate cache
    await invalidateUserContactsCache(user.user_id);

    // Emit event
    await emitContactAdded(
      user.user_id,
      {
        id: contactId,
        channel_type: input.channelType,
        channel_value: normalizedValue,
        display_name: input.displayName,
      },
      req.requestId
    );

    res.status(201).json({
      success: true,
      message: "Contact added",
      contact: {
        id: contactId,
        displayName: input.displayName,
        channelType: input.channelType,
        channelValue: normalizedValue,
        countryCode,
        contactUserId,
      },
    });
  })
);

/**
 * DELETE /v1/profile/contacts/:id
 * Delete a favorite contact
 */
router.delete(
  "/v1/profile/contacts/:id",
  authMiddleware,
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user as AuthUser;
    const contactId = req.params.id;
    logRequest(req, { action: "delete_contact", contact_id: contactId });

    await transaction(async (client) => {
      // Verify ownership
      const existing = await client.query(
        `
        SELECT id, display_name, channel_type, channel_value
        FROM molam_user_contacts
        WHERE id = $1 AND owner_user_id = $2
      `,
        [contactId, user.user_id]
      );

      if (existing.rows.length === 0) {
        throw new NotFoundError("Contact not found");
      }

      const contact = existing.rows[0];

      // Delete contact
      await client.query(
        `DELETE FROM molam_user_contacts WHERE id = $1`,
        [contactId]
      );

      // Audit log
      await client.query(
        `
        INSERT INTO molam_audit_logs (
          user_id, action, resource_type, resource_id, metadata, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          user.user_id,
          "contact.delete",
          "contact",
          contactId,
          JSON.stringify({
            channel_type: contact.channel_type,
            channel_value: contact.channel_value,
            display_name: contact.display_name,
          }),
          req.ip,
        ]
      );
    });

    // Invalidate cache
    await invalidateUserContactsCache(user.user_id);

    // Emit event
    await emitContactDeleted(user.user_id, contactId, req.requestId);

    res.json({
      success: true,
      message: "Contact deleted",
    });
  })
);

export default router;
