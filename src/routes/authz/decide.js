/**
 * Route: POST /v1/authz/decide
 * Prend une décision d'autorisation
 */

import { makeAuthzDecision } from "../../services/authzService.js";
import jwt from "jsonwebtoken";

export async function authzDecide(req, res) {
  try {
    const {
      path,
      method,
      user_id,
      roles = [],
      context = {},
      module = 'id'
    } = req.body;

    // Validation
    if (!path || !method) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'path and method are required'
      });
    }

    let userId = user_id;

    // Si un JWT est fourni, extraire l'user_id et autres infos
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const decoded = jwt.decode(token); // decode sans vérifier (AuthZ est séparé)
        userId = userId || decoded.user_id || decoded.sub;

        // Enrichir le contexte avec les infos du JWT
        if (decoded.kyc_level) context.kyc_level = decoded.kyc_level;
        if (decoded.country) context.country = decoded.country;
        if (decoded.sira_score) context.sira_score = decoded.sira_score;
        if (decoded.roles) roles.push(...decoded.roles);
      } catch (err) {
        // Token invalide, continuer quand même
        console.warn('Invalid JWT in AuthZ request:', err.message);
      }
    }

    if (!userId) {
      return res.status(400).json({
        error: 'bad_request',
        message: 'user_id is required'
      });
    }

    // Enrichir le contexte avec les infos de la requête
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Ajouter l'heure actuelle au contexte pour les policies basées sur le temps
    const now = new Date();
    context.hour = now.getHours();
    context.day_of_week = now.getDay();
    context.timestamp = now.toISOString();

    // Prendre la décision
    const decision = await makeAuthzDecision({
      userId,
      path,
      method,
      module,
      roles,
      context,
      ipAddress,
      userAgent,
      useCache: true
    });

    // Retourner la décision
    return res.status(200).json({
      decision: decision.decision,
      ttl: decision.ttl,
      audit_id: decision.audit_id,
      reason: decision.reason,
      cached: decision.cached || false,
      policies_applied: decision.policiesApplied || []
    });

  } catch (error) {
    console.error('Error in authzDecide:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Error processing authorization decision',
      audit_id: null
    });
  }
}
