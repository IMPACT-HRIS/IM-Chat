"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/lib/socket"; // We need to create this hook
import { Message, User } from "@prisma/client"; // Or separate type if client-side only
import { Send, User as UserIcon, Bot as BotIcon, Phone } from "lucide-react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";

type MessageWithSender = Message & { sender?: User };

interface ChatInterfaceProps {
  user: User;
  overrideRoomId?: string;
  chatName?: string;
  chatAvatarUrl?: string | null;
}

export default function ChatInterface({
  user,
  overrideRoomId,
  chatName,
  chatAvatarUrl,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [input, setInput] = useState("");
  const socket = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // If overrideRoomId is provided (Admin viewing a user), use it.
  // Otherwise, use the current user's ID (Standard user chat).
  const roomId = overrideRoomId || user.id;

  // Check if we are in "Support Mode" (Active Admin viewing another user)
  const isSupportMode = roomId !== user.id;

  const [showAdminList, setShowAdminList] = useState(false);
  const [adminList, setAdminList] = useState<User[]>([]);

  useEffect(() => {
    if (!socket || !showAdminList) return;

    socket.emit("get_admins");
    socket.on("admin_list", (admins: User[]) => {
      // Filter out self
      setAdminList(admins.filter((a) => a.id !== user.id));
    });

    return () => {
      socket.off("admin_list");
    };
  }, [socket, showAdminList, user.id]);

  useEffect(() => {
    if (!socket) return;

    socket.emit("join_room", roomId); // User joins their own room

    socket.on("receive_message", (message: MessageWithSender) => {
      setMessages((prev) => {
        // Remove optimistic message that matches this real message
        // Match by content and senderId (and check if it was optimistic)
        const optimisticMatchIndex = prev.findIndex(
          (m: any) =>
            m.isOptimistic &&
            m.content === message.content &&
            m.senderId === message.senderId,
        );

        if (optimisticMatchIndex !== -1) {
          const newMessages = [...prev];
          newMessages[optimisticMatchIndex] = message; // Replace inplace or remove? Replacing keeps order better.
          return newMessages;
        }

        return [...prev, message];
      });
    });

    socket.on("chat_history", (history: MessageWithSender[]) => {
      setMessages(history);
    });

    return () => {
      socket.off("receive_message");
    };
  }, [socket, roomId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !socket) return;

    // Optimistic update
    const tempMsg: any = {
      id: Date.now().toString(),
      content: input,
      senderId: isSupportMode ? null : user.id,
      createdAt: new Date(),
      isBot: isSupportMode,
      isOptimistic: true,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setInput("");

    const messagePayload = {
      roomId: roomId,
      content: input,
      senderId: user.id, // Keep sending real ID to server, server handles masking
      isBot: false,
    };

    socket.emit("send_message", messagePayload);

    // Server socket handler is better for consistency.
  };

  const toggleAdminList = () => {
    setShowAdminList(!showAdminList);
  };

  const handleCallAdmin = (adminId: string) => {
    console.log("Calling admin:", adminId);
    // Future: socket.emit("summon_admin", adminId);
    setShowAdminList(false);
    alert(`Calling Admin... (Feature pending notification integration)`);
  };

  const isAdmin = user.role === "ADMIN"; // Check user role

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-2xl overflow-hidden shadow-xl border border-slate-200 relative">
      {/* Header */}
      <header className="bg-white p-4 flex items-center justify-between border-b border-slate-100 z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-lg overflow-hidden">
            {chatAvatarUrl ? (
              <img
                src={chatAvatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <BotIcon size={20} />
            )}
          </div>
          <div>
            <h1 className="font-bold text-slate-800">
              {chatName || "Khun Preaw"}
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 block animate-pulse"></span>
              <p className="text-xs text-slate-500 font-medium">Online</p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="relative">
            <button
              onClick={toggleAdminList}
              className="bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Phone size={14} />
              Call Admin
            </button>

            {showAdminList && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 p-1 z-30">
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 border-b border-slate-50 mb-1">
                  Select Admin
                </div>
                {adminList.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-slate-400 text-center">
                    No other admins online
                  </div>
                ) : (
                  adminList.map((admin) => (
                    <button
                      key={admin.id}
                      onClick={() => handleCallAdmin(admin.id)}
                      className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2"
                    >
                      <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold">
                        {admin.username?.[0]?.toUpperCase()}
                      </div>
                      {admin.firstName || admin.username}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            // "Session Owner" (The User) => Blue/Right
            // "Khun Preaw/Admin" => Gray/Left
            const isSessionOwner = msg.senderId === roomId;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={clsx(
                  "flex flex-col max-w-[80%]",
                  isSessionOwner ? "ml-auto items-end" : "mr-auto items-start",
                )}
              >
                <div
                  className={clsx(
                    "p-3 rounded-2xl text-sm shadow-sm",
                    isSessionOwner
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white text-slate-700 rounded-bl-none",
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/20 active:scale-95"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
