
import express from "express";
import chatController from "../controllers/chatController.js";
import { middleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(middleware);

router.get("/status", chatController.getStatus);
router.post("/conversations", chatController.startConversation);
router.get("/conversations", chatController.getConversations);
router.get(
    "/conversations/:conversationId/messages",
    chatController.getMessages
);
router.post(
    "/conversations/:conversationId/messages",
    chatController.sendMessage
);

export default router;
