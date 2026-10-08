import {
    getAdminRefundRequests,
    getAdminRefundRequestCount,
    getAdminRefundRequestById,
    approveAdminRefund,
    rejectAdminRefund
} from "../models/adminWalletModel.js";

const getRefundRequests = async (page = 1, limit = 20, status = "refund_pending") => {
    const offset = (page - 1) * limit;
    const refunds = await getAdminRefundRequests(offset, limit, status);
    const total = await getAdminRefundRequestCount(status);

    return {
        refunds,
        pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit)
        }
    };
};

const getRefundRequest = async (fundId) => {
    return await getAdminRefundRequestById(fundId);
};

const approveRefund = async (fundId, adminId = null) => {
    return await approveAdminRefund(fundId, adminId);
};

const rejectRefund = async (fundId) => {
    return await rejectAdminRefund(fundId);
};

export {
    getRefundRequests,
    getRefundRequest,
    approveRefund,
    rejectRefund
};
