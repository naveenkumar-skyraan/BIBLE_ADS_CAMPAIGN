import express from "express";

import { adminAuthMiddleware } from "../middleware/adminAuthMiddleware.js";

import {
    getAllAdminEnquiriesController,
    getAdminEnquiryByIdController,
    updateAdminEnquiryStatusController
} from "../controllers/adminEnquiryController.js";

const router = express.Router();

router.post("/", adminAuthMiddleware, getAllAdminEnquiriesController);

router.get("/:id", adminAuthMiddleware, getAdminEnquiryByIdController);

router.put("/:id/status", adminAuthMiddleware, updateAdminEnquiryStatusController);

export default router;