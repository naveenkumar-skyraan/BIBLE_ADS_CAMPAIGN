
import * as adminFaqModel from "../models/adminFaqModel.js";

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const adminFaqService = {
    async createCategory(data) {
        return await adminFaqModel.createFaqCategory(data);
    },

    async getAllCategories() {
        return await adminFaqModel.getAllFaqCategories();
    },

    async getCategoryById(id) {
        const category = await adminFaqModel.getFaqCategoryById(id);

        if (!category) {
            throw createError(
                "FAQ category not found",
                404
            );
        }

        return category;
    },

    async updateCategory(id, data) {
        const category = await adminFaqModel.getFaqCategoryById(id);

        if (!category) {
            throw createError(
                "FAQ category not found",
                404
            );
        }

        const affectedRows = await adminFaqModel.updateFaqCategory(
            id,
            data
        );

        if (!affectedRows) {
            throw createError(
                "FAQ category was not updated",
                400
            );
        }

        return true;
    },

    async updateCategoryStatus(id, isActive) {
        const category = await adminFaqModel.getFaqCategoryById(id);

        if (!category) {
            throw createError(
                "FAQ category not found",
                404
            );
        }

        const affectedRows =
            await adminFaqModel.updateFaqCategoryStatus(
                id,
                isActive
            );

        if (!affectedRows) {
            throw createError(
                "FAQ category status was not updated",
                400
            );
        }

        return true;
    },

    async deleteCategory(id) {
        const category = await adminFaqModel.getFaqCategoryById(id);

        if (!category) {
            throw createError(
                "FAQ category not found",
                404
            );
        }

        const affectedRows =
            await adminFaqModel.deleteFaqCategory(id);

        if (!affectedRows) {
            throw createError(
                "FAQ category was not deleted",
                400
            );
        }

        return true;
    },

    async createQuestion(data) {
        return await adminFaqModel.createFaqQuestion(data);
    },

    async getAllQuestions(filters = {}) {
        return await adminFaqModel.getAllFaqQuestions(filters);
    },

    async getQuestionById(id) {
        const question = await adminFaqModel.getFaqQuestionById(id);

        if (!question) {
            throw createError(
                "FAQ question not found",
                404
            );
        }

        return question;
    },

    async updateQuestion(id, data) {
        const question = await adminFaqModel.getFaqQuestionById(id);

        if (!question) {
            throw createError(
                "FAQ question not found",
                404
            );
        }

        const updated = await adminFaqModel.updateFaqQuestion(
            id,
            data
        );

        if (!updated) {
            throw createError(
                "FAQ question was not updated",
                400
            );
        }

        return true;
    },

    async updateQuestionStatus(id, isPublished) {
        const question = await adminFaqModel.getFaqQuestionById(id);

        if (!question) {
            throw createError(
                "FAQ question not found",
                404
            );
        }

        const affectedRows =
            await adminFaqModel.updateFaqQuestionStatus(
                id,
                isPublished
            );

        if (!affectedRows) {
            throw createError(
                "FAQ question status was not updated",
                400
            );
        }

        return true;
    },

    async deleteQuestion(id) {
        const question = await adminFaqModel.getFaqQuestionById(id);

        if (!question) {
            throw createError(
                "FAQ question not found",
                404
            );
        }

        const affectedRows =
            await adminFaqModel.deleteFaqQuestion(id);

        if (!affectedRows) {
            throw createError(
                "FAQ question was not deleted",
                400
            );
        }

        return true;
    }
};

export default adminFaqService;
