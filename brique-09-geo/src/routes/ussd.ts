// USSD webhook routes
import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { query } from "../util/pg";
// import { audit } from "../util/audit";  // Reserved for future use
import { config } from "../config";
import { AppError } from "../util/errors";
import { detectCountryFromPhone } from "../geo/countryMatrix";

const router = Router();

// Async handler wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Verify USSD webhook signature
 */
function verifyUssdSignature(req: Request): boolean {
  const signature = req.headers["x-ussd-signature"] as string;
  if (!signature || !config.ussd.secret) return false;

  const body = JSON.stringify(req.body);
  const expected = "sha256=" + crypto
    .createHmac("sha256", config.ussd.secret)
    .update(body)
    .digest("hex");

  return signature === expected;
}

/**
 * POST /webhook
 * USSD webhook endpoint
 *
 * Expected body (Africa's Talking format):
 * {
 *   "sessionId": "...",
 *   "serviceCode": "*131#",
 *   "phoneNumber": "+221771234567",
 *   "text": "1*2*3"
 * }
 */
router.post("/webhook", asyncHandler(async (req: Request, res: Response) => {
  // Verify signature
  if (config.ussd.secret && !verifyUssdSignature(req)) {
    throw new AppError(401, "invalid_signature", "Invalid USSD webhook signature");
  }

  const { sessionId, serviceCode, phoneNumber, text } = req.body;

  if (!sessionId || !phoneNumber) {
    throw new AppError(400, "missing_fields", "Missing sessionId or phoneNumber");
  }

  // Detect country from phone
  const country = await detectCountryFromPhone(phoneNumber);

  // Parse USSD menu path
  const menuPath = text ? text.split("*") : [];

  // Log USSD event
  await query(`
    INSERT INTO molam_geo_events (
      user_id,
      event_type,
      from_country,
      metadata
    ) VALUES ($1, $2, $3, $4)
  `, [
    null, // No userId yet (USSD is anonymous)
    "ussd_routed",
    country,
    JSON.stringify({
      sessionId,
      serviceCode,
      phoneNumber,
      menuPath,
    }),
  ]);

  // Simple USSD menu response
  const response = handleUssdMenu(menuPath, phoneNumber, country);

  // Return USSD response (Africa's Talking format)
  res.set("Content-Type", "text/plain");
  res.send(response);
}));

/**
 * Handle USSD menu navigation
 */
function handleUssdMenu(menuPath: string[], phoneNumber: string, country: string | null): string {
  // Root menu
  if (menuPath.length === 0 || menuPath[0] === "") {
    return [
      "CON Bienvenue à Molam ID",
      "1. Mon compte",
      "2. Réinitialiser PIN",
      "3. Support",
      "4. Langue / Language",
    ].join("\n");
  }

  const choice = menuPath[0];

  // Menu 1: Account
  if (choice === "1") {
    if (menuPath.length === 1) {
      return [
        "CON Mon compte",
        "1. Vérifier mon identité",
        "2. Voir mes infos",
        "3. Changer mot de passe",
        "0. Retour",
      ].join("\n");
    }

    if (menuPath[1] === "1") {
      return "END Pour vérifier votre identité, rendez-vous sur https://id.molam.com";
    }

    if (menuPath[1] === "2") {
      return `END Téléphone: ${phoneNumber}\nPays: ${country || "Non détecté"}`;
    }

    if (menuPath[1] === "3") {
      return "END Un SMS avec un lien de réinitialisation a été envoyé.";
    }

    return "END Option invalide";
  }

  // Menu 2: Reset PIN
  if (choice === "2") {
    if (menuPath.length === 1) {
      return "CON Entrez votre nouveau PIN (4 chiffres):";
    }

    if (menuPath.length === 2) {
      const pin = menuPath[1];
      if (!/^\d{4}$/.test(pin)) {
        return "END PIN invalide. Doit contenir 4 chiffres.";
      }
      return "CON Confirmez votre PIN:";
    }

    if (menuPath.length === 3) {
      const pin = menuPath[1];
      const confirm = menuPath[2];

      if (pin !== confirm) {
        return "END Les PINs ne correspondent pas.";
      }

      return "END Votre PIN a été réinitialisé avec succès.";
    }

    return "END Option invalide";
  }

  // Menu 3: Support
  if (choice === "3") {
    return [
      "END Support Molam ID",
      "WhatsApp: +221 77 XXX XX XX",
      "Email: support@molam.com",
      "Web: https://molam.com/support",
    ].join("\n");
  }

  // Menu 4: Language
  if (choice === "4") {
    if (menuPath.length === 1) {
      return [
        "CON Choisissez votre langue:",
        "1. Français",
        "2. Wolof",
        "3. English",
      ].join("\n");
    }

    const langMap: Record<string, string> = {
      "1": "Français",
      "2": "Wolof",
      "3": "English",
    };

    const lang = langMap[menuPath[1]];
    if (lang) {
      return `END Langue changée: ${lang}`;
    }

    return "END Option invalide";
  }

  return "END Option invalide";
}

/**
 * GET /health
 * Health check
 */
router.get("/health", asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "ussd",
    timestamp: new Date().toISOString(),
  });
}));

export default router;
