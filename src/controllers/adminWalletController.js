import adminWalletValidator from "../validators/adminWalletValidator.js";

import {
  getRefundRequests,
  getRefundRequest,
  approveRefund,
  rejectRefund,
} from "../services/adminWalletService.js";

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
  FUND_NOT_FOUND: 404,
  WALLET_NOT_FOUND: 404,
  INVALID_REFUND_STATUS: 400,
  NO_REFUNDABLE_BALANCE: 400,
};

const handleError = (res, error) => {
  return res.status(statusCodes[error.code] || 500).json({
    success: false,
    code: error.code,
    message: statusCodes[error.code] ? error.message : "Internal server error",
  });
};

const getRefundsController = async (req, res) => {
  try {
    const { error, value } = validate(
      adminWalletValidator.getRefunds,
      req.query,
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const data = await getRefundRequests(value.page, value.limit, value.status);

    return res.status(200).json({
      success: true,
      message: "Wallet refund requests fetched successfully",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const getRefundController = async (req, res) => {
  try {
    const { error, value } = validate(adminWalletValidator.getRefund, {
      id: req.params.id,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const refund = await getRefundRequest(value.id);

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: "Refund request not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Wallet refund request fetched successfully",
      data: refund,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const approveRefundController = async (req, res) => {
  try {
    const { error, value } = validate(adminWalletValidator.action, {
      id: req.params.id,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const adminId = req.admin?.id ?? req.user?.id ?? req.user?.user_id ?? null;

    const refund = await approveRefund(value.id, adminId);

    return res.status(200).json({
      success: true,
      message: refund.already_processed
        ? "Wallet refund was already approved"
        : "Wallet refund approved successfully",
      data: refund,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const rejectRefundController = async (req, res) => {
  try {
    const { error, value } = validate(adminWalletValidator.action, {
      id: req.params.id,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.details.map((detail) => detail.message),
      });
    }

    const refund = await rejectRefund(value.id);

    return res.status(200).json({
      success: true,
      message: "Wallet refund rejected successfully",
      data: refund,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export {
  getRefundsController,
  getRefundController,
  approveRefundController,
  rejectRefundController,
};
