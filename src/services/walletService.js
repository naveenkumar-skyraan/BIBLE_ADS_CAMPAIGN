import crypto from "crypto";

import {
  getOrCreateWallet,
  getUserForPayment,
  createTopup,
  updateTopupPaymentSession,
  getTopupByOrderId,
  getTopupById,
  getTopupsByUserId,
  getTopupCountByUserId,
  updateTopupStatus,
  getWalletByUserId,
  getTransactionsByWalletId,
  getTransactionCountByWalletId,
  getTransactionById,
  allocateFund,
  getFundById,
  getFundsByUserId,
  getFundCountByUserId,
  spendFund,
  requestRefund,
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

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      message: text,
    };
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

  try {
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

    const response = await cashfreeRequest("/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });

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
  } catch (error) {
    await updateTopupStatus(topupId, "failed");

    throw error;
  }
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
    };
  }

  const payments = await cashfreeRequest(
    `/orders/${encodeURIComponent(orderId)}/payments`,
    {
      method: "GET",
    },
  );

  const successfulPayment = Array.isArray(payments)
    ? payments.find((payment) => payment.payment_status === "SUCCESS")
    : null;

  if (successfulPayment) {
    const wallet = await creditWalletForTopup(orderId, successfulPayment);

    return {
      topup: await getTopupById(topup.id, userId),
      wallet,
      payment_status: "success",
    };
  }

  const pendingPayment = Array.isArray(payments)
    ? payments.find((payment) => payment.payment_status === "PENDING")
    : null;

  if (pendingPayment) {
    return {
      topup: await getTopupById(topup.id, userId),
      wallet: await getWalletByUserId(userId),
      payment_status: "pending",
    };
  }

  await updateTopupStatus(topup.id, "failed");

  return {
    topup: await getTopupById(topup.id, userId),
    wallet: await getWalletByUserId(userId),
    payment_status: "failed",
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

  const paymentStatus = payment.payment_status;

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

  if (topup.payment_status !== "success") {
    const status =
      paymentStatus === "USER_DROPPED" || paymentStatus === "FAILED"
        ? "failed"
        : "pending";

    await updateTopupStatus(
      topup.id,
      status,
      payment.cf_payment_id || null,
      payment.bank_reference || null,
      payment.payment_group || null,
      payment.bank_reference || null,
    );
  }

  return {
    processed: true,
    payment_status: topup.payment_status,
  };
};

const getWalletTransactions = async (userId, page, limit) => {
  const wallet = await getOrCreateWallet(userId);

  const offset = (page - 1) * limit;

  const transactions = await getTransactionsByWalletId(
    wallet.id,
    offset,
    limit,
  );

  const total = await getTransactionCountByWalletId(wallet.id);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
};

const getWalletTransaction = async (userId, transactionId) => {
  const wallet = await getOrCreateWallet(userId);

  return await getTransactionById(transactionId, wallet.id);
};

const getTopupHistory = async (userId, page, limit) => {
  const offset = (page - 1) * limit;

  const topups = await getTopupsByUserId(userId, offset, limit);

  const total = await getTopupCountByUserId(userId);

  return {
    topups,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
};

const getTopupDetails = async (userId, topupId) => {
  return await getTopupById(topupId, userId);
};

const allocateWalletFund = async (userId, businessId, adId, amount) => {
  return await allocateFund(userId, businessId, adId, amount);
};

const getAdFunds = async (userId, page, limit, status) => {
  const offset = (page - 1) * limit;

  const funds = await getFundsByUserId(userId, offset, limit, status);

  const total = await getFundCountByUserId(userId, status);

  return {
    funds,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
};

const getAdFund = async (userId, fundId) => {
  return await getFundById(fundId, userId);
};

const spendWalletFund = async (userId, fundId, amount) => {
  return await spendFund(fundId, userId, amount);
};

const requestWalletFundRefund = async (userId, fundId) => {
  return await requestRefund(fundId, userId);
};

export {
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
  requestWalletFundRefund,
};
