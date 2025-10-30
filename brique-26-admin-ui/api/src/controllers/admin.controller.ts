// api/src/controllers/admin.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as service from '../services/admin.service';
import type { CreateEmployeeDTO, UpdateEmployeeDTO, AssignRoleDTO, RevokeRoleDTO, Department } from '../types';

export async function listEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    const department = req.query.department as Department | undefined;
    const includeInactive = req.query.include_inactive === 'true';
    const employees = await service.listEmployees(adminUserId, department, includeInactive);
    res.json({ employees });
  } catch (error) {
    next(error);
  }
}

export async function getEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    const employee = await service.getEmployee(adminUserId, req.params.id);
    res.json(employee);
  } catch (error) {
    next(error);
  }
}

export async function createEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    const dto: CreateEmployeeDTO = req.body;
    const id = await service.createEmployee(adminUserId, dto);
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
}

export async function updateEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    const dto: UpdateEmployeeDTO = req.body;
    await service.updateEmployee(adminUserId, req.params.id, dto);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function deactivateEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    const { reason } = req.body;
    await service.deactivateEmployee(adminUserId, req.params.id, reason);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function listRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const department = req.query.department as Department | undefined;
    const roles = await service.listRoles(department);
    res.json({ roles });
  } catch (error) {
    next(error);
  }
}

export async function assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    const dto: AssignRoleDTO = req.body;
    await service.assignRole(adminUserId, dto);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function revokeRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    const dto: RevokeRoleDTO = req.body;
    await service.revokeRole(adminUserId, dto);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    const department = req.query.department as Department | undefined;
    const sessions = await service.listSessions(adminUserId, department);
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
}

export async function revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    await service.revokeSession(adminUserId, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function listAudit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    const department = req.query.department as Department | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const audit = await service.listAudit(adminUserId, department, limit);
    res.json({ audit });
  } catch (error) {
    next(error);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminUserId = req.user!.id;
    const stats = await service.getDepartmentStats(adminUserId);
    res.json({ stats });
  } catch (error) {
    next(error);
  }
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error('Admin API Error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(statusCode).json({ error: message, code: err.code });
}
