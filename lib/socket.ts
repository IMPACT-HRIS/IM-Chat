"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket;

export const useSocket = () => {
  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  useEffect(() => {
    if (!socket) {
      socket = io(
        process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000",
        {
          transports: ["websocket"],
        },
      );
    }

    setSocketInstance(socket);

    return () => {
      // Don't disconnect here to share connection across components if needed
      // But for this simple app, it's fine.
    };
  }, []);

  return socketInstance;
};
