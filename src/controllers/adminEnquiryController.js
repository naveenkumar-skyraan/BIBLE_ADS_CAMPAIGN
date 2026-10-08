import {
    getAllAdminEnquiries,
    getAdminEnquiryById,
    changeEnquiryStatus
} from "../services/adminEnquiryService.js";

export const getAllAdminEnquiriesController = async (req, res) => {
    try {
        const enquiries = await getAllAdminEnquiries();

        return res.status(200).json({
            success: true,
            message: "Enquiries fetched successfully",
            data: enquiries
        });

    } catch (error) {
        console.error("GET ALL ADMIN ENQUIRIES ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
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

        const enquiry = await changeEnquiryStatus(
            id,
            status
        );

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