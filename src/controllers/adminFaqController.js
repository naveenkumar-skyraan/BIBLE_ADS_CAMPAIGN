
import adminFaqService from "../services/adminFaqService.js";

const adminFaqController = {
    async createCategory(req, res, next) {
        try {
            const id = await adminFaqService.createCategory(req.body);

            return res.status(201).json({
                success: true,
                message: "FAQ category created successfully",
                data: { id }
            });
        } catch (error) {
            next(error);
        }
    },

    async getAllCategories(req, res, next) {
        try {
            const data = await adminFaqService.getAllCategories();

            return res.status(200).json({
                success: true,
                message: "FAQ categories fetched successfully",
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async getCategoryById(req, res, next) {
        try {
            const data = await adminFaqService.getCategoryById(
                req.params.id
            );

            return res.status(200).json({
                success: true,
                message: "FAQ category fetched successfully",
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async updateCategory(req, res, next) {
        try {
            await adminFaqService.updateCategory(
                req.params.id,
                req.body
            );

            return res.status(200).json({
                success: true,
                message: "FAQ category updated successfully"
            });
        } catch (error) {
            next(error);
        }
    },

    async updateCategoryStatus(req, res, next) {
        try {
            await adminFaqService.updateCategoryStatus(
                req.params.id,
                req.body.is_active
            );

            return res.status(200).json({
                success: true,
                message: "FAQ category status updated successfully"
            });
        } catch (error) {
            next(error);
        }
    },

    async deleteCategory(req, res, next) {
        try {
            await adminFaqService.deleteCategory(req.params.id);

            return res.status(200).json({
                success: true,
                message: "FAQ category deleted successfully"
            });
        } catch (error) {
            next(error);
        }
    },

    async createQuestion(req, res, next) {
        try {
            const id = await adminFaqService.createQuestion(req.body);

            return res.status(201).json({
                success: true,
                message: "FAQ question created successfully",
                data: { id }
            });
        } catch (error) {
            next(error);
        }
    },

    async getAllQuestions(req, res, next) {
        try {
            const categoryId = req.query.category_id;

            const data = await adminFaqService.getAllQuestions({
                categoryId: categoryId ?? null
            });

            return res.status(200).json({
                success: true,
                message: "FAQ questions fetched successfully",
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async getQuestionById(req, res, next) {
        try {
            const data = await adminFaqService.getQuestionById(
                req.params.id
            );

            return res.status(200).json({
                success: true,
                message: "FAQ question fetched successfully",
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async updateQuestion(req, res, next) {
        try {
            await adminFaqService.updateQuestion(
                req.params.id,
                req.body
            );

            return res.status(200).json({
                success: true,
                message: "FAQ question updated successfully"
            });
        } catch (error) {
            next(error);
        }
    },

    async updateQuestionStatus(req, res, next) {
        try {
            await adminFaqService.updateQuestionStatus(
                req.params.id,
                req.body.is_published
            );

            return res.status(200).json({
                success: true,
                message: "FAQ question status updated successfully"
            });
        } catch (error) {
            next(error);
        }
    },

    async deleteQuestion(req, res, next) {
        try {
            await adminFaqService.deleteQuestion(req.params.id);

            return res.status(200).json({
                success: true,
                message: "FAQ question deleted successfully"
            });
        } catch (error) {
            next(error);
        }
    }
};

export default adminFaqController;
