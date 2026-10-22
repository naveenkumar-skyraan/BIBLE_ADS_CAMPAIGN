import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let adminNamespace;
let userNamespace;

const adminSockets = new Map();

export const initializeChatSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  adminNamespace = io.of("/admin-chat");
  userNamespace = io.of("/user-chat");

  adminNamespace.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authorization token is required."));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      if (
        decoded.type !== "access" ||
        decoded.role !== "admin" ||
        !decoded.sub
      ) {
        return next(new Error("Admin access is required."));
      }

      socket.data.adminId = String(decoded.sub);

      next();
    } catch {
      next(new Error("Invalid or expired admin access token."));
    }
  });

  // userNamespace.use((socket, next) => {
  //     try {
  //         const token = socket.handshake.auth?.token;

  //         if (!token) {
  //             return next(
  //                 new Error("Authorization token is required.")
  //             );
  //         }

  //         const decoded = jwt.verify(
  //             token,
  //             process.env.JWT_ACCESS_SECRET
  //         );

  //         if (
  //             decoded.type !== "access" ||
  //             !decoded.sub ||
  //             decoded.role === "admin"
  //         ) {
  //             return next(new Error("User access is required."));
  //         }

  //         socket.data.userId = String(decoded.sub);

  //         next();
  //     } catch {
  //         next(
  //             new Error("Invalid or expired access token.")
  //         );
  //     }
  // });

  userNamespace.use((socket, next) => {
    next();
  });
  adminNamespace.on("connection", (socket) => {
    const adminId = socket.data.adminId;
    const wasOnline = isAdminOnline();

    if (!adminSockets.has(adminId)) {
      adminSockets.set(adminId, new Set());
    }

    adminSockets.get(adminId).add(socket.id);

    console.log(`Chat admin connected: ${adminId}`);

    if (!wasOnline) {
      broadcastAdminStatus(true);
    }

    socket.on("disconnect", () => {
      const sockets = adminSockets.get(adminId);

      if (sockets) {
        sockets.delete(socket.id);

        if (sockets.size === 0) {
          adminSockets.delete(adminId);
        }
      }

      console.log(`Chat admin disconnected: ${adminId}`);

      if (!isAdminOnline()) {
        broadcastAdminStatus(false);
      }
    });
  });

  userNamespace.on("connection", (socket) => {
    console.log(`Chat user connected: ${socket.data.userId}`);

    socket.emit("chat:admin-status", {
      online: isAdminOnline(),
    });

    socket.on("disconnect", () => {
      console.log(`Chat user disconnected: ${socket.data.userId}`);
    });
  });

  return io;
};

export const isAdminOnline = () => {
  return adminSockets.size > 0;
};

const broadcastAdminStatus = (online) => {
  const status = { online };

  if (adminNamespace) {
    adminNamespace.emit("chat:admin-status", status);
  }

  if (userNamespace) {
    userNamespace.emit("chat:admin-status", status);
  }
};

export const emitToAdmins = (event, data) => {
  if (adminNamespace) {
    adminNamespace.emit(event, data);
  }
};
