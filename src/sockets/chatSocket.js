
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let adminNamespace;

const adminSockets = new Map();

export const initializeChatSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CHAT_WEBVIEW_ORIGIN
                ? process.env.CHAT_WEBVIEW_ORIGIN.split(",").map(
                    (origin) => origin.trim()
                )
                : "*",
            methods: ["GET", "POST"],
        },
    });

    adminNamespace = io.of("/admin-chat");

    adminNamespace.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error("Authorization token is required."));
            }

            const decoded = jwt.verify(
                token,
                process.env.JWT_ACCESS_SECRET
            );

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

    adminNamespace.on("connection", (socket) => {
        const adminId = socket.data.adminId;

        if (!adminSockets.has(adminId)) {
            adminSockets.set(adminId, new Set());
        }

        adminSockets.get(adminId).add(socket.id);

        console.log(`Chat admin connected: ${adminId}`);

        adminNamespace.emit("chat:admin-status", {
            online: true,
        });

        socket.on("disconnect", () => {
            const sockets = adminSockets.get(adminId);

            if (sockets) {
                sockets.delete(socket.id);

                if (sockets.size === 0) {
                    adminSockets.delete(adminId);
                }
            }

            console.log(`Chat admin disconnected: ${adminId}`);

            adminNamespace.emit("chat:admin-status", {
                online: isAdminOnline(),
            });
        });
    });

    return io;
};

export const isAdminOnline = () => {
    return adminSockets.size > 0;
};

export const emitToAdmins = (event, data) => {
    if (adminNamespace) {
        adminNamespace.emit(event, data);
    }
};
