
import express from "express";
import adminIssueReportController from "../controllers/adminIssueReportController.js";
import { adminAuthMiddleware } from "../middleware/adminAuthMiddleware.js";

const router = express.Router();

router.use(adminAuthMiddleware);

router.post("/types", adminIssueReportController.createIssueType);
router.get("/types", adminIssueReportController.getAllIssueTypes);
router.get("/types/:id", adminIssueReportController.getIssueTypeById);
router.put("/types/:id", adminIssueReportController.updateIssueType);
router.put("/types/:id/status", adminIssueReportController.updateIssueTypeStatus);
router.delete("/types/:id", adminIssueReportController.deleteIssueType);

router.get("/", adminIssueReportController.getAllReportedIssues);
router.get("/:id", adminIssueReportController.getReportedIssueById);
router.put("/:id/status", adminIssueReportController.updateReportedIssueStatus);
router.delete("/:id", adminIssueReportController.deleteReportedIssue);

export default router;
