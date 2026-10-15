
import express from "express";
import issueReportController from "../controllers/issueReportController.js";
import { middleware } from "../middleware/authMiddleware.js";
import issueReportUpload from "../middleware/issueReportUpload.js";
import { createIssueReportSchema } from "../validators/issueReportValidator.js";

const router = express.Router();

const validateCreateReport = (req, res, next) => {
  const { error, value } = createIssueReportSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map((detail) => detail.message).join(", ")
    });
  }

  req.body = value;
  next();
};

/**
 * @swagger
 * tags:
 *   name: Issue Reports
 *   description: User issue reporting APIs
 */

/**
 * @swagger
 * /api/issue-reports/types:
 *   get:
 *     summary: Get active issue types
 *     tags: [Issue Reports]
 *     responses:
 *       200:
 *         description: Issue types fetched successfully
 *       401:
 *         description: Unauthorized
 */
router.get("/types", middleware, issueReportController.getIssueTypes);

/**
 * @swagger
 * /api/issue-reports:
 *   post:
 *     summary: Submit an issue report
 *     tags: [Issue Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - issue_type_id
 *               - description
 *             properties:
 *               issue_type_id:
 *                 type: integer
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *               screenshot:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Issue reported successfully
 *       400:
 *         description: Invalid input or screenshot
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  middleware,
  issueReportUpload.single("screenshot"),
  validateCreateReport,
  issueReportController.createReport
);

export default router;
