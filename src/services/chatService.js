import chatModel from "../models/chatModel.js";
import { isAdminOnline, emitToAdmins } from "../sockets/chatSocket.js";

const OFFLINE_MESSAGE =
  "Thank you for contacting us. Your message has been received. Our team will get back to you soon when online.";

const chatService = {
  async getStatus() {
    return {
      adminOnline: isAdminOnline(),
    };
  },

  async startConversation(userId) {
    let conversation = await chatModel.getLatestConversation(userId);
    let conversationId;

    if (conversation) {
      conversationId = conversation.id;
    } else {
      conversationId = await chatModel.createConversation(userId);
      conversation = await chatModel.findConversationById(conversationId);
    }

    return {
      conversationId,
      conversation,
      adminOnline: isAdminOnline(),
      messages: await chatModel.getMessages(conversationId),
    };
  },

  async getConversations(userId) {
    return chatModel.getUserConversations(userId);
  },

  async getMessages(conversationId, userId) {
    const conversation = await chatModel.findConversation(
      conversationId,
      userId,
    );

    if (!conversation) {
      const error = new Error("Conversation not found.");
      error.statusCode = 404;
      throw error;
    }

    return {
      conversation,
      messages: await chatModel.getMessages(conversationId),
    };
  },

  async sendMessage(conversationId, userId, message) {
    const conversation = await chatModel.findConversation(
      conversationId,
      userId,
    );

    if (!conversation) {
      const error = new Error("Conversation not found.");
      error.statusCode = 404;
      throw error;
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage || trimmedMessage.length > 5000) {
      const error = new Error(
        "Message must contain between 1 and 5000 characters.",
      );
      error.statusCode = 400;
      throw error;
    }

    const messageId = await chatModel.createMessage(
      conversationId,
      "user",
      userId,
      trimmedMessage,
    );

    await chatModel.updateConversationStatus(conversationId, "in_progress");

    const userMessage = {
      id: messageId,
      conversation_id: Number(conversationId),
      sender_type: "user",
      sender_id: userId,
      message: trimmedMessage,
      created_at: new Date(),
    };

    const adminOnline = isAdminOnline();
    let acknowledgement = null;

    if (adminOnline) {
      emitToAdmins("chat:new-message", {
        conversationId: Number(conversationId),
        message: userMessage,
      });
    } else {
      const acknowledgementExists = await chatModel.hasMessage(
        conversationId,
        "system",
        OFFLINE_MESSAGE,
      );

      if (!acknowledgementExists) {
        const acknowledgementId = await chatModel.createMessage(
          conversationId,
          "system",
          null,
          OFFLINE_MESSAGE,
        );

        acknowledgement = {
          id: acknowledgementId,
          conversation_id: Number(conversationId),
          sender_type: "system",
          sender_id: null,
          message: OFFLINE_MESSAGE,
          created_at: new Date(),
        };
      }

      emitToAdmins("chat:offline-message-received", {
        conversationId: Number(conversationId),
      });
    }

    return {
      adminOnline,
      message: userMessage,
      acknowledgement,
    };
  },

  async endConversation(conversationId, userId) {
    const conversation = await chatModel.findConversation(
      conversationId,
      userId,
    );

    if (!conversation) {
      const error = new Error("Conversation not found.");
      error.statusCode = 404;
      throw error;
    }

    return {
      conversationId: Number(conversationId),
      status: conversation.status,
    };
  },
};

export default chatService;