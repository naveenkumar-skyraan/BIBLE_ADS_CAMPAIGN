
import chatService from "../services/chatService.js";

const chatController = {
    async getStatus(req, res, next) {
        try {
            res.status(200).json({
                success: true,
                data: await chatService.getStatus()
            });
        } catch (error) {
            next(error);
        }
    },

    async startConversation(req, res, next) {
        try {
            const data = await chatService.startConversation(req.user.id);

            res.status(201).json({
                success: true,
                message: "Chat started successfully.",
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async getConversations(req, res, next) {
        try {
            const data = await chatService.getConversations(req.user.id);

            res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async getMessages(req, res, next) {
        try {
            const data = await chatService.getMessages(
                req.params.conversationId,
                req.user.id
            );

            res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async sendMessage(req, res, next) {
        try {
            const { message } = req.body;

            if (typeof message !== "string" || !message.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Message is required."
                });
            }

            const data = await chatService.sendMessage(
                req.params.conversationId,
                req.user.id,
                message
            );

            res.status(201).json({
                success: true,
                message: "Message submitted successfully.",
                data
            });
        } catch (error) {
            next(error);
        }
    }
};

export default chatController;
