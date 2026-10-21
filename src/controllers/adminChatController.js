import adminChatService from "../services/adminChatService.js";

const adminChatController = {
    async getAllConversations(req, res, next) {
        try {
            const data =
                await adminChatService.getAllConversations();

            res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async getConversationMessages(req, res, next) {
        try {
            const data =
                await adminChatService.getConversationMessages(
                    req.params.conversationId
                );

            res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async sendReply(req, res, next) {
        try {
            const { message } = req.body;

            if (typeof message !== "string" || !message.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Message is required."
                });
            }

            const data = await adminChatService.sendReply(
                req.params.conversationId,
                req.admin.id,
                message
            );

            res.status(201).json({
                success: true,
                message: "Reply sent successfully.",
                data
            });
        } catch (error) {
            next(error);
        }
    },

    async updateStatus(req, res, next) {
        try {
            const { status } = req.body;

            const data = await adminChatService.updateStatus(
                req.params.conversationId,
                status
            );

            res.status(200).json({
                success: true,
                message: "Conversation status updated successfully.",
                data
            });
        } catch (error) {
            next(error);
        }
    }
};

export default adminChatController;