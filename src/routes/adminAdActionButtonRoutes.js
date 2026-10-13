import express from "express";

import {
  createActionButton,
  listActionButtons,
  getActionButton,
  updateActionButton,
  updateActionButtonStatus,
} from "../controllers/adActionButtonController.js";

import {adminAuthMiddleware} from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

router.use(adminAuthMiddleware);

router.post("/", createActionButton);

router.get("/", listActionButtons);

router.get("/:id", getActionButton);

router.put("/:id", updateActionButton);

router.patch("/:id/status", updateActionButtonStatus);

export default router;
