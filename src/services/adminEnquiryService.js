import {
    getAllEnquiries,
    getEnquiryById,
    updateEnquiryStatus
} from "../models/enquiryModel.js";

export const getAllAdminEnquiries = async () => {
    return await getAllEnquiries();
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