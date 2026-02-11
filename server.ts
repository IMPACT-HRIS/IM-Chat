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

    socket.on("join_room", async (userData: any) => {
      let ssoId: string;
      let userInfo: any = {};

      if (typeof userData === "string") {
        ssoId = userData;
        userInfo = { username: ssoId };
      } else {
        ssoId = userData.id;
        userInfo = userData;
      }

      socket.join(ssoId);
      console.log(`User ${socket.id} joined room ${ssoId}`);

      let dbUser;
      try {
        dbUser = await prisma.user.upsert({
          where: { ssoId: ssoId },
          update: {
            username: userInfo.username || ssoId,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
          },
          create: {
            id: ssoId,
            ssoId: ssoId,
            username: userInfo.username || ssoId,
            firstName: userInfo.firstName,
            lastName: userInfo.lastName,
            role: "USER",
          },
        });
      } catch (e) {
        console.error("Error creating user:", e);
        dbUser = await prisma.user.findUnique({ where: { ssoId: ssoId } });
      }

      if (!dbUser) {
        console.error("User validation failed for session creation");
        return;
      }

      let session = await prisma.chatSession.findFirst({
        where: { userId: dbUser.id, status: { not: "closed" } },
      });

      if (!session) {
        try {
          session = await prisma.chatSession.create({
            data: {
              userId: dbUser.id,
              status: "active",
            },
          });
        } catch (e) {
          console.error("Error creating session:", e);
          return;
        }
      }

      const messages = await prisma.message.findMany({
        where: { chatSessionId: session.id },
        orderBy: { createdAt: "asc" },
        take: 50,
        include: { sender: true },
      });

      socket.emit("chat_history", messages);
    });

    socket.on("send_message", async (data) => {
      // data: { roomId (ssoId), content, senderId, isBot }
      const { roomId, content, senderId } = data;

      // roomId from client is the SSO ID. Resolve to DB User.
      const dbUser = await prisma.user.findUnique({ where: { ssoId: roomId } });

      if (!dbUser) {
        console.error(`User with SSO ID ${roomId} not found for send_message`);
        return;
      }

      // Find active session using DB ID
      const session = await prisma.chatSession.findFirst({
        where: { userId: dbUser.id, status: { not: "closed" } },
      });

      if (!session) {
        console.error(
          `Active session not found for user ${dbUser.id} (SSO: ${roomId})`,
        );
        return;
      }

      // Determine if this is a "Support Reply" (Admin answering User)
      // senderId from client:
      // - If user sending: senderId should be their SSO ID (roomId)
      // - If admin sending: senderId will be admin's ID (or similar)
      const isSupportReply = roomId !== senderId;

      const dbSenderId = isSupportReply ? null : dbUser.id; // Link to User record if user
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
          senderId: dbSenderId, // Use DB UUID
          content: content,
          isBot: dbIsBot,
        },
        include: { sender: true },
      });

      // Broadcast to room (roomId is SSO ID, used for socket room)
      io.to(roomId).emit("receive_message", message);

      // Notify Admin Feed about the update
      io.to("admin_feed").emit("chat_session_updated", {
        userId: updatedSession.userId,
        user: updatedSession.user,
        message: content,
        timestamp: message.createdAt,
        unread: false,
      });

      // Bot Logic (Khun Preaw)
      // Check if status is active (Auto-reply mode)
      if (session.status === "active" && !isSupportReply) {
        setTimeout(async () => {
          const botMsg = "Hello! I am Khun Preaw. How can I help you today?";

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
      await prisma.chatSession.updateMany({
        where: { userId: userId, status: { not: "closed" } },
        data: { status: "waiting_for_admin" },
      });
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
