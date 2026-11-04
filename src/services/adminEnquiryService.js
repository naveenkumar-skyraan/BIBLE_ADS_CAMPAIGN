import {
    getEnquiryById,
    getAdminEnquiries,
    getAdminEnquiriesCount,
    updateEnquiryStatus
} from "../models/enquiryModel.js";

import { getListingData } from "../helpers/listingHelper.js";

export const getAllAdminEnquiries = async ({
    page = 1,
    limit = 10,
    search = "",
    status = null
} = {}) => {
    return await getListingData({
        page,
        limit,
        search,
        filters: { status },

        getData: ({ search, filters, limit, offset }) =>
            getAdminEnquiries({
                search,
                status: filters.status,
                limit,
                offset
            }),

        getCount: (search, filters) =>
            getAdminEnquiriesCount({
                search,
                status: filters.status
            })
    });
};

export const getAdminEnquiryById = async (id) => {
    const enquiry = await getEnquiryById(id);

    if (!enquiry) {
        const error = new Error("Enquiry not found.");
        error.statusCode = 404;
        throw error;
    }

    return enquiry;
};

export const changeEnquiryStatus = async (id, newStatus) => {
    const enquiry = await getEnquiryById(id);

    if (!enquiry) {
        const error = new Error("Enquiry not found.");
        error.statusCode = 404;
        throw error;
    }

    const allowedTransitions = {
        pending: ["contacted"],
        contacted: ["accept-closed", "decline-closed"],
        "accept-closed": [],
        "decline-closed": []
    };

    const allowedStatuses = allowedTransitions[enquiry.status];

    if (!allowedStatuses.includes(newStatus)) {
        const error = new Error(
            `Cannot change status from "${enquiry.status}" to "${newStatus}".`
        );

        error.statusCode = 400;
        throw error;
    }

    await updateEnquiryStatus(id, newStatus);

    return await getEnquiryById(id);
};