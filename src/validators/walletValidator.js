import Joi from "joi";

const walletValidator = {
    getWallet: Joi.object({}).unknown(false),

    createTopup: Joi.object({
        amount: Joi.number()
            .positive()
            .precision(2)
            .required()
    }),

    verifyTopup: Joi.object({
        order_id: Joi.string()
            .trim()
            .max(100)
            .required()
    }),

    getTransactions: Joi.object({
        page: Joi.number()
            .integer()
            .min(1)
            .default(1),

        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(20)
    }),

    getTransaction: Joi.object({
        id: Joi.number()
            .integer()
            .positive()
            .required()
    }),

    getTopups: Joi.object({
        page: Joi.number()
            .integer()
            .min(1)
            .default(1),

        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(20)
    }),

    getTopup: Joi.object({
        id: Joi.number()
            .integer()
            .positive()
            .required()
    }),

    allocateFund: Joi.object({
        business_id: Joi.number()
            .integer()
            .positive()
            .required(),

        ad_id: Joi.number()
            .integer()
            .positive()
            .required(),

        amount: Joi.number()
            .positive()
            .precision(2)
            .required()
    }),

    getFunds: Joi.object({
        page: Joi.number()
            .integer()
            .min(1)
            .default(1),

        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(20),

        status: Joi.string()
            .valid(
                "active",
                "completed",
                "refund_pending",
                "refunded"
            )
            .optional()
    }),

    getFund: Joi.object({
        id: Joi.number()
            .integer()
            .positive()
            .required()
    }),

    spendFund: Joi.object({
        id: Joi.number()
            .integer()
            .positive()
            .required(),

        amount: Joi.number()
            .positive()
            .precision(2)
            .required()
    }),

    requestRefund: Joi.object({
        id: Joi.number()
            .integer()
            .positive()
            .required()
    })
};

export default walletValidator;