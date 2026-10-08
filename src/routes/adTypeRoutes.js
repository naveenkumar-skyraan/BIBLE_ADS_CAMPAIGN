import express from "express";
import * as service from "../services/adTypeService.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const data = await service.listTypes(false);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("PUBLIC AD TYPES ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});

export default router;