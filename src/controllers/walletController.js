import walletValidator from "../validators/walletValidator.js";

import {
    getWallet,
    createTopupOrder,
    verifyCashfreePayment,
    processWebhook,
    getWalletTransactions,
    getWalletTransaction,
    getTopupHistory,
    getTopupDetails,
    allocateWalletFund,
    getAdFunds,
    getAdFund,
    spendWalletFund,
    requestWalletFundRefund
} from "../services/walletService.js";

const validate = (schema, body) => {
    return schema.validate(body, {
        abortEarly: false,
        stripUnknown: true
    });
};

const statusCodes = {
    ER_NO_SUCH_TABLE: 500,
    ER_BAD_FIELD_ERROR: 500,
    ER_DUP_ENTRY: 409,
    BUSINESS_NOT_FOUND: 404,
    AD_NOT_FOUND: 404,
    FUND_NOT_FOUND: 404,
    TOPUP_NOT_FOUND: 404,
    WALLET_NOT_FOUND: 404,
    TRANSACTION_NOT_FOUND: 404,
    USER_NOT_FOUND: 404,
    FUND_ALREADY_EXISTS: 409,
    INSUFFICIENT_BALANCE: 400,
    INSUFFICIENT_FUND_BALANCE: 400,
    FUND_NOT_ACTIVE: 400,
    INVALID_REFUND_STATUS: 400,
    PHONE_REQUIRED: 400,
    PAYMENT_AMOUNT_MISMATCH: 400,
    CASHFREE_CONFIG_ERROR: 500,
    CASHFREE_API_ERROR: 502,
    INVALID_WEBHOOK_SIGNATURE: 401,
    INVALID_WEBHOOK_PAYLOAD: 400
};

const handleError = (res, error) => {
    return res
        .status(statusCodes[error.code] || 500)
        .json({
            success: false,
            code: error.code,
            message: statusCodes[error.code]
                ? error.message
                : "Internal server error"
        });
};

const getWalletController = async (
    req,
    res
) => {
    try {
        const wallet =
            await getWallet(req.user.id);

        return res.status(200).json({
            success: true,
            message:
                "Wallet fetched successfully",
            data: wallet
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const createTopupController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.createTopup,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const data =
            await createTopupOrder(
                req.user.id,
                value.amount
            );

        return res.status(201).json({
            success: true,
            message:
                "Wallet top-up order created successfully",
            data
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const verifyTopupController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.verifyTopup,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const data =
            await verifyCashfreePayment(
                req.user.id,
                value.order_id
            );

        return res.status(200).json({
            success: true,
            message:
                "Payment status verified successfully",
            data
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const cashfreeWebhookController = async (
    req,
    res
) => {
    try {
        const rawBody =
            req.rawBody
                ? req.rawBody.toString()
                : "";

        const result =
            await processWebhook(
                rawBody,
                req.headers[
                    "x-webhook-signature"
                ],
                req.headers[
                    "x-webhook-timestamp"
                ]
            );

        return res.status(200).json({
            success: true,
            message:
                "Webhook processed successfully",
            data: result
        });
    } catch (error) {
        return res
            .status(
                statusCodes[error.code] ||
                    500
            )
            .json({
                success: false,
                code: error.code,
                message:
                    statusCodes[error.code]
                        ? error.message
                        : "Internal server error"
            });
    }
};

const getTransactionsController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.getTransactions,
            req.query
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const data =
            await getWalletTransactions(
                req.user.id,
                value.page,
                value.limit
            );

        return res.status(200).json({
            success: true,
            message:
                "Wallet transactions fetched successfully",
            data
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const getTransactionController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.getTransaction,
            {
                id: req.params.id
            }
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const transaction =
            await getWalletTransaction(
                req.user.id,
                value.id
            );

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message:
                    "Transaction not found"
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Wallet transaction fetched successfully",
            data: transaction
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const getTopupsController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.getTopups,
            req.query
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const data =
            await getTopupHistory(
                req.user.id,
                value.page,
                value.limit
            );

        return res.status(200).json({
            success: true,
            message:
                "Wallet top-ups fetched successfully",
            data
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const getTopupController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.getTopup,
            {
                id: req.params.id
            }
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const topup =
            await getTopupDetails(
                req.user.id,
                value.id
            );

        if (!topup) {
            return res.status(404).json({
                success: false,
                message:
                    "Top-up not found"
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Wallet top-up fetched successfully",
            data: topup
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const allocateFundController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.allocateFund,
            req.body
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const data =
            await allocateWalletFund(
                req.user.id,
                value.business_id,
                value.ad_id,
                value.amount
            );

        return res.status(201).json({
            success: true,
            message:
                "Fund allocated successfully",
            data
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const getFundsController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.getFunds,
            req.query
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const data =
            await getAdFunds(
                req.user.id,
                value.page,
                value.limit,
                value.status
            );

        return res.status(200).json({
            success: true,
            message:
                "Ad funds fetched successfully",
            data
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const getFundController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.getFund,
            {
                id: req.params.id
            }
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const fund =
            await getAdFund(
                req.user.id,
                value.id
            );

        if (!fund) {
            return res.status(404).json({
                success: false,
                message:
                    "Ad fund not found"
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Ad fund fetched successfully",
            data: fund
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const spendFundController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.spendFund,
            {
                id: req.params.id,
                amount: req.body.amount
            }
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const fund =
            await spendWalletFund(
                req.user.id,
                value.id,
                value.amount
            );

        return res.status(200).json({
            success: true,
            message:
                "Ad fund spending updated successfully",
            data: fund
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

const requestRefundController = async (
    req,
    res
) => {
    try {
        const {
            error,
            value
        } = validate(
            walletValidator.requestRefund,
            {
                id: req.params.id
            }
        );

        if (error) {
            return res.status(400).json({
                success: false,
                message:
                    "Validation failed",
                errors: error.details.map(
                    (detail) =>
                        detail.message
                )
            });
        }

        const fund =
            await requestWalletFundRefund(
                req.user.id,
                value.id
            );

        return res.status(200).json({
            success: true,
            message:
                "Refund request submitted successfully",
            data: fund
        });
    } catch (error) {
        return handleError(
            res,
            error
        );
    }
};

export {
    getWalletController,
    createTopupController,
    verifyTopupController,
    cashfreeWebhookController,
    getTransactionsController,
    getTransactionController,
    getTopupsController,
    getTopupController,
    allocateFundController,
    getFundsController,
    getFundController,
    spendFundController,
    requestRefundController
};