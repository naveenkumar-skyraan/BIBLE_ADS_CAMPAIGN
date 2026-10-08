import express from "express";
import "dotenv/config";
import swaggerUi from "swagger-ui-express";

import adminRoutes from "./src/routes/adminAuthRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import socialAuthRoutes from "./src/routes/socialAuthRoutes.js";
import enquiryRoutes from "./src/routes/enquiryRoutes.js";
import adminEnquiryRoutes from "./src/routes/adminEnquiryRoutes.js";

import adminAdObjectiveRoutes from "./src/routes/adminAdObjectiveRoutes.js";
import adminAdTypeRoutes from "./src/routes/adminAdTypeRoutes.js";

import adObjectiveRoutes from "./src/routes/adObjectiveRoutes.js";
import adTypeRoutes from "./src/routes/adTypeRoutes.js";

import walletRoutes from "./src/routes/walletRoutes.js";

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

app.use("/api/ad-objectives", adObjectiveRoutes);

app.use("/api/ad-types", adTypeRoutes);

app.use("/api/auth", userRoutes);

app.use("/api/auth", socialAuthRoutes);

app.use("/api/enquiries", enquiryRoutes);

app.use("/api/admin/enquiries", adminEnquiryRoutes);

app.use("/api/wallet", walletRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

startAccountDeletionJob();

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
