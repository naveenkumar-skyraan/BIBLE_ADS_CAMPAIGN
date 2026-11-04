import express from "express";

import { adminAuthMiddleware } from "../middleware/adminAuthMiddleware.js";

import {
  getAllAdminBusinessesController,
  getAdminBusinessByIdController,
  changeBusinessVerificationStatusController,
  updateAdminBusinessDetailsController,
} from "../controllers/adminBusinessDetailController.js";

const router = express.Router();

router.post("/", adminAuthMiddleware, getAllAdminBusinessesController);

router.get("/:id", adminAuthMiddleware, getAdminBusinessByIdController);

router.put(
  "/:id/verification",
  adminAuthMiddleware,
  changeBusinessVerificationStatusController,
);

router.put("/:id", adminAuthMiddleware, updateAdminBusinessDetailsController);

export default router;
