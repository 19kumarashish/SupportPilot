import { Router } from "express";

export const healthRouter: Router = Router();

healthRouter.get("/", (_request, response) => {
  response.status(200).json({
    success: true,
    data: {
      status: "ok",
    },
  });
});