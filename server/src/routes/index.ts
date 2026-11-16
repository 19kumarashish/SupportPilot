import { Router } from "express";

import { authRouter } from "../modules/auth/auth.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { organizationRouter } from "../modules/organizations/organization.routes.js";
import { userRouter } from "../modules/users/user.routes.js";
import { customerRouter } from "../modules/customers/customer.routes.js";
import { ticketRouter } from "../modules/tickets/ticket.routes.js";
import { customerTicketRouter } from "../modules/tickets/customer-ticket.routes.js";
import { slaRouter } from "../modules/sla/sla.routes.js";
import { teamRouter } from "../modules/teams/team.routes.js";
import { kbRouter } from "../modules/knowledge-base/kb.routes.js";
import { customerKbRouter } from "../modules/knowledge-base/customer-kb.routes.js";
import { publicKbRouter } from "../modules/knowledge-base/public-kb.routes.js";

export const apiRouter: Router = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/organizations", organizationRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/customers", customerRouter);
apiRouter.use("/tickets", ticketRouter);
apiRouter.use("/customer/tickets", customerTicketRouter);
apiRouter.use("/sla", slaRouter);
apiRouter.use("/teams", teamRouter);
apiRouter.use("/kb", kbRouter);
apiRouter.use("/customer/kb", customerKbRouter);
apiRouter.use("/public/kb/:orgSlug", publicKbRouter);