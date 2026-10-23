import express from "express";
import faqController from "../controllers/faqController.js";
import { middleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: FAQs
 *   description: FAQ APIs for the Ads Campaign app
 */

/**
 * @swagger
 * /api/faqs/categories:
 *   get:
 *     summary: Get active FAQ categories
 *     tags: [FAQs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: FAQ categories fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FAQCategoriesResponse'
 *       500:
 *         description: Internal server error
 */
router.get("/categories", middleware, faqController.getCategories);

/**
 * @swagger
 * /api/faqs/categories/{categoryId}/questions:
 *   get:
 *     summary: Get published questions and answers for a category
 *     tags: [FAQs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: FAQ category ID
 *     responses:
 *       200:
 *         description: FAQ questions and answers fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FAQQuestionsResponse'
 *       404:
 *         description: FAQ category not found
 *       500:
 *         description: Internal server error
 */
router.get(
  "/categories/:categoryId/questions",
  middleware,
  faqController.getQuestionsByCategory,
);

export default router;