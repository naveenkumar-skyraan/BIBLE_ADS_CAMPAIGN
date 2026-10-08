import express from "express";

import {
    socialLoginController
} from "../controllers/socialAuthController.js";

const router = express.Router();

router.post(
    "/social-login",
    socialLoginController
);

export default router;