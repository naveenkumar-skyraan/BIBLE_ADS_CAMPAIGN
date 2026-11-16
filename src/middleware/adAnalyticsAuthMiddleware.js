import crypto from "node:crypto";

const unauthorized = (res) =>
  res.status(401).json({
    success: false,
    message: "Invalid analytics integration credentials.",
  });

export const adAnalyticsAuthMiddleware = (req, res, next) => {
  const platform = String(req.body?.platform || "").toLowerCase();

  if (!["android", "ios"].includes(platform)) {
    return res.status(400).json({
      success: false,
      message: "A valid analytics platform is required.",
    });
  }

  const expectedKey =
    platform === "android"
      ? process.env.AD_ANALYTICS_ANDROID_KEY
      : process.env.AD_ANALYTICS_IOS_KEY;

  const suppliedKey = req.get("x-ad-analytics-key");

  if (!expectedKey) {
    return res.status(503).json({
      success: false,
      message: `Analytics integration is not configured for ${platform}.`,
    });
  }

  if (!suppliedKey) {
    return unauthorized(res);
  }

  const expectedBuffer = Buffer.from(expectedKey, "utf8");
  const suppliedBuffer = Buffer.from(suppliedKey, "utf8");

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return unauthorized(res);
  }

  return next();
};