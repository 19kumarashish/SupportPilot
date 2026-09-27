import { Router } from "express";

import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
  updateUserStatus,
} from "./user.controller.js";

export const userRouter: Router = Router();

userRouter.use(requireAuth, requireRole("admin"));

userRouter.get("/", listUsers);
userRouter.get("/:id", getUser);
userRouter.post("/", createUser);
userRouter.patch("/:id", updateUser);
userRouter.patch("/:id/status", updateUserStatus);
userRouter.delete("/:id", deleteUser);