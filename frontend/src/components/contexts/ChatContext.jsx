import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { fetchConversations } from "../../utils/chatApi";
import { normalizeConversationOwnership } from "../../utils/chat/chatHelpers";
import useChatInboxSocket from "../../hooks/useChatInboxSocket";
import { useAuth } from "./AuthContext";
import dayjs from "dayjs";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const data = await fetchConversations();
      const normalizedData = data.map((item) =>
        normalizeConversationOwnership(item, user?.id)
      );

      normalizedData.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at || "";
        const bTime = b.last_message?.created_at || b.created_at || "";
        return dayjs(bTime).valueOf() - dayjs(aTime).valueOf();
      });

      setConversations(normalizedData);
    } catch (error) {
      console.error("Failed to load conversations", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAuthenticated]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const mergeConversation = useCallback(
    (conversation) => {
      if (!conversation?.id) return;

      const normalizedConversation = normalizeConversationOwnership(
        conversation,
        user?.id
      );

      setConversations((prev) => {
        const next = [...prev];
        const index = next.findIndex(
          (item) => item.id === normalizedConversation.id
        );

        if (index >= 0) {
          next[index] = {
            ...next[index],
            ...normalizedConversation,
          };
        } else {
          next.unshift(normalizedConversation);
        }

        next.sort((a, b) => {
          const aTime = a.last_message?.created_at || a.created_at || "";
          const bTime = b.last_message?.created_at || b.created_at || "";
          return dayjs(bTime).valueOf() - dayjs(aTime).valueOf();
        });

        return next;
      });
    },
    [user?.id]
  );

  const handlePresence = useCallback(({ user_id, status }) => {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.peer?.id === user_id
          ? {
            ...conversation,
            peer: {
              ...conversation.peer,
              is_online: status === "online",
            },
          }
          : conversation
      )
    );
    console.log("IS ONLINE?", is_online);
  }, []);

  useChatInboxSocket(
    {
      onConversationCreated: mergeConversation,
      onConversationUpdated: mergeConversation,
      onPresence: handlePresence,
    },
    isAuthenticated
  );

  const unreadRoomsCount = useMemo(() => {
    return conversations.filter(c => c.unread_count > 0).length;
  }, [conversations]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        setConversations,
        loading,
        mergeConversation,
        unreadRoomsCount,
        loadConversations,
        handlePresence,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
};
