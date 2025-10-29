import { JwtPayload } from 'jsonwebtoken';

declare global {
    namespace Express {
        interface User {
            id: string;
            email: string;
            name: string;
        }

        interface Request {
            user?: User & JwtPayload;
        }
    }
}

export interface AuthenticatedRequest extends Express.Request {
    user: Express.User & JwtPayload;
}

export { };