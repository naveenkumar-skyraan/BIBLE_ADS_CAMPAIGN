import express from "express";

import {
    loginAdminController
} from "../controllers/adminAuthController.js";

const router = express.Router();

router.post("/login", loginAdminController);

export default router;