import Joi from "joi";

const walletValidator = {
  getWallet: Joi.object({}),

  createTopup: Joi.object({
    amount: Joi.number().min(1).precision(2).required(),
  }),

  verifyTopup: Joi.object({
    order_id: Joi.string().trim().max(100).required(),
  }),

  getTransactions: Joi.object({
    type: Joi.string()
      .valid("all", "added", "ads_spend", "pending", "failed")
      .default("all"),

    date_filter: Joi.string()
      .valid(
        "all",
        "today",
        "yesterday",
        "last_week",
        "last_month",
        "last_year",
      )
      .default("all"),

    cursor: Joi.object({
      transaction_date: Joi.date().iso().required(),

      source_type: Joi.string()
        .valid("wallet_transaction", "wallet_topup")
        .required(),

      source_id: Joi.number().integer().positive().required(),
    })
      .allow(null)
      .default(null),

    limit: Joi.number().integer().valid(10).default(10),
  }),

  getTransaction: Joi.object({
    transaction_id: Joi.number().integer().positive().required(),

    source_type: Joi.string()
      .valid("wallet_transaction", "wallet_topup")
      .required(),
  }),
};

export default walletValidator;
