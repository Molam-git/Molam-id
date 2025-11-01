import { z } from "zod";

export const CreateActionRequestSchema = z.object({
  action_key: z.enum(["ADD_SUPERADMIN","REMOVE_SUPERADMIN","ELEVATE_TEMP_ROLE","ROTATE_KEYS","BREAK_GLASS"]),
  target_user: z.string().uuid().optional(),
  payload: z.record(z.string(), z.any()).optional(),
  justification: z.string().min(10).max(1000)
});

export const ApproveRequestSchema = z.object({
  decision: z.enum(["APPROVE","REJECT"]),
  reason: z.string().max(500).optional()
});

export const CloseBreakGlassSchema = z.object({
  postmortem_url: z.string().url()
});
