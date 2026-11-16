import dashboardModel from "../models/dashboardModel.js";

export const getDashboardOverviewController = async (req, res, next) => {
  try {
    const filters = req.body || {};

    const data = await dashboardModel.getDashboardOverview({
      userId: req.user.id,
      businessId: filters.business_id,
      overviewPeriod: filters.overview_period,
      spendPeriod: filters.spend_period,
      timezone: filters.timezone,
      topLimit: filters.top_limit,
    });

    return res.status(200).json({
      success: true,
      message: "Dashboard overview retrieved successfully.",
      data,
    });
  } catch (error) {
    next(error);
  }
};
