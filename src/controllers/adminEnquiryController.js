import {
    getAllAdminEnquiries,
    getAdminEnquiryById,
    changeEnquiryStatus
} from "../services/adminEnquiryService.js";

export const getAllAdminEnquiriesController = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            status = null
        } = req.body || {};

        const normalizedPage = Math.max(1, Number(page) || 1);
        const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 10));

        const result = await getAllAdminEnquiries({
            page: normalizedPage,
            limit: normalizedLimit,
            search,
            status
        });

        return res.status(200).json({
            success: true,
            message: "Enquiries fetched successfully",
            data: result.data,
            pagination: result.pagination
        });

    } catch (error) {
        console.error("GET ALL ADMIN ENQUIRIES ERROR:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    }
};

export const getAdminEnquiryByIdController = async (req, res) => {
    try {
        const { id } = req.params;

        const enquiry = await getAdminEnquiryById(id);

        return res.status(200).json({
            success: true,
            message: "Enquiry fetched successfully",
            data: enquiry
        });

    } catch (error) {
        console.error("GET ADMIN ENQUIRY ERROR:", error);

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export const updateAdminEnquiryStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const enquiry = await changeEnquiryStatus(id, status);

        return res.status(200).json({
            success: true,
            message: "Enquiry status updated successfully",
            data: enquiry
        });

    } catch (error) {
        console.error("UPDATE ADMIN ENQUIRY STATUS ERROR:", error);

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};