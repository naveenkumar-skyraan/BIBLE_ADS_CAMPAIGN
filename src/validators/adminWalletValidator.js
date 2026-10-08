import Joi from "joi";

const adminWalletValidator = {
    getRefunds: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(20),
        status: Joi.string()
            .valid("active", "completed", "refund_pending", "refunded")
            .default("refund_pending")
    }).unknown(false),

    getRefund: Joi.object({
        id: Joi.number().integer().positive().required()
    }).unknown(false),

    action: Joi.object({
        id: Joi.number().integer().positive().required()
    }).unknown(false)
};

export default adminWalletValidator;
