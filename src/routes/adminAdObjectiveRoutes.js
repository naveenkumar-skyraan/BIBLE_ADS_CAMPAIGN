import express from "express";
import { adminAuthMiddleware } from "../middleware/adminAuthMiddleware.js";

import {
    createObjectiveController,
    listObjectivesController,
    getObjectiveController,
    updateObjectiveController,
    updateObjectiveStatusController
} from "../controllers/adObjectiveController.js";

const router = express.Router();

router.use(adminAuthMiddleware);

router.post("/", createObjectiveController);
router.get("/", listObjectivesController);
router.get("/:id", getObjectiveController);
router.put("/:id", updateObjectiveController);
router.put("/:id/status", updateObjectiveStatusController);

export default router;