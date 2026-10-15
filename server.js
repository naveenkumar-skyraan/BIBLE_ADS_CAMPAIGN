import express from "express";
import "dotenv/config";
import swaggerUi from "swagger-ui-express";

import adminRoutes from "./src/routes/adminAuthRoutes.js";
import adminEnquiryRoutes from "./src/routes/adminEnquiryRoutes.js";
import businessDetailRoutes from "./src/routes/businessDetailRoutes.js";

import adminAdObjectiveRoutes from "./src/routes/adminAdObjectiveRoutes.js";
import adminAdTypeRoutes from "./src/routes/adminAdTypeRoutes.js";
import adminAdActionButtonRoutes from "./src/routes/adminAdActionButtonRoutes.js";

import userRoutes from "./src/routes/userRoutes.js";
import socialAuthRoutes from "./src/routes/socialAuthRoutes.js";
import enquiryRoutes from "./src/routes/enquiryRoutes.js";
import adObjectiveRoutes from "./src/routes/adObjectiveRoutes.js";
import adTypeRoutes from "./src/routes/adTypeRoutes.js";
import adActionButtonRoutes from "./src/routes/adActionButtonRoutes.js";
import walletRoutes from "./src/routes/walletRoutes.js";
import profileRoutes from "./src/routes/profileRoutes.js";

import faqRoutes from "./src/routes/faqRoutes.js";
import adminFaqRoutes from "./src/routes/adminFaqRoutes.js";
import issueReportRoutes from "./src/routes/issueReportRoutes.js";
import adminIssueReportRoutes from "./src/routes/adminIssueReportRoutes.js";


import errorHandler from "./src/middleware/errorHandler.js";

import swaggerDocument from "./src/configs/swagger/swagger.js";
import { startAccountDeletionJob } from "./src/jobs/accountDeletionCron.js";

const app = express();

app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = Buffer.from(buffer);
    },
  }),
);

app.use(
  express.urlencoded({
    extended: true,
  }),
);

if (process.env.NODE_ENV !== "production") {
  app.use("/dev", express.static("dev"));
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Bible Ads Campaign API is running",
  });
});

app.use("/api/admin", adminRoutes);

app.use("/api/admin/ad-objectives", adminAdObjectiveRoutes);
app.use("/api/admin/ad-types", adminAdTypeRoutes);
app.use("/api/admin/ad-action-buttons", adminAdActionButtonRoutes);

app.use("/api/ad-objectives", adObjectiveRoutes);
app.use("/api/ad-types", adTypeRoutes);
app.use("/api/ad-action-buttons", adActionButtonRoutes);

app.use("/api/auth", userRoutes);
app.use("/api/auth", socialAuthRoutes);

app.use("/api/enquiries", enquiryRoutes);
app.use("/api/admin/enquiries", adminEnquiryRoutes);
app.use("/api/business-details", businessDetailRoutes);

app.use("/api/wallet", walletRoutes);
app.use("/api/settings", profileRoutes);

app.use("/api/faqs", faqRoutes);
app.use("/api/admin/faqs", adminFaqRoutes);
app.use("/api/issue-reports", issueReportRoutes);
app.use("/api/admin/issue-reports", adminIssueReportRoutes);

app.use(errorHandler);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

startAccountDeletionJob();

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
