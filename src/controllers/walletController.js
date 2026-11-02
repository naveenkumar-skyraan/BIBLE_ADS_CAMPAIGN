
import walletValidator from "../validators/walletValidator.js";

import {
  getWallet,
  createTopupOrder,
  verifyCashfreePayment,
  processWebhook,
  getWalletTransactions,
  getWalletTransaction,
} from "../services/walletService.js";

const validate = (schema, body) => {
  return schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
};

const statusCodes = {
  ER_NO_SUCH_TABLE: 500,
  ER_BAD_FIELD_ERROR: 500,
  ER_DUP_ENTRY: 409,
  TOPUP_NOT_FOUND: 404,
  WALLET_NOT_FOUND: 404,
  TRANSACTION_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  PHONE_REQUIRED: 400,
  PAYMENT_AMOUNT_MISMATCH: 400,
  PAYMENT_NOT_SUCCESSFUL: 400,
  CASHFREE_CONFIG_ERROR: 500,
  CASHFREE_API_ERROR: 502,
  INVALID_WEBHOOK_SIGNATURE: 401,
  INVALID_WEBHOOK_PAYLOAD: 400,
};

const handleError = (res, error) => {
  return res.status(statusCodes[error.code] || 500).json({
    success: false,
    code: error.code,
    message: statusCodes[error.code]
      ? error.message
      : "Internal server error",
  });
};

const getWalletController = async (req, res) => {
  try {
    const wallet = await getWallet(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Wallet fetched successfully",
      data: wallet,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const createTopupController = async (req, res) => {
  try {
    const { error, value } = validate(
      walletValidator.createTopup,
      req.body,
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const data = await createTopupOrder(
      req.user.id,
      value.amount,
    );

    return res.status(201).json({
      success: true,
      message: "Wallet top-up order created successfully",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const verifyTopupController = async (req, res) => {
  try {
    const { error, value } = validate(
      walletValidator.verifyTopup,
      req.body,
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const data = await verifyCashfreePayment(
      req.user.id,
      value.order_id,
    );

    return res.status(200).json({
      success: true,
      message: "Payment status verified successfully",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const cashfreeWebhookController = async (req, res) => {
  try {
    const rawBody = req.rawBody
      ? req.rawBody.toString()
      : "";

    const data = await processWebhook(
      rawBody,
      req.headers["x-webhook-signature"],
      req.headers["x-webhook-timestamp"],
    );

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const getTransactionsController = async (req, res) => {
  try {
    const { error, value } = validate(
      walletValidator.getTransactions,
      req.body,
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const data = await getWalletTransactions(
      req.user.id,
      value.type,
      value.date_filter,
      value.cursor,
    );

    return res.status(200).json({
      success: true,
      message: "Wallet transactions fetched successfully",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const getTransactionController = async (req, res) => {
  try {
    const { error, value } = validate(
      walletValidator.getTransaction,
      req.body,
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const transaction = await getWalletTransaction(
      req.user.id,
      value.transaction_id,
      value.source_type,
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Wallet transaction fetched successfully",
      data: transaction,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export {
  getWalletController,
  createTopupController,
  verifyTopupController,
  cashfreeWebhookController,
  getTransactionsController,
  getTransactionController,
};
