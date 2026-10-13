import express from "express";
import * as service from "../services/adActionButtonService.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const data = await service.listActionButtons(false);

        return res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error("PUBLIC AD ACTION BUTTONS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
});

export default router;