import { Router } from "express";

import { getCurrentUser } from "./auth.me.controller.js";
import {
  beginOrganizationSignup,
  getDevelopmentVerificationLink,
  getDevelopmentInvitation,
  login,
  logout,
  resendOrganizationSignupVerification,
  refresh,
  verifyOrganizationSignup,
} from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";
import { createApiRateLimiters } from "../../shared/security/rate-limit.js";
import { customerLogin } from "../customers/customer-auth.js";
import { publicInvitationRouter } from "../users/invitations/invitation.routes.js";

const { loginLimiter, signupLimiter, verificationLimiter } =
  createApiRateLimiters();

export const authRouter: Router = Router();

authRouter.post("/organization-signup", signupLimiter, beginOrganizationSignup);
authRouter.post(
  "/organization-signup/resend-verification",
  resendOrganizationSignupVerification,
);
authRouter.post("/development/invitation-link", getDevelopmentInvitation);
authRouter.post("/verify-organization-signup", verificationLimiter, verifyOrganizationSignup);
authRouter.post(
  "/development/verification-link",
  getDevelopmentVerificationLink,
);
authRouter.post("/login", loginLimiter, login);
authRouter.post("/customer/login", loginLimiter, customerLogin);

authRouter.post("/refresh", refresh);

authRouter.post("/logout", requireAuth, logout);

authRouter.get("/me", requireAuth, getCurrentUser);
authRouter.use("/invitations", publicInvitationRouter);