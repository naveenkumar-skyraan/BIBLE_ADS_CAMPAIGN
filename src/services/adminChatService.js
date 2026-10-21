import adminChatModel from "../models/adminChatModel.js";
import { emitToAdmins } from "../sockets/chatSocket.js";

const adminChatService = {
  async getAllConversations() {
    return await adminChatModel.getAllConversations();
  },

  async getConversationMessages(conversationId) {
    const conversation = await adminChatModel.findConversation(conversationId);

    if (!conversation) {
      const error = new Error("Conversation not found.");
      error.statusCode = 404;
      throw error;
    }

    const messages = await adminChatModel.getMessages(conversationId);

    return {
      conversation,
      messages,
    };
  },

  async sendReply(conversationId, adminId, message) {
    const conversation = await adminChatModel.findConversation(conversationId);

    if (!conversation) {
      const error = new Error("Conversation not found.");
      error.statusCode = 404;
      throw error;
    }

    if (["resolved", "closed"].includes(conversation.status)) {
      const error = new Error(
        "This conversation is resolved or closed. Reopen it before replying.",
      );
      error.statusCode = 409;
      throw error;
    }

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.trim().length > 5000
    ) {
      const error = new Error(
        "Message must contain between 1 and 5000 characters.",
      );
      error.statusCode = 400;
      throw error;
    }

    const trimmedMessage = message.trim();

    const messageId = await adminChatModel.createMessage(
      conversationId,
      adminId,
      trimmedMessage,
    );

    await adminChatModel.updateConversationStatus(
      conversationId,
      "in_progress",
    );

    const adminMessage = {
      id: messageId,
      conversation_id: Number(conversationId),
      sender_type: "admin",
      sender_id: adminId,
      message: trimmedMessage,
      created_at: new Date(),
    };

    emitToAdmins("chat:conversation-updated", {
      conversationId: Number(conversationId),
      message: adminMessage,
    });

    return adminMessage;
  },

  async updateStatus(conversationId, status) {
    const allowedStatuses = ["open", "in_progress", "resolved", "closed"];

    if (!allowedStatuses.includes(status)) {
      const error = new Error(
        "Invalid status. Allowed values: open, in_progress, resolved, closed.",
      );
      error.statusCode = 400;
      throw error;
    }

    const conversation = await adminChatModel.findConversation(conversationId);

    if (!conversation) {
      const error = new Error("Conversation not found.");
      error.statusCode = 404;
      throw error;
    }

    if (status === "resolved") {
      await adminChatModel.createSystemMessage(
        conversationId,
        "Your issue has been resolved. Thank you for contacting Bible Ads Campaign Support.",
      );
    }

    emitToAdmins("chat:conversation-status-updated", {
      conversationId: Number(conversationId),
      status,
    });

    return {
      conversationId: Number(conversationId),
      status,
    };
  },
};

export default adminChatService;
