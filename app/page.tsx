"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";
import AdminPanel from "@/components/AdminPanel";
import { User } from "@prisma/client";

type SelectedUser = User & { name?: string };

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminSelectedUser, setAdminSelectedUser] =
    useState<SelectedUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login"); // Redirect to handle login
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.authenticated) {
          setUser(data.user);
          // Set default view to "My Chat" for admins
          if (data.user.role === "ADMIN") {
            setAdminSelectedUser(data.user); // Set the full user object
          }
        }
      })
      .catch((err) => {
        console.error("Auth check failed", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">
            Loading Khun Preaw...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = user.role === "ADMIN";

  if (isAdmin) {
    return (
      <main className="min-h-screen bg-slate-100 flex font-sans">
        <AdminPanel
          onSelectUser={(u: any) => setAdminSelectedUser(u)}
          onMyChat={() => setAdminSelectedUser(user)} // Pass the full user object
        />
        <div className="flex-1 p-4 md:p-8">
          {adminSelectedUser ? (
            <div className="h-[85vh] max-w-4xl mx-auto">
              <ChatInterface
                user={user}
                overrideRoomId={
                  adminSelectedUser.id === user.id
                    ? undefined
                    : adminSelectedUser.id
                }
                chatName={
                  adminSelectedUser.id === user.id
                    ? undefined
                    : adminSelectedUser.name
                }
                chatAvatarUrl={
                  adminSelectedUser.id === user.id
                    ? undefined
                    : adminSelectedUser.avatarUrl
                }
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              Select a user to chat
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto h-[85vh]">
        <ChatInterface user={user} />
      </div>
    </main>
  );
}
