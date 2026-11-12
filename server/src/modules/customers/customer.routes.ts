import { Router } from "express";

import { requireAuth } from "../auth/auth.middleware.js";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
  updateCustomerStatus,
  restoreCustomer,
} from "./customer.controller.js";

export const customerRouter: Router = Router();

customerRouter.use(requireAuth);

customerRouter.get("/", listCustomers);
customerRouter.get("/:id", getCustomer);

customerRouter.post("/", createCustomer);

customerRouter.patch("/:id", updateCustomer);
customerRouter.patch("/:id/status", updateCustomerStatus);
customerRouter.patch("/:id/restore", restoreCustomer);

customerRouter.delete("/:id", deleteCustomer);