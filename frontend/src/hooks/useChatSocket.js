import { useEffect, useRef, useState } from "react";
import { createChatSocket } from "../utils/chatApi";

export default function useChatSocket(roomId, handlers = {}) {
  const socketRef = useRef(null);
  const [status, setStatus] = useState("closed");

  useEffect(() => {
    if (!roomId) return;

    const socket = createChatSocket(roomId);
    socketRef.current = socket;
    setStatus("connecting");

    socket.onopen = () => {
      setStatus("open");
      handlers.onOpen?.();
      console.log("WS OPEN");
    };

    socket.onclose = (error) => {
      setStatus("closed");
      handlers.onClose?.();
      console.log("WS CLOSE", error.code, error.reason);
    };

    socket.onerror = (error) => {
      handlers.onError?.(error);
      console.log("WS ERROR", error);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === "message_created") {
          handlers.onMessage?.(payload.message);
        }

        if (payload.type === "presence") {
          handlers.onPresence?.(payload);
        }

        if (payload.type === "messages_read") {
          handlers.onRead?.(payload);
        }
      } catch (error) {
        console.error("WS parse error:", error);
      }
      console.log("WS MESSAGE", event.data);
    };

    return () => {
      socket.close();
      socketRef.current = null;
      setStatus("closed");
    };
  }, [roomId]);

  const sendJson = (data) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    socketRef.current.send(JSON.stringify(data));
    return true;
  };

  const sendTextMessage = (content) =>
    sendJson({
      action: "send_message",
      message_type: "text",
      content,
    });

  const sendAttachmentMessage = ({
    messageType,
    attachmentUrl,
    filename = "",
    size = null,
    content = "",
  }) =>
    sendJson({
      action: "send_message",
      message_type: messageType,
      content,
      attachment_url: attachmentUrl,
      filename,
      size,
    });

  const markRead = () =>
    sendJson({
      action: "mark_read",
    });

  return {
    status,
    sendJson,
    sendTextMessage,
    sendAttachmentMessage,
    markRead,
  };
}

