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
    const categoryIdNumber = Number(categoryId);

    if (!Number.isInteger(categoryIdNumber) || categoryIdNumber <= 0) {
      throw createError("Invalid FAQ category ID", 400);
    }

    const categories = await faqModel.getFaqCategories();

    const categoryExists = categories.some(
      (category) => Number(category.id) === categoryIdNumber,
    );

    if (!categoryExists) {
      throw createError("FAQ category not found", 404);
    }

    return await faqModel.getFaqQuestionsByCategory(categoryIdNumber);
  },
};

export default faqService;