import { Request } from 'express';
import { AuthenticatedUser } from './auth.types';

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
