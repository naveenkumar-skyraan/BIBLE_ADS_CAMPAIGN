import express from "express";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware.js";

import {
    getRefundsController,
    getRefundController,
    approveRefundController,
    rejectRefundController
} from "../controllers/adminWalletController.js";

const router = express.Router();

router.use(adminAuthMiddleware);

router.get("/refunds", getRefundsController);
router.get("/refunds/:id", getRefundController);
router.post("/refunds/:id/approve", approveRefundController);
router.post("/refunds/:id/reject", rejectRefundController);

export default router;
