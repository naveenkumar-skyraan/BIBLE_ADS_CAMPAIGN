
import faqService from "../services/faqService.js";

const faqController = {
    async getCategories(req, res, next) {
        try {
            const data = await faqService.getCategories();

            return res.status(200).json({
                success: true,
                message: "FAQ categories fetched successfully",
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async getQuestionsByCategory(req, res, next) {
        try {
            const data = await faqService.getQuestionsByCategory(
                req.params.categoryId
            );

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
            const data = await faqService.getQuestionById(
                req.params.questionId
            );

            return res.status(200).json({
                success: true,
                message: "FAQ details fetched successfully",
                data
            });
        } catch (error) {
            next(error);
        }
    }
};

export default faqController;
