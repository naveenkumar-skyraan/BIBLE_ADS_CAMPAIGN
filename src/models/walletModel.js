import pool from "../configs/database/db.js";

const getWalletByUserId = async (userId, connection = pool) => {
    const [rows] = await connection.execute(
        `
        SELECT
            id,
            user_id,
            balance,
            created_at,
            updated_at
        FROM wallets
        WHERE user_id = ?
        LIMIT 1
        `,
        [userId]
    );

    return rows[0] || null;
};

const createWallet = async (userId, connection = pool) => {
    const [result] = await connection.execute(
        `
        INSERT INTO wallets (
            user_id,
            balance
        )
        VALUES (?, 0.00)
        `,
        [userId]
    );

    return result.insertId;
};

const getOrCreateWallet = async (userId) => {
    let wallet = await getWalletByUserId(userId);

    if (wallet) {
        return wallet;
    }

    try {
        await createWallet(userId);
    } catch (error) {
        if (error.code !== "ER_DUP_ENTRY") {
            throw error;
        }
    }

    wallet = await getWalletByUserId(userId);

    return wallet;
};

const getUserForPayment = async (userId) => {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            name,
            phone
        FROM users
        WHERE id = ?
        AND is_account_deleted = 0
        LIMIT 1
        `,
        [userId]
    );

    return rows[0] || null;
};

const createTopup = async (
    userId,
    walletId,
    amount,
    orderId
) => {
    const [result] = await pool.execute(
        `
        INSERT INTO wallet_topups (
            user_id,
            wallet_id,
            amount,
            order_id,
            payment_status
        )
        VALUES (?, ?, ?, ?, 'pending')
        `,
        [
            userId,
            walletId,
            amount,
            orderId
        ]
    );

    return result.insertId;
};

const updateTopupPaymentSession = async (
    topupId,
    cfOrderId,
    paymentSessionId
) => {
    await pool.execute(
        `
        UPDATE wallet_topups
        SET
            cf_order_id = ?,
            payment_session_id = ?
        WHERE id = ?
        `,
        [
            cfOrderId,
            paymentSessionId,
            topupId
        ]
    );
};

const getTopupByOrderId = async (
    orderId,
    userId = null,
    connection = pool,
    forUpdate = false
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
            payment_session_id,
            payment_status,
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
        values
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
            payment_session_id,
            payment_status,
            payment_method,
            payment_reference,
            paid_at,
            created_at,
            updated_at
        FROM wallet_topups
        WHERE id = ?
        AND user_id = ?
        LIMIT 1
        `,
        [
            topupId,
            userId
        ]
    );

    return rows[0] || null;
};

const getTopupsByUserId = async (
    userId,
    offset,
    limit
) => {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            wallet_id,
            amount,
            order_id,
            cf_order_id,
            cf_payment_id,
            payment_status,
            payment_method,
            payment_reference,
            paid_at,
            created_at,
            updated_at
        FROM wallet_topups
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ? OFFSET ?
        `,
        [
            userId,
            limit,
            offset
        ]
    );

    return rows;
};

const getTopupCountByUserId = async (userId) => {
    const [rows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM wallet_topups
        WHERE user_id = ?
        `,
        [userId]
    );

    return rows[0].total;
};

const updateTopupStatus = async (
    topupId,
    status,
    paymentId = null,
    referenceId = null,
    paymentMethod = null,
    paymentReference = null,
    paidAt = null
) => {
    await pool.execute(
        `
        UPDATE wallet_topups
        SET
            payment_status = ?,
            cf_payment_id = COALESCE(?, cf_payment_id),
            cf_reference_id = COALESCE(?, cf_reference_id),
            payment_method = COALESCE(?, payment_method),
            payment_reference = COALESCE(?, payment_reference),
            paid_at = COALESCE(?, paid_at)
        WHERE id = ?
        `,
        [
            status,
            paymentId,
            referenceId,
            paymentMethod,
            paymentReference,
            paidAt,
            topupId
        ]
    );
};

const getTransactionsByWalletId = async (
    walletId,
    offset,
    limit
) => {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            wallet_id,
            transaction_type,
            transaction_direction,
            amount,
            balance_before,
            balance_after,
            reference_id,
            reference_type,
            description,
            created_at
        FROM wallet_transactions
        WHERE wallet_id = ?
        ORDER BY id DESC
        LIMIT ? OFFSET ?
        `,
        [
            walletId,
            limit,
            offset
        ]
    );

    return rows;
};

const getTransactionCountByWalletId = async (walletId) => {
    const [rows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM wallet_transactions
        WHERE wallet_id = ?
        `,
        [walletId]
    );

    return rows[0].total;
};

const getTransactionById = async (
    transactionId,
    walletId
) => {
    const [rows] = await pool.execute(
        `
        SELECT
            id,
            wallet_id,
            transaction_type,
            transaction_direction,
            amount,
            balance_before,
            balance_after,
            reference_id,
            reference_type,
            description,
            created_at
        FROM wallet_transactions
        WHERE id = ?
        AND wallet_id = ?
        LIMIT 1
        `,
        [
            transactionId,
            walletId
        ]
    );

    return rows[0] || null;
};

const getAdById = async (
    adId,
    userId,
    businessId,
    connection = pool,
    forUpdate = false
) => {
    const [rows] = await connection.execute(
        `
        SELECT
            id,
            user_id,
            business_id,
            status
        FROM ads
        WHERE id = ?
        AND user_id = ?
        AND business_id = ?
        LIMIT 1
        ${forUpdate ? "FOR UPDATE" : ""}
        `,
        [
            adId,
            userId,
            businessId
        ]
    );

    return rows[0] || null;
};

const getBusinessById = async (
    businessId,
    userId,
    connection = pool
) => {
    const [rows] = await connection.execute(
        `
        SELECT
            id,
            user_id
        FROM business_details
        WHERE id = ?
        AND user_id = ?
        LIMIT 1
        `,
        [
            businessId,
            userId
        ]
    );

    return rows[0] || null;
};

const getActiveFundByAdId = async (
    adId,
    userId,
    connection = pool,
    forUpdate = false
) => {
    const [rows] = await connection.execute(
        `
        SELECT
            id,
            user_id,
            business_id,
            ad_id,
            allocated_amount,
            spent_amount,
            remaining_amount,
            status,
            refund_amount,
            created_at,
            updated_at
        FROM ad_fund_allocations
        WHERE ad_id = ?
        AND user_id = ?
        AND status IN ('active', 'completed', 'refund_pending', 'refunded')
        ORDER BY id DESC
        LIMIT 1
        ${forUpdate ? "FOR UPDATE" : ""}
        `,
        [
            adId,
            userId
        ]
    );

    return rows[0] || null;
};

const getFundById = async (
    fundId,
    userId,
    connection = pool,
    forUpdate = false
) => {
    const [rows] = await connection.execute(
        `
        SELECT
            id,
            user_id,
            business_id,
            ad_id,
            allocated_amount,
            spent_amount,
            remaining_amount,
            status,
            refund_amount,
            created_at,
            updated_at
        FROM ad_fund_allocations
        WHERE id = ?
        AND user_id = ?
        LIMIT 1
        ${forUpdate ? "FOR UPDATE" : ""}
        `,
        [
            fundId,
            userId
        ]
    );

    return rows[0] || null;
};

const getFundsByUserId = async (
    userId,
    offset,
    limit,
    status = null
) => {
    const conditions = ["user_id = ?"];
    const values = [userId];

    if (status) {
        conditions.push("status = ?");
        values.push(status);
    }

    values.push(limit);
    values.push(offset);

    const [rows] = await pool.execute(
        `
        SELECT
            id,
            user_id,
            business_id,
            ad_id,
            allocated_amount,
            spent_amount,
            remaining_amount,
            status,
            refund_amount,
            created_at,
            updated_at
        FROM ad_fund_allocations
        WHERE ${conditions.join(" AND ")}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
        `,
        values
    );

    return rows;
};

const getFundCountByUserId = async (
    userId,
    status = null
) => {
    const conditions = ["user_id = ?"];
    const values = [userId];

    if (status) {
        conditions.push("status = ?");
        values.push(status);
    }

    const [rows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM ad_fund_allocations
        WHERE ${conditions.join(" AND ")}
        `,
        values
    );

    return rows[0].total;
};

const allocateFund = async (
    userId,
    businessId,
    adId,
    amount
) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const business = await getBusinessById(
            businessId,
            userId,
            connection
        );

        if (!business) {
            const error = new Error(
                "Business not found"
            );
            error.code = "BUSINESS_NOT_FOUND";
            throw error;
        }

        const ad = await getAdById(
            adId,
            userId,
            businessId,
            connection,
            true
        );

        if (!ad) {
            const error = new Error(
                "Ad not found"
            );
            error.code = "AD_NOT_FOUND";
            throw error;
        }

        const existingFund = await getActiveFundByAdId(
            adId,
            userId,
            connection,
            true
        );

        if (
            existingFund &&
            existingFund.status !== "refunded"
        ) {
            const error = new Error(
                "Fund already exists for this ad"
            );
            error.code = "FUND_ALREADY_EXISTS";
            throw error;
        }

        const wallet = await getWalletByUserId(
            userId,
            connection
        );

        if (!wallet) {
            const error = new Error(
                "Wallet not found"
            );
            error.code = "WALLET_NOT_FOUND";
            throw error;
        }

        const [walletRows] = await connection.execute(
            `
            SELECT
                id,
                balance
            FROM wallets
            WHERE id = ?
            FOR UPDATE
            `,
            [wallet.id]
        );

        const lockedWallet = walletRows[0];

        if (
            !lockedWallet ||
            Number(lockedWallet.balance) < Number(amount)
        ) {
            const error = new Error(
                "Insufficient wallet balance"
            );
            error.code = "INSUFFICIENT_BALANCE";
            throw error;
        }

        const balanceBefore = Number(
            lockedWallet.balance
        );

        const balanceAfter =
            balanceBefore - Number(amount);

        const [allocationResult] =
            await connection.execute(
                `
                INSERT INTO ad_fund_allocations (
                    user_id,
                    business_id,
                    ad_id,
                    allocated_amount,
                    spent_amount,
                    remaining_amount,
                    status,
                    refund_amount
                )
                VALUES (?, ?, ?, ?, 0.00, ?, 'active', 0.00)
                `,
                [
                    userId,
                    businessId,
                    adId,
                    amount,
                    amount
                ]
            );

        await connection.execute(
            `
            UPDATE wallets
            SET balance = ?
            WHERE id = ?
            `,
            [
                balanceAfter,
                lockedWallet.id
            ]
        );

        await connection.execute(
            `
            INSERT INTO wallet_transactions (
                wallet_id,
                transaction_type,
                transaction_direction,
                amount,
                balance_before,
                balance_after,
                reference_id,
                reference_type,
                description
            )
            VALUES (
                ?,
                'fund_allocation',
                'debit',
                ?,
                ?,
                ?,
                ?,
                'ad_fund',
                ?
            )
            `,
            [
                lockedWallet.id,
                amount,
                balanceBefore,
                balanceAfter,
                allocationResult.insertId,
                `Fund allocated to ad ${adId}`
            ]
        );

        await connection.commit();

        return {
            allocation_id: allocationResult.insertId,
            wallet_balance: balanceAfter
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const spendFund = async (
    fundId,
    userId,
    amount
) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const fund = await getFundById(
            fundId,
            userId,
            connection,
            true
        );

        if (!fund) {
            const error = new Error(
                "Fund not found"
            );
            error.code = "FUND_NOT_FOUND";
            throw error;
        }

        if (fund.status !== "active") {
            const error = new Error(
                "Fund is not active"
            );
            error.code = "FUND_NOT_ACTIVE";
            throw error;
        }

        if (
            Number(fund.remaining_amount) <
            Number(amount)
        ) {
            const error = new Error(
                "Insufficient fund balance"
            );
            error.code = "INSUFFICIENT_FUND_BALANCE";
            throw error;
        }

        const spentAmount =
            Number(fund.spent_amount) +
            Number(amount);

        const remainingAmount =
            Number(fund.remaining_amount) -
            Number(amount);

        const status =
            remainingAmount === 0
                ? "completed"
                : "active";

        await connection.execute(
            `
            UPDATE ad_fund_allocations
            SET
                spent_amount = ?,
                remaining_amount = ?,
                status = ?
            WHERE id = ?
            `,
            [
                spentAmount,
                remainingAmount,
                status,
                fundId
            ]
        );

        await connection.commit();

        return await getFundById(
            fundId,
            userId
        );
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const requestRefund = async (
    fundId,
    userId
) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const fund = await getFundById(
            fundId,
            userId,
            connection,
            true
        );

        if (!fund) {
            const error = new Error(
                "Fund not found"
            );
            error.code = "FUND_NOT_FOUND";
            throw error;
        }

        if (
            fund.status !== "active" &&
            fund.status !== "completed"
        ) {
            const error = new Error(
                "Fund cannot be moved to refund pending"
            );
            error.code = "INVALID_REFUND_STATUS";
            throw error;
        }

        const refundAmount =
            Number(fund.remaining_amount);

        await connection.execute(
            `
            UPDATE ad_fund_allocations
            SET
                status = 'refund_pending',
                refund_amount = ?
            WHERE id = ?
            `,
            [
                refundAmount,
                fundId
            ]
        );

        await connection.commit();

        return await getFundById(
            fundId,
            userId
        );
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const creditWalletForTopup = async (
    orderId,
    payment
) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const topup = await getTopupByOrderId(
            orderId,
            null,
            connection,
            true
        );

        if (!topup) {
            const error = new Error(
                "Top-up not found"
            );
            error.code = "TOPUP_NOT_FOUND";
            throw error;
        }

        if (
            Number(payment.payment_amount) !==
            Number(topup.amount)
        ) {
            const error = new Error(
                "Payment amount does not match top-up amount"
            );
            error.code = "PAYMENT_AMOUNT_MISMATCH";
            throw error;
        }

        if (topup.payment_status === "success") {
            await connection.commit();

            return await getWalletByUserId(
                topup.user_id
            );
        }

        const [walletRows] = await connection.execute(
            `
            SELECT
                id,
                balance
            FROM wallets
            WHERE id = ?
            FOR UPDATE
            `,
            [topup.wallet_id]
        );

        const wallet = walletRows[0];

        if (!wallet) {
            const error = new Error(
                "Wallet not found"
            );
            error.code = "WALLET_NOT_FOUND";
            throw error;
        }

        const balanceBefore =
            Number(wallet.balance);

        const amount =
            Number(topup.amount);

        const balanceAfter =
            balanceBefore + amount;

        await connection.execute(
            `
            UPDATE wallets
            SET balance = ?
            WHERE id = ?
            `,
            [
                balanceAfter,
                wallet.id
            ]
        );

        const paymentId =
            payment.cf_payment_id || null;

        const referenceId =
            payment.bank_reference ||
            payment.cf_reference_id ||
            null;

        const paymentMethod =
            payment.payment_group ||
            null;

        await connection.execute(
            `
            UPDATE wallet_topups
            SET
                payment_status = 'success',
                cf_payment_id = COALESCE(?, cf_payment_id),
                cf_reference_id = COALESCE(?, cf_reference_id),
                payment_method = COALESCE(?, payment_method),
                payment_reference = COALESCE(?, payment_reference),
                paid_at = NOW()
            WHERE id = ?
            `,
            [
                paymentId,
                referenceId,
                paymentMethod,
                referenceId,
                topup.id
            ]
        );

        await connection.execute(
            `
            INSERT INTO wallet_transactions (
                wallet_id,
                transaction_type,
                transaction_direction,
                amount,
                balance_before,
                balance_after,
                reference_id,
                reference_type,
                description
            )
            VALUES (
                ?,
                'top_up',
                'credit',
                ?,
                ?,
                ?,
                ?,
                'wallet_topup',
                ?
            )
            `,
            [
                wallet.id,
                amount,
                balanceBefore,
                balanceAfter,
                topup.id,
                `Wallet top-up via Cashfree order ${orderId}`
            ]
        );

        await connection.commit();

        return await getWalletByUserId(
            topup.user_id
        );
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
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
    getTopupsByUserId,
    getTopupCountByUserId,
    updateTopupStatus,
    getTransactionsByWalletId,
    getTransactionCountByWalletId,
    getTransactionById,
    allocateFund,
    getFundById,
    getFundsByUserId,
    getFundCountByUserId,
    spendFund,
    requestRefund,
    creditWalletForTopup
};