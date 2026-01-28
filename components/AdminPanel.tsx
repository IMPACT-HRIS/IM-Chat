"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/lib/socket";
import clsx from "clsx";
import { User, MessageCircle } from "lucide-react";

export default function AdminPanel({
  onSelectUser,
  onMyChat,
}: {
  onSelectUser: (user: any) => void;
  onMyChat: () => void;
}) {
  const [activeChats, setActiveChats] = useState<any[]>([]);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.emit("join_admin_feed");

    socket.on("all_chat_rooms", (rooms) => {
      // rooms is array of ChatSession with user and messages
      // Map to display format
      const formatted = rooms.map((room: any) => ({
        userId: room.userId,
        user: room.user,
        message: room.messages?.[0]?.content || "No messages",
        timestamp: room.messages?.[0]?.createdAt || room.updatedAt,
        unread: room.status === "waiting_for_admin",
      }));
      setActiveChats(formatted);
    });

    socket.on("chat_session_updated", (data) => {
      console.log("Chat updated:", data);
      setActiveChats((prev) => {
        const filtered = prev.filter((a) => a.userId !== data.userId);
        return [
          {
            userId: data.userId,
            user: data.user,
            message: data.message,
            timestamp: new Date(data.timestamp),
            unread: false, // Or logic for unread
          },
          ...filtered,
        ];
      });
    });

    socket.on("admin_alert", (data) => {
      setActiveChats((prev) => {
        // Remove existing to bump
        const filtered = prev.filter((a) => a.userId !== data.userId);
        // We might not have user info for new alert if not in initial list,
        // but often it will be. For now, use data.userId as fallback name.
        const existing = prev.find((a) => a.userId === data.userId);

        return [
          {
            userId: data.userId,
            user: existing?.user,
            message: data.message,
            timestamp: new Date(),
            unread: true,
          },
          ...filtered,
        ];
      });
    });

    return () => {
      socket.off("all_chat_rooms");
      socket.off("chat_session_updated");
      socket.off("admin_alert");
    };
  }, [socket]);

  return (
    <div className="w-80 bg-white border-l border-slate-200 p-4 flex flex-col h-full shadow-lg">
      <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
        Active Chats
      </h2>

      <div className="flex-1 overflow-y-auto space-y-3">
        {activeChats.length === 0 ? (
          <p className="text-slate-400 text-sm text-center mt-10">
            No active chats
          </p>
        ) : (
          activeChats.map((chat) => (
            <div
              key={chat.userId}
              onClick={() =>
                onSelectUser({
                  id: chat.userId,
                  ...chat.user,
                  name:
                    chat.user?.firstName ||
                    chat.user?.username ||
                    `User ${chat.userId.substring(0, 4)}...`,
                })
              }
              className={clsx(
                "p-3 border rounded-xl cursor-pointer transition-all",
                chat.unread
                  ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                  : "bg-slate-50 border-slate-100 hover:bg-slate-100",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-slate-700">
                  {chat.user?.firstName ||
                    chat.user?.username ||
                    `User ${chat.userId.substring(0, 4)}...`}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(chat.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p
                className={clsx(
                  "text-xs line-clamp-2",
                  chat.unread ? "text-blue-600 font-medium" : "text-slate-500",
                )}
              >
                {chat.message}
              </p>

              <div className="mt-2 flex justify-end">
                {chat.unread && (
                  <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full mr-auto">
                    New
                  </span>
                )}
                <button className="text-xs bg-blue-600 text-white px-2 py-1 rounded-md flex items-center gap-1 hover:bg-blue-700 transition">
                  <MessageCircle size={12} />
                  Join
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <button
          onClick={onMyChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-semibold"
        >
          <MessageCircle size={18} />
          My Chat
        </button>
      </div>
    </div>
  );
}
