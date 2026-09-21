import type { RequestHandler } from "express";

import type { AuthenticatedRequest } from "./types/auth-request.types.js";

export const getCurrentUser: RequestHandler = (
  request,
  response,
) => {
  const authenticatedRequest =
    request as AuthenticatedRequest;

  response.status(200).json({
    success: true,
    data: {
      user: authenticatedRequest.user,
    },
  });
};