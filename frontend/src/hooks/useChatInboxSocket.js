import { useEffect, useRef, useState } from "react";
import { createChatInboxSocket } from "../utils/chatApi";

export default function useChatInboxSocket(handlers = {}) {
  const socketRef = useRef(null);
  const [status, setStatus] = useState("closed");

  useEffect(() => {
    const socket = createChatInboxSocket();
    socketRef.current = socket;
    setStatus("connecting");

    socket.onopen = () => {
      setStatus("open");
      handlers.onOpen?.();
    };

    socket.onclose = () => {
      setStatus("closed");
      handlers.onClose?.();
    };

    socket.onerror = (error) => {
      handlers.onError?.(error);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === "conversation_created") {
          handlers.onConversationCreated?.(payload.conversation);
        }

        if (payload.type === "conversation_updated") {
          handlers.onConversationUpdated?.(payload.conversation);
        }
      } catch (error) {
        console.error("Inbox WS parse error:", error);
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
      setStatus("closed");
    };
  }, []);

  return { status };
}