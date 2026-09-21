import type { Request } from "express";

import type { AuthUser } from "./auth.types.js";

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}