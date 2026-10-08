import pool from "../configs/database/db.js";

const getAdminRefundRequests = async (offset, limit, status = "refund_pending", connection = pool) => {
    const conditions = [];
    const values = [];

    if (status) {
        conditions.push("afa.status = ?");
        values.push(status);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const [rows] = await connection.execute(
        `
        SELECT
            afa.id,
            afa.user_id,
            afa.business_id,
            afa.ad_id,
            afa.allocated_amount,
            afa.spent_amount,
            afa.remaining_amount,
            afa.status,
            afa.refund_amount,
            afa.created_at,
            afa.updated_at,
            u.name AS user_name,
            u.phone AS user_phone,
            bd.name AS business_name_owner,
            bd.business_name,
            bd.email AS business_email,
            a.status AS ad_status
        FROM ad_fund_allocations afa
        LEFT JOIN users u ON u.id = afa.user_id
        LEFT JOIN business_details bd ON bd.id = afa.business_id
        LEFT JOIN ads a ON a.id = afa.ad_id
        ${whereClause}
        ORDER BY afa.id DESC
        LIMIT ? OFFSET ?
        `,
        [...values, limit, offset]
    );

    return rows;
};

const getAdminRefundRequestCount = async (status = "refund_pending", connection = pool) => {
    const conditions = [];
    const values = [];

    if (status) {
        conditions.push("status = ?");
        values.push(status);
    }

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const [rows] = await connection.execute(
        `SELECT COUNT(*) AS total FROM ad_fund_allocations ${whereClause}`,
        values
    );

    return Number(rows[0]?.total || 0);
};

const getAdminRefundRequestById = async (fundId, connection = pool, forUpdate = false) => {
    const [rows] = await connection.execute(
        `
        SELECT
            afa.id,
            afa.user_id,
            afa.business_id,
            afa.ad_id,
            afa.allocated_amount,
            afa.spent_amount,
            afa.remaining_amount,
            afa.status,
            afa.refund_amount,
            afa.created_at,
            afa.updated_at,
            u.name AS user_name,
            u.phone AS user_phone,
            bd.name AS business_name_owner,
            bd.business_name,
            bd.email AS business_email,
            a.status AS ad_status
        FROM ad_fund_allocations afa
        LEFT JOIN users u ON u.id = afa.user_id
        LEFT JOIN business_details bd ON bd.id = afa.business_id
        LEFT JOIN ads a ON a.id = afa.ad_id
        WHERE afa.id = ?
        LIMIT 1
        ${forUpdate ? "FOR UPDATE" : ""}
        `,
        [fundId]
    );

    return rows[0] || null;
};

const approveAdminRefund = async (fundId, adminId = null) => {
    const connection = await pool.getConnection();
    let committed = false;

    try {
        await connection.beginTransaction();

        const fund = await getAdminRefundRequestById(fundId, connection, true);

        if (!fund) {
            const error = new Error("Fund not found");
            error.code = "FUND_NOT_FOUND";
            throw error;
        }

        if (fund.status === "refunded") {
            await connection.commit();
            committed = true;
            return {
                ...fund,
                wallet_balance: null,
                already_processed: true
            };
        }

        if (fund.status !== "refund_pending") {
            const error = new Error("Fund is not pending refund approval");
            error.code = "INVALID_REFUND_STATUS";
            throw error;
        }

        const refundAmount = Number(fund.refund_amount);

        if (refundAmount <= 0) {
            const error = new Error("No refundable balance available");
            error.code = "NO_REFUNDABLE_BALANCE";
            throw error;
        }

        const [walletRows] = await connection.execute(
            `
            SELECT id, user_id, balance
            FROM wallets
            WHERE user_id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [fund.user_id]
        );

        const wallet = walletRows[0];

        if (!wallet) {
            const error = new Error("Wallet not found");
            error.code = "WALLET_NOT_FOUND";
            throw error;
        }

        const balanceBefore = Number(wallet.balance);
        const balanceAfter = balanceBefore + refundAmount;

        await connection.execute(
            `UPDATE wallets SET balance = ? WHERE id = ?`,
            [balanceAfter, wallet.id]
        );

        await connection.execute(
            `
            UPDATE ad_fund_allocations
            SET status = 'refunded', refund_amount = ?
            WHERE id = ?
            `,
            [refundAmount, fundId]
        );

        await connection.execute(
            `
            INSERT INTO wallet_transactions (
                wallet_id, transaction_type, transaction_direction, amount,
                balance_before, balance_after, reference_id, reference_type, description
            )
            VALUES (?, 'fund_refund', 'credit', ?, ?, ?, ?, 'ad_fund', ?)
            `,
            [
                wallet.id,
                refundAmount,
                balanceBefore,
                balanceAfter,
                fundId,
                adminId
                    ? `Ad fund refund approved by admin ${adminId}`
                    : "Ad fund refund approved by admin"
            ]
        );

        await connection.commit();
        committed = true;

        const updatedFund = await getAdminRefundRequestById(fundId, connection);

        return {
            ...updatedFund,
            wallet_balance: balanceAfter,
            refunded_amount: refundAmount,
            already_processed: false
        };
    } catch (error) {
        if (!committed) {
            await connection.rollback();
        }
        throw error;
    } finally {
        connection.release();
    }
};

const rejectAdminRefund = async (fundId) => {
    const connection = await pool.getConnection();
    let committed = false;

    try {
        await connection.beginTransaction();

        const fund = await getAdminRefundRequestById(fundId, connection, true);

        if (!fund) {
            const error = new Error("Fund not found");
            error.code = "FUND_NOT_FOUND";
            throw error;
        }

        if (fund.status !== "refund_pending") {
            const error = new Error("Fund is not pending refund rejection");
            error.code = "INVALID_REFUND_STATUS";
            throw error;
        }

        await connection.execute(
            `
            UPDATE ad_fund_allocations
            SET status = 'active', refund_amount = 0.00
            WHERE id = ?
            `,
            [fundId]
        );

        await connection.commit();
        committed = true;

        return await getAdminRefundRequestById(fundId, connection);
    } catch (error) {
        if (!committed) {
            await connection.rollback();
        }
        throw error;
    } finally {
        connection.release();
    }
};

export {
    getAdminRefundRequests,
    getAdminRefundRequestCount,
    getAdminRefundRequestById,
    approveAdminRefund,
    rejectAdminRefund
};
