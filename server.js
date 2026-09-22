import express from "express";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";

import userRoutes from "./src/routes/userRoutes.js";
import swaggerDocument from "./src/configs/swagger/swagger.js";
import { startAccountDeletionJob } from "./src/jobs/accountDeletionCron.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Bible Ads Campaign API is running"
    });
});

app.use("/api/auth", userRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

startAccountDeletionJob();

const PORT = process.env.PORT;

app.listen(PORT, () => {console.log(`Server running on port ${PORT}`);});