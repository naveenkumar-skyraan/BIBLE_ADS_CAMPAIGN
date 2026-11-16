
import { moderateAd } from "../services/adminAdModerationService.js";

const executeModeration = (action, message) => {
  return async (req, res, next) => {
    try {
      const data = await moderateAd(
        action,
        req.params.id,
        req.admin.id,
        req.body?.reason,
      );

      return res.status(200).json({
        success: true,
        message,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
};

export const blockAdController = executeModeration(
  "block",
  "Advertisement blocked successfully.",
);

export const approveAdController = executeModeration(
  "approve",
  "Advertisement approved successfully.",
);

export const rejectAdController = executeModeration(
  "reject",
  "Advertisement rejected and returned to blocked status.",
);
