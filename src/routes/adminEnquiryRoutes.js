import express from "express";

import {
    getAllAdminEnquiriesController,
    getAdminEnquiryByIdController,
    updateAdminEnquiryStatusController
} from "../controllers/adminEnquiryController.js";

const router = express.Router();

router.get("/", getAllAdminEnquiriesController);

router.get("/:id", getAdminEnquiryByIdController);

router.put("/:id/status", updateAdminEnquiryStatusController);

export default router;