
import * as faqModel from "../models/faqModel.js";

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const faqService = {
    async getCategories() {
        return await faqModel.getFaqCategories();
    },

    async getQuestionsByCategory(categoryId) {
        const categories = await faqModel.getFaqCategories();

        const categoryExists = categories.some(
            (category) => Number(category.id) === Number(categoryId)
        );

        if (!categoryExists) {
            throw createError(
                "FAQ category not found",
                404
            );
        }

        return await faqModel.getFaqQuestionsByCategory(
            categoryId
        );
    },

    async getQuestionById(questionId) {
        const question = await faqModel.getFaqQuestionById(
            questionId
        );

        if (!question) {
            throw createError(
                "FAQ question not found",
                404
            );
        }

        return question;
    }
};

export default faqService;
