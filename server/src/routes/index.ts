import { Router } from "express";

import { authRouter } from "../modules/auth/auth.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { organizationRouter } from "../modules/organizations/organization.routes.js";
import { userRouter } from "../modules/users/user.routes.js";
import { customerRouter } from "../modules/customers/customer.routes.js";
import { ticketRouter } from "../modules/tickets/ticket.routes.js";

export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/organizations", organizationRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/customers", customerRouter);
apiRouter.use("/tickets", ticketRouter);