import crypto from "crypto";

import {
  getOrCreateWallet,
  getUserForPayment,
  createTopup,
  updateTopupPaymentSession,
  getTopupByOrderId,
  getTopupById,
  updateTopupStatus,
  getWalletByUserId,
  getTransactionList,
  getTransactionDetails,
  creditWalletForTopup,
} from "../models/walletModel.js";

const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2025-01-01";

const CASHFREE_BASE_URL =
  process.env.CASHFREE_ENVIRONMENT === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const getCashfreeHeaders = () => ({
  "x-client-id": process.env.CASHFREE_CLIENT_ID,
  "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
  "x-api-version": CASHFREE_API_VERSION,
  Accept: "application/json",
  "Content-Type": "application/json",
});

const getPaymentStatusReason = (payment, status) => {
  const errorDetails =
    payment?.error_details && typeof payment.error_details === "object"
      ? payment.error_details
      : {};

  const message =
    errorDetails.error_description ||
    errorDetails.error_reason ||
    payment?.payment_message ||
    payment?.message;

  if (message) {
    return String(message).trim().slice(0, 500);
  }

  if (status === "USER_DROPPED") {
    return "Payment was cancelled before completion. No amount was added to your wallet.";
  }

  if (status === "FAILED") {
    return "Payment could not be completed. No amount was added to your wallet.";
  }

  return "Your payment is being processed. Your wallet has not been credited yet.";
};

const cashfreeRequest = async (path, options = {}) => {
  if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
    const error = new Error("Cashfree credentials are not configured");
    error.code = "CASHFREE_CONFIG_ERROR";
    throw error;
  }

  const response = await fetch(`${CASHFREE_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getCashfreeHeaders(),
      ...(options.headers || {}),
    },
  });

  const responseText = await response.text();

  let data;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = { message: responseText };
  }

  if (!response.ok) {
    const error = new Error(
      data.message || data.messageText || "Cashfree request failed",
    );

    error.code = "CASHFREE_API_ERROR";
    error.status = response.status;
    error.details = data;

    throw error;
  }

  return data;
};

const generateOrderId = (userId) => {
  return `WALLET_${userId}_${Date.now()}_${crypto
    .randomBytes(5)
    .toString("hex")}`;
};

const getWallet = async (userId) => {
  return await getOrCreateWallet(userId);
};

const createTopupOrder = async (userId, amount) => {
  const wallet = await getOrCreateWallet(userId);
  const user = await getUserForPayment(userId);

  if (!user) {
    const error = new Error("User not found");
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  if (!user.phone) {
    const error = new Error("User phone number is required for payment");
    error.code = "PHONE_REQUIRED";
    throw error;
  }

  const orderId = generateOrderId(userId);

  const topupId = await createTopup(userId, wallet.id, amount, orderId);

  const payload = {
    order_amount: Number(Number(amount).toFixed(2)),
    order_currency: "INR",
    order_id: orderId,
    customer_details: {
      customer_id: String(userId),
      customer_name: user.name,
      customer_phone: user.phone,
    },
  };

  if (process.env.CASHFREE_RETURN_URL) {
    payload.order_meta = {
      return_url: `${process.env.CASHFREE_RETURN_URL}?order_id={order_id}`,
    };
  }

  if (process.env.CASHFREE_NOTIFY_URL) {
    payload.order_meta = {
      ...(payload.order_meta || {}),
      notify_url: process.env.CASHFREE_NOTIFY_URL,
    };
  }

  let response;

  try {
    response = await cashfreeRequest("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const definitelyRejected =
      error.code === "CASHFREE_CONFIG_ERROR" ||
      (error.code === "CASHFREE_API_ERROR" &&
        [400, 401, 403, 404, 422].includes(error.status));

    if (definitelyRejected) {
      const reason = String(
        error.details?.message ||
          error.message ||
          "Payment order creation was rejected.",
      ).slice(0, 500);

      await updateTopupStatus(
        topupId,
        "failed",
        null,
        null,
        null,
        null,
        null,
        reason,
      );
    } else {
      await updateTopupStatus(
        topupId,
        "pending",
        null,
        null,
        null,
        null,
        null,
        "Payment order creation could not be confirmed. Please verify the payment status before retrying.",
      );
    }

    throw error;
  }

  await updateTopupPaymentSession(
    topupId,
    response.cf_order_id || null,
    response.payment_session_id,
  );

  return {
    topup_id: topupId,
    order_id: orderId,
    cf_order_id: response.cf_order_id || null,
    payment_session_id: response.payment_session_id,
    amount: Number(amount),
    currency: "INR",
    payment_status: "pending",
  };
};

const verifyCashfreePayment = async (userId, orderId) => {
  const topup = await getTopupByOrderId(orderId, userId);

  if (!topup) {
    const error = new Error("Top-up not found");
    error.code = "TOPUP_NOT_FOUND";
    throw error;
  }

  if (topup.payment_status === "success") {
    return {
      topup,
      wallet: await getWalletByUserId(userId),
      payment_status: "success",
      status_reason: null,
    };
  }

  const payments = await cashfreeRequest(
    `/orders/${encodeURIComponent(orderId)}/payments`,
    { method: "GET" },
  );

  const paymentRecords = Array.isArray(payments) ? payments : [];

  const successfulPayment = paymentRecords.find(
    (payment) => String(payment.payment_status).toUpperCase() === "SUCCESS",
  );

  if (successfulPayment) {
    const wallet = await creditWalletForTopup(orderId, successfulPayment);

    return {
      topup: await getTopupById(topup.id, userId),
      wallet,
      payment_status: "success",
      status_reason: null,
    };
  }

  const pendingPayment = paymentRecords.find((payment) =>
    ["PENDING", "NOT_ATTEMPTED"].includes(
      String(payment.payment_status).toUpperCase(),
    ),
  );

  if (pendingPayment) {
    const status = String(pendingPayment.payment_status).toUpperCase();

    const reason = getPaymentStatusReason(pendingPayment, status);

    await updateTopupStatus(
      topup.id,
      "pending",
      pendingPayment.cf_payment_id || null,
      pendingPayment.bank_reference || pendingPayment.cf_reference_id || null,
      pendingPayment.payment_group || null,
      pendingPayment.bank_reference || null,
      null,
      reason,
    );

    const updatedTopup = await getTopupById(topup.id, userId);

    return {
      topup: updatedTopup,
      wallet: await getWalletByUserId(userId),
      payment_status: updatedTopup.payment_status,
      status_reason: updatedTopup.status_reason,
    };
  }

  const failedPayment = [...paymentRecords]
    .reverse()
    .find((payment) =>
      ["FAILED", "USER_DROPPED"].includes(
        String(payment.payment_status).toUpperCase(),
      ),
    );

  if (failedPayment) {
    const status = String(failedPayment.payment_status).toUpperCase();

    const reason = getPaymentStatusReason(failedPayment, status);

    await updateTopupStatus(
      topup.id,
      "failed",
      failedPayment.cf_payment_id || null,
      failedPayment.bank_reference || failedPayment.cf_reference_id || null,
      failedPayment.payment_group || null,
      failedPayment.bank_reference || null,
      null,
      reason,
    );

    const updatedTopup = await getTopupById(topup.id, userId);

    return {
      topup: updatedTopup,
      wallet: await getWalletByUserId(userId),
      payment_status: "failed",
      status_reason: updatedTopup.status_reason,
    };
  }

  // Empty or unrecognised Cashfree responses are not proof of failure.
  const currentStatus =
    topup.payment_status === "failed" ? "failed" : "pending";

  const fallbackReason =
    topup.status_reason ||
    (currentStatus === "failed"
      ? "Payment could not be completed. No amount was added to your wallet."
      : "Your payment status is not yet confirmed. Your wallet has not been credited yet.");

  await updateTopupStatus(
    topup.id,
    currentStatus,
    null,
    null,
    null,
    null,
    null,
    fallbackReason,
  );

  const updatedTopup = await getTopupById(topup.id, userId);

  return {
    topup: updatedTopup,
    wallet: await getWalletByUserId(userId),
    payment_status: updatedTopup.payment_status,
    status_reason: updatedTopup.status_reason,
  };
};

const verifyWebhookSignature = (signature, timestamp, rawBody) => {
  if (
    !signature ||
    !timestamp ||
    !rawBody ||
    !process.env.CASHFREE_CLIENT_SECRET
  ) {
    return false;
  }

  const signedPayload = `${timestamp}${rawBody}`;

  const generatedSignature = crypto
    .createHmac("sha256", process.env.CASHFREE_CLIENT_SECRET)
    .update(signedPayload)
    .digest("base64");

  const generatedBuffer = Buffer.from(generatedSignature);
  const signatureBuffer = Buffer.from(signature);

  if (generatedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(generatedBuffer, signatureBuffer);
};

const processWebhook = async (rawBody, signature, timestamp) => {
  const valid = verifyWebhookSignature(signature, timestamp, rawBody);

  if (!valid) {
    const error = new Error("Invalid Cashfree webhook signature");
    error.code = "INVALID_WEBHOOK_SIGNATURE";
    throw error;
  }

  let payload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    const error = new Error("Invalid webhook payload");
    error.code = "INVALID_WEBHOOK_PAYLOAD";
    throw error;
  }

  const orderId = payload?.data?.order?.order_id;
  const payment = payload?.data?.payment;

  if (!orderId || !payment) {
    return {
      processed: false,
      message: "Webhook payload ignored",
    };
  }

  const paymentStatus = String(payment.payment_status || "").toUpperCase();

  if (paymentStatus === "SUCCESS") {
    const wallet = await creditWalletForTopup(orderId, payment);

    return {
      processed: true,
      payment_status: "success",
      wallet,
    };
  }

  const topup = await getTopupByOrderId(orderId);

  if (!topup) {
    return {
      processed: false,
      message: "Top-up not found",
    };
  }

  const result = await verifyCashfreePayment(topup.user_id, orderId);

  return {
    processed: true,
    payment_status: result.payment_status,
    wallet: result.wallet,
  };
};

const getWalletTransactions = async (
  userId,
  type = "all",
  dateFilter = "all",
  cursor = null,
) => {
  const wallet = await getOrCreateWallet(userId);

  return await getTransactionList(
    userId,
    wallet.id,
    type,
    dateFilter,
    cursor,
    10,
  );
};

const getWalletTransaction = async (userId, transactionId, sourceType) => {
  const wallet = await getOrCreateWallet(userId);

  return await getTransactionDetails(
    userId,
    wallet.id,
    transactionId,
    sourceType,
  );
};

export {
  getWallet,
  createTopupOrder,
  verifyCashfreePayment,
  processWebhook,
  getWalletTransactions,
  getWalletTransaction,
};
