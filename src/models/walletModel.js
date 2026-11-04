import pool from "../configs/database/db.js";

const getWalletByUserId = async (userId, connection = pool) => {
  const [rows] = await connection.execute(
    `
      SELECT id, user_id, balance, created_at, updated_at
      FROM wallets
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
};

const createWallet = async (userId, connection = pool) => {
  const [result] = await connection.execute(
    `
      INSERT INTO wallets (user_id, balance)
      VALUES (?, 0.00)
    `,
    [userId],
  );

  return result.insertId;
};

const getOrCreateWallet = async (userId) => {
  let wallet = await getWalletByUserId(userId);

  if (wallet) return wallet;

  try {
    await createWallet(userId);
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") throw error;
  }

  return await getWalletByUserId(userId);
};

const getUserForPayment = async (userId) => {
  const [rows] = await pool.execute(
    `
      SELECT id, name, phone
      FROM users
      WHERE id = ?
      AND is_account_deleted = 0
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
};

const createTopup = async (userId, walletId, amount, orderId) => {
  const [result] = await pool.execute(
    `
      INSERT INTO wallet_topups (
        user_id,
        wallet_id,
        amount,
        order_id,
        payment_status,
        status_reason
      )
      VALUES (?, ?, ?, ?, 'pending', ?)
    `,
    [
      userId,
      walletId,
      amount,
      orderId,
      "Payment is awaiting confirmation. Complete the payment to add money to your wallet.",
    ],
  );

  return result.insertId;
};

const updateTopupPaymentSession = async (
  topupId,
  cfOrderId,
  paymentSessionId,
) => {
  await pool.execute(
    `
           UPDATE wallet_topups
      SET
        cf_order_id = ?,
        payment_session_id = ?,
        updated_at = NOW()
      WHERE id = ?
    `,
    [cfOrderId, paymentSessionId, topupId],
  );
};

const getTopupByOrderId = async (
  orderId,
  userId = null,
  connection = pool,
  forUpdate = false,
) => {
  const conditions = ["order_id = ?"];
  const values = [orderId];

  if (userId !== null) {
    conditions.push("user_id = ?");
    values.push(userId);
  }

  const [rows] = await connection.execute(
    `
SELECT
  id,
  user_id,
  wallet_id,
  amount,
  order_id,
  cf_order_id,
  cf_payment_id,
  cf_reference_id,
  payment_status,
  status_reason,
  payment_method,
  payment_reference,
  paid_at,
  created_at,
  updated_at
FROM wallet_topups
WHERE ${conditions.join(" AND ")}
LIMIT 1
${forUpdate ? "FOR UPDATE" : ""}
    `,
    values,
  );

  return rows[0] || null;
};

const getTopupById = async (topupId, userId) => {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        user_id,
        wallet_id,
        amount,
        order_id,
        cf_order_id,
        cf_payment_id,
        cf_reference_id,
        payment_status,
        status_reason,
        payment_method,
        payment_reference,
        paid_at,
        created_at,
        updated_at
      FROM wallet_topups
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `,
    [topupId, userId],
  );

  return rows[0] || null;
};

const updateTopupStatus = async (
  topupId,
  status,
  paymentId = null,
  referenceId = null,
  paymentMethod = null,
  paymentReference = null,
  paidAt = null,
  statusReason = null,
) => {
  await pool.execute(
    `
      UPDATE wallet_topups
      SET
        payment_status = ?,
        status_reason = CASE
          WHEN ? = 'success' THEN NULL
          ELSE COALESCE(?, status_reason)
        END,
        cf_payment_id = COALESCE(?, cf_payment_id),
        cf_reference_id = COALESCE(?, cf_reference_id),
        payment_method = COALESCE(?, payment_method),
        payment_reference = COALESCE(?, payment_reference),
        paid_at = COALESCE(?, paid_at),
        updated_at = NOW()
      WHERE id = ?
        AND payment_status <> 'success'
        AND (
          payment_status <> 'failed'
          OR ? IN ('failed', 'success')
        )
    `,
    [
      status,
      status,
      statusReason,
      paymentId,
      referenceId,
      paymentMethod,
      paymentReference,
      paidAt,
      topupId,
      status,
    ],
  );
};

const creditWalletForTopup = async (orderId, payment) => {
  if (!payment || String(payment.payment_status).toUpperCase() !== "SUCCESS") {
    const error = new Error("Payment is not successful");
    error.code = "PAYMENT_NOT_SUCCESSFUL";
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const topup = await getTopupByOrderId(orderId, null, connection, true);

    if (!topup) {
      const error = new Error("Top-up not found");
      error.code = "TOPUP_NOT_FOUND";
      throw error;
    }

    if (Number(payment.payment_amount) !== Number(topup.amount)) {
      const error = new Error("Payment amount does not match top-up amount");
      error.code = "PAYMENT_AMOUNT_MISMATCH";
      throw error;
    }

    if (topup.payment_status === "success") {
      await connection.commit();
      return await getWalletByUserId(topup.user_id);
    }

    const [walletRows] = await connection.execute(
      `
        SELECT id, balance
        FROM wallets
        WHERE id = ?
        FOR UPDATE
      `,
      [topup.wallet_id],
    );

    const wallet = walletRows[0];

    if (!wallet) {
      const error = new Error("Wallet not found");
      error.code = "WALLET_NOT_FOUND";
      throw error;
    }

    const balanceBefore = Number(wallet.balance);
    const amount = Number(topup.amount);
    const balanceAfter = Number((balanceBefore + amount).toFixed(2));

    await connection.execute(
      `
        UPDATE wallets
        SET balance = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [balanceAfter, wallet.id],
    );

    const paymentId = payment.cf_payment_id || null;
    const referenceId =
      payment.bank_reference || payment.cf_reference_id || null;
    const paymentMethod = payment.payment_group || null;

    await connection.execute(
      `
    UPDATE wallet_topups
    SET
      payment_status = 'success',
      status_reason = NULL,
      cf_payment_id = COALESCE(?, cf_payment_id),
      cf_reference_id = COALESCE(?, cf_reference_id),
      payment_method = COALESCE(?, payment_method),
      payment_reference = COALESCE(?, payment_reference),
      paid_at = NOW(),
      updated_at = NOW()
    WHERE id = ?
      `,
      [paymentId, referenceId, paymentMethod, referenceId, topup.id],
    );

    await connection.execute(
      `
        INSERT INTO wallet_transactions (
          wallet_id,
          user_id,
          transaction_type,
          transaction_direction,
          amount,
          balance_before,
          balance_after,
          reference_id,
          reference_type,
          description
        )
        VALUES (?, ?, 'top_up', 'credit', ?, ?, ?, ?, 'wallet_topup', ?)
      `,
      [
        wallet.id,
        topup.user_id,
        amount,
        balanceBefore,
        balanceAfter,
        topup.id,
        `Wallet top-up via Cashfree order ${orderId}`,
      ],
    );

    await connection.commit();

    return await getWalletByUserId(topup.user_id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getTransactionList = async (
  userId,
  walletId,
  type = "all",
  dateFilter = "all",
  cursor = null,
  limit = 10,
) => {
  const dateConditions = {
    all: "",

    today: `
      AND created_at >= CURDATE()
      AND created_at < CURDATE() + INTERVAL 1 DAY
    `,

    yesterday: `
      AND created_at >= CURDATE() - INTERVAL 1 DAY
      AND created_at < CURDATE()
    `,

    last_week: `
    AND created_at >= DATE_SUB(
        DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY),
        INTERVAL 1 WEEK
    )
    AND created_at < DATE_SUB(
        CURDATE(),
        INTERVAL WEEKDAY(CURDATE()) DAY
    )
`,

    last_month: `
      AND created_at >= DATE_FORMAT(
        CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01'
      )
      AND created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')
    `,

    last_year: `
      AND created_at >= MAKEDATE(YEAR(CURDATE()) - 1, 1)
      AND created_at < MAKEDATE(YEAR(CURDATE()), 1)
    `,
  };

  const dateCondition = dateConditions[dateFilter] ?? "";

  let transactionQuery = "";
  let topupQuery = "";

  const transactionParams = [];
  const topupParams = [];

  if (["all", "added", "ads_spend"].includes(type)) {
    let transactionTypeCondition = "";

    if (type === "added") {
      transactionTypeCondition = "AND transaction_type = 'top_up'";
    }

    if (type === "ads_spend") {
      transactionTypeCondition = "AND transaction_type = 'ad_spend'";
    }

    transactionQuery = `
      SELECT
        id AS source_id,
        'wallet_transaction' AS source_type,
        2 AS source_rank,
        created_at AS transaction_date,
        transaction_type,
        transaction_direction,
        amount,
        balance_before,
        balance_after,
        business_id,
        campaign_id,
        reference_id,
        reference_type,
        description,
        NULL AS payment_status,
        NULL AS status_reason,
        NULL AS order_id,
        NULL AS payment_method
      FROM wallet_transactions
      WHERE user_id = ?
        AND wallet_id = ?
        ${transactionTypeCondition}
        ${dateCondition}
    `;

    transactionParams.push(userId, walletId);
  }

  if (["all", "pending", "failed"].includes(type)) {
    let statusCondition = "";

    if (type === "pending") {
      statusCondition = "AND payment_status = 'pending'";
    }

    if (type === "failed") {
      statusCondition = "AND payment_status = 'failed'";
    }

    topupQuery = `
      SELECT
        id AS source_id,
        'wallet_topup' AS source_type,
        1 AS source_rank,
        created_at AS transaction_date,
        'top_up' AS transaction_type,
        'credit' AS transaction_direction,
        amount,
        NULL AS balance_before,
        NULL AS balance_after,
        NULL AS business_id,
        NULL AS campaign_id,
        NULL AS reference_id,
        NULL AS reference_type,
        'Wallet top-up' AS description,
        payment_status,
        status_reason,
        order_id,
        payment_method
      FROM wallet_topups
      WHERE user_id = ?
        AND wallet_id = ?
        ${statusCondition}
        AND payment_status IN ('pending', 'failed')
        ${dateCondition}
    `;

    topupParams.push(userId, walletId);
  }

  const queries = [transactionQuery, topupQuery].filter(Boolean);

  if (!queries.length) {
    return {
      transactions: [],
      pagination: {
        limit: 10,
        has_more: false,
        next_cursor: null,
      },
    };
  }

  const unionQuery = queries.join(" UNION ALL ");

  let cursorCondition = "";
  const cursorParams = [];

  if (cursor) {
    const cursorRank = cursor.source_type === "wallet_transaction" ? 2 : 1;

    cursorCondition = `
      WHERE (
        transaction_date < ?
        OR (
          transaction_date = ?
          AND source_rank < ?
        )
        OR (
          transaction_date = ?
          AND source_rank = ?
          AND source_id < ?
        )
      )
    `;

    cursorParams.push(
      cursor.transaction_date,
      cursor.transaction_date,
      cursorRank,
      cursor.transaction_date,
      cursorRank,
      cursor.source_id,
    );
  }

  const safeLimit = 10;

  const sql = `
    SELECT
      source_id,
      source_type,
      transaction_date,
      transaction_type,
      transaction_direction,
      amount,
      balance_before,
      balance_after,
      business_id,
      campaign_id,
      reference_id,
      reference_type,
      description,
      payment_status,
      status_reason,
      order_id,
      payment_method
    FROM (
      ${unionQuery}
    ) AS combined_transactions
    ${cursorCondition}
    ORDER BY
      transaction_date DESC,
      source_rank DESC,
      source_id DESC
    LIMIT ${safeLimit + 1}
  `;

  const [rows] = await pool.query(sql, [
    ...transactionParams,
    ...topupParams,
    ...cursorParams,
  ]);

  const hasMore = rows.length > safeLimit;
  const transactions = rows.slice(0, safeLimit);

  const lastTransaction =
    transactions.length > 0 ? transactions[transactions.length - 1] : null;

  const nextCursor =
    hasMore && lastTransaction
      ? {
          transaction_date: lastTransaction.transaction_date,
          source_type: lastTransaction.source_type,
          source_id: lastTransaction.source_id,
        }
      : null;

  return {
    transactions,
    pagination: {
      limit: safeLimit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  };
};

const getTransactionDetails = async (
  userId,
  walletId,
  transactionId,
  sourceType,
) => {
  if (sourceType === "wallet_transaction") {
    const [rows] = await pool.execute(
      `
        SELECT
          wt.id AS source_id,
          'wallet_transaction' AS source_type,
          wt.transaction_type,
          wt.transaction_direction,
          wt.amount,
          wt.business_id,
          wt.campaign_id,
          wt.balance_before,
          wt.balance_after,
          wt.reference_id,
          wt.reference_type,
          wt.description,
          wt.created_at AS transaction_date,
          CASE
            WHEN wt.transaction_type = 'top_up'
              AND wt.reference_type = 'wallet_topup'
            THEN COALESCE(t.payment_status, 'success')
            ELSE NULL
          END AS payment_status,
          t.status_reason,
          t.order_id,
          t.cf_order_id,
          t.cf_payment_id,
          t.cf_reference_id,
          t.payment_method,
          t.payment_reference,
          t.paid_at
        FROM wallet_transactions wt
        LEFT JOIN wallet_topups t
          ON t.id = wt.reference_id
          AND wt.reference_type = 'wallet_topup'
        WHERE wt.id = ?
          AND wt.user_id = ?
          AND wt.wallet_id = ?
        LIMIT 1
      `,
      [transactionId, userId, walletId],
    );

    return rows[0] || null;
  }

  if (sourceType === "wallet_topup") {
    const [rows] = await pool.execute(
      `
        SELECT
          id AS source_id,
          'wallet_topup' AS source_type,
          'top_up' AS transaction_type,
          'credit' AS transaction_direction,
          amount,
          NULL AS balance_before,
          NULL AS balance_after,
          id AS reference_id,
          'wallet_topup' AS reference_type,
          CONCAT('Wallet top-up via Cashfree order ', order_id) AS description,
          created_at AS transaction_date,
          payment_status,
          status_reason,
          order_id,
          cf_order_id,
          cf_payment_id,
          cf_reference_id,
          payment_method,
          payment_reference,
          paid_at
        FROM wallet_topups
        WHERE id = ?
        AND user_id = ?
        AND wallet_id = ?
        AND payment_status IN ('pending', 'failed')
        LIMIT 1
      `,
      [transactionId, userId, walletId],
    );

    return rows[0] || null;
  }

  return null;
};

export {
  getWalletByUserId,
  createWallet,
  getOrCreateWallet,
  getUserForPayment,
  createTopup,
  updateTopupPaymentSession,
  getTopupByOrderId,
  getTopupById,
  updateTopupStatus,
  creditWalletForTopup,
  getTransactionDetails,
};
