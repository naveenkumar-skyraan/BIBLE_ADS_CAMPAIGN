import {
  getAllAdminBusinesses,
  getAdminBusinessById,
  changeBusinessVerificationStatus,
  updateAdminBusinessDetails,
} from "../services/adminBusinessDetailService.js";

export const getAllAdminBusinessesController = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      verification_status = null,
    } = req.body;

    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 10));

    const result = await getAllAdminBusinesses({
      page: normalizedPage,
      limit: normalizedLimit,
      search,
      verification_status,
    });

    return res.status(200).json({
      success: true,
      message: "Business details fetched successfully.",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch business details.",
    });
  }
};

export const getAdminBusinessByIdController = async (req, res) => {
  try {
    const business = await getAdminBusinessById(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Business details fetched successfully.",
      data: business,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch business details.",
    });
  }
};

export const changeBusinessVerificationStatusController = async (req, res) => {
  try {
    const { verification_status } = req.body;

    const business = await changeBusinessVerificationStatus(
      req.params.id,
      verification_status,
      req.admin.id,
    );

    return res.status(200).json({
      success: true,
      message: "Business verification status updated successfully.",
      data: business,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to update business verification status.",
    });
  }
};

export const updateAdminBusinessDetailsController = async (req, res) => {
  try {
    const business = await updateAdminBusinessDetails(req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Business details updated successfully.",
      data: business,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update business details.",
    });
  }
};
