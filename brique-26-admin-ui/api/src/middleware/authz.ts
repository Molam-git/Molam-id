// Reuse from Brique 25
import { Request, Response, NextFunction } from 'express';

export function authzEnforce(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hasPermission = req.user.permissions?.includes(permission) || false;

    if (!hasPermission) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Missing permission: ${permission}`
      });
      return;
    }

    next();
  };
}
