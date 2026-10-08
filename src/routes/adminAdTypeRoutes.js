import express from "express";
import { adminAuthMiddleware } from "../middleware/adminAuthMiddleware.js";

import {
    createTypeController,
    listTypesController,
    getTypeController,
    updateTypeController,
    updateTypeStatusController
} from "../controllers/adTypeController.js";

const router = express.Router();

router.use(adminAuthMiddleware);

router.post("/", createTypeController);
router.get("/", listTypesController);
router.get("/:id", getTypeController);
router.put("/:id", updateTypeController);
router.put("/:id/status", updateTypeStatusController);

export default router;