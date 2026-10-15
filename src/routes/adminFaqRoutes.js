
import express from "express";
import adminFaqController from "../controllers/adminFaqController.js";

const router = express.Router();

router.post("/categories", adminFaqController.createCategory);
router.get("/categories", adminFaqController.getAllCategories);
router.get("/categories/:id", adminFaqController.getCategoryById);
router.put("/categories/:id", adminFaqController.updateCategory);
router.patch(
    "/categories/:id/status",
    adminFaqController.updateCategoryStatus
);
router.delete("/categories/:id", adminFaqController.deleteCategory);

router.post("/questions", adminFaqController.createQuestion);
router.get("/questions", adminFaqController.getAllQuestions);
router.get("/questions/:id", adminFaqController.getQuestionById);
router.put("/questions/:id", adminFaqController.updateQuestion);
router.patch(
    "/questions/:id/status",
    adminFaqController.updateQuestionStatus
);
router.delete("/questions/:id", adminFaqController.deleteQuestion);

export default router;
