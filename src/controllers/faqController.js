import faqService from "../services/faqService.js";

const faqController = {
  async getCategories(req, res, next) {
    try {
      const data = await faqService.getCategories();

      return res.status(200).json({
        success: true,
        message: "FAQ categories fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async getQuestionsByCategory(req, res, next) {
    try {
      const data = await faqService.getQuestionsByCategory(
        req.params.categoryId,
      );

      return res.status(200).json({
        success: true,
        message: "FAQ questions and answers fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default faqController;