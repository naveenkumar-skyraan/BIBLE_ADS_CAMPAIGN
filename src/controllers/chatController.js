import chatService from "../services/chatService.js";

const TEST_USER_ID = 1;

const chatController = {
  async getStatus(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        data: await chatService.getStatus(),
      });
    } catch (error) {
      next(error);
    }
  },

  async startConversation(req, res, next) {
    try {
      const data = await chatService.startConversation(TEST_USER_ID);

      res.status(200).json({
        success: true,
        message: "Conversation retrieved successfully.",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async getConversations(req, res, next) {
    try {
      const data = await chatService.getConversations(TEST_USER_ID);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async getMessages(req, res, next) {
    try {
      const data = await chatService.getMessages(
        req.params.conversationId,
        TEST_USER_ID,
      );

      res.status(200).json({
        success: true,
        data,
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
          message: "Message is required.",
        });
      }

      const data = await chatService.sendMessage(
        req.params.conversationId,
        TEST_USER_ID,
        message,
      );

      res.status(201).json({
        success: true,
        message: "Message submitted successfully.",
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  async endConversation(req, res, next) {
    try {
      const data = await chatService.endConversation(
        req.params.conversationId,
        TEST_USER_ID,
      );

      res.status(200).json({
        success: true,
        message: "Returned to the support welcome screen.",
        data,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default chatController;