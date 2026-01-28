import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.APP_PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Join room based on user ID (which defaults to chat session scope for now)
    socket.on("join_room", async (userId) => {
      socket.join(userId);
      console.log(`User ${socket.id} joined room ${userId}`);

      // Check for active session, create if none
      let session = await prisma.chatSession.findFirst({
        where: { userId: userId, status: { not: "closed" } },
      });

      if (!session) {
        session = await prisma.chatSession.create({
          data: {
            userId: userId,
            status: "active",
          },
        });
      }

      // Send history
      const messages = await prisma.message.findMany({
        where: { chatSessionId: session.id },
        orderBy: { createdAt: "asc" },
        take: 50,
        include: { sender: true },
      });

      socket.emit("chat_history", messages);
    });

    socket.on("send_message", async (data) => {
      // data: { roomId (userId), content, senderId, isBot }
      const { roomId, content, senderId } = data;

      // Find active session
      const session = await prisma.chatSession.findFirst({
        where: { userId: roomId, status: { not: "closed" } },
      });

      if (!session) return; // Should not happen

      // Determine if this is a "Support Reply" (Admin answering User)
      // If roomId (Session User ID) != senderId, then it is an Admin.
      // We want Admins to appear as "Khun Priao" (Bot).
      const isSupportReply = roomId !== senderId;

      const dbSenderId = isSupportReply ? null : senderId;
      const dbIsBot = isSupportReply ? true : false; // Treat as bot if it's admin

      // Update session timestamp
      const updatedSession = await prisma.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
        include: { user: true },
      });

      const message = await prisma.message.create({
        data: {
          chatSessionId: session.id,
          senderId: dbSenderId,
          content: content,
          isBot: dbIsBot,
        },
        include: { sender: true },
      });

      // Broadcast to room
      io.to(roomId).emit("receive_message", message);

      // Notify Admin Feed about the update
      io.to("admin_feed").emit("chat_session_updated", {
        userId: updatedSession.userId,
        user: updatedSession.user,
        message: content,
        timestamp: message.createdAt,
        unread: false, // Or true if not admin reply? Let's keep simpler logic for now.
      });

      // Bot Logic (Khun Preaw)
      // Check if status is active (Auto-reply mode)
      if (session.status === "active") {
        // Simple delay reply
        setTimeout(async () => {
          const botMsg = "Hello! I am Khun Preaw. How can I help you today?";
          // In real app, call LLM or logic here.

          const savedBotMsg = await prisma.message.create({
            data: {
              chatSessionId: session.id,
              senderId: null,
              content: botMsg,
              isBot: true,
            },
          });
          io.to(roomId).emit("receive_message", savedBotMsg);
        }, 1000);
      }
    });

    socket.on("call_admin", async (userId) => {
      // Update status
      await prisma.chatSession.updateMany({
        where: { userId: userId, status: { not: "closed" } },
        data: { status: "waiting_for_admin" },
      });

      // Notify admin room
      io.to("admin_feed").emit("admin_alert", {
        userId,
        message: "User requested help!",
      });
    });

    socket.on("get_admins", async () => {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true, username: true, firstName: true, lastName: true },
      });
      socket.emit("admin_list", admins);
    });

    socket.on("join_admin_feed", async () => {
      socket.join("admin_feed");

      // Emit all active rooms
      const allSessions = await prisma.chatSession.findMany({
        where: { status: { not: "closed" } },
        include: {
          user: true,
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
      });

      socket.emit("all_chat_rooms", allSessions);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(
      `> Ready on http://${hostname}:${port} as ${
        dev ? "development" : "production"
      }`,
    );
  });
});
