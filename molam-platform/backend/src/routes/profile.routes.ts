import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth, requireRole, optionalAuth } from "../middleware/rbac";
import { ProfileService } from "../services/profile/profile.service";
import { db, s3, env } from "../bootstrap";

// Déclaration du type pour req.user
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                roles: string[];
                subsidiary: string;
            };
        }
    }
}

const r = Router();
const service = new ProfileService(db, s3, env.MEDIA_BUCKET);
const limiter = rateLimit({ windowMs: 60_000, max: 60 });

r.use(limiter);

// Me / Public
r.get("/api/profile/me", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: "Non authentifié" });
    }
    res.json(await service.getMyProfile(req.user.id));
});

r.get("/api/profile/:userId/public", async (req: Request, res: Response) => {
    res.json(await service.getPublicProfile(req.params.userId));
});

// Update profile
r.patch("/api/profile/me", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: "Non authentifié" });
    }

    const schema = z.object({
        display_name: z.string().min(2).max(50).optional(),
        bio: z.string().max(280).optional(),
        country_code: z.string().length(2).optional(),
        city: z.string().max(80).optional()
    });

    try {
        const patch = schema.parse(req.body);
        res.json(await service.updateProfile(req.user.id, patch));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: "Données invalides",
                details: error.errors
            });
        }
        res.status(500).json({ error: "Erreur interne" });
    }
});

// Privacy
r.patch("/api/profile/me/privacy", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: "Non authentifié" });
    }

    const schema = z.object({
        show_badges: z.boolean().optional(),
        show_activity: z.boolean().optional(),
        show_country: z.boolean().optional(),
        show_display_name: z.boolean().optional()
    });

    try {
        const patch = schema.parse(req.body);
        await service.updatePrivacy(req.user.id, patch);
        res.json({ ok: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: "Données invalides",
                details: error.errors
            });
        }
        res.status(500).json({ error: "Erreur interne" });
    }
});

// Avatar upload (signed URL)
r.post("/api/profile/me/avatar/upload-url", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: "Non authentifié" });
    }

    const schema = z.object({ mime: z.string().startsWith("image/") });

    try {
        const { mime } = schema.parse(req.body);
        res.json(await service.createAvatarUploadUrl(req.user.id, mime));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: "Type MIME invalide",
                details: error.errors
            });
        }
        res.status(500).json({ error: "Erreur interne" });
    }
});

r.post("/api/profile/me/avatar/confirm", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: "Non authentifié" });
    }

    const schema = z.object({
        key: z.string(),
        etag: z.string().optional()
    });

    try {
        const { key, etag } = schema.parse(req.body);
        res.json(await service.confirmAvatar(req.user.id, key, etag));
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: "Données invalides",
                details: error.errors
            });
        }
        res.status(500).json({ error: "Erreur interne" });
    }
});

// Activity (public-privacy aware)
r.get("/api/profile/:userId/activity", optionalAuth, async (req: Request, res: Response) => {
    try {
        const limit = Math.min(parseInt(String(req.query.limit ?? "30")), 100);
        const since = req.query.since ? String(req.query.since) : undefined;
        const requestorId = req.user?.id ?? null;

        const out = await service.listActivity(requestorId, req.params.userId, limit, since);
        res.json(out);
    } catch (error) {
        res.status(500).json({ error: "Erreur interne" });
    }
});

// Admin badges per subsidiary
r.post("/api/profile/admin/badges",
    requireRole(["core_admin", "pay_admin", "eats_admin", "shop_admin", "ads_admin", "talk_admin", "free_admin"]),
    async (req: Request, res: Response) => {
        if (!req.user) {
            return res.status(401).json({ error: "Non authentifié" });
        }

        const schema = z.object({
            code: z.string().min(2).max(50),
            name: z.string().min(2).max(80),
            description: z.string().max(200).optional(),
            icon_key: z.string().optional(),
            owner_module: z.enum(['core', 'pay', 'eats', 'shop', 'ads', 'talk', 'free'])
        });

        try {
            const badgeData = schema.parse(req.body);
            await service.createBadge(req.user.id, badgeData);
            res.status(201).json({ ok: true });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: "Données invalides",
                    details: error.errors
                });
            }
            res.status(500).json({ error: "Erreur interne" });
        }
    });

r.post("/api/profile/admin/badges/assign",
    requireRole(["core_admin", "pay_admin", "eats_admin", "shop_admin", "ads_admin", "talk_admin", "free_admin", "auditor"]),
    async (req: Request, res: Response) => {
        if (!req.user) {
            return res.status(401).json({ error: "Non authentifié" });
        }

        const schema = z.object({
            user_id: z.string().uuid(),
            badge_code: z.string(),
            valid_to: z.string().datetime().optional(),
            reason: z.string().max(200).optional()
        });

        try {
            const badgeAssign = schema.parse(req.body);
            await service.assignBadge(req.user.id, badgeAssign.user_id, badgeAssign.badge_code, badgeAssign.valid_to, badgeAssign.reason);
            res.status(201).json({ ok: true });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: "Données invalides",
                    details: error.errors
                });
            }
            res.status(500).json({ error: "Erreur interne" });
        }
    });

export default r;