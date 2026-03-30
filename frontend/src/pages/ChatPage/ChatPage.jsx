import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Spin,
  Typography,
  Upload,
} from "antd";
import {
  AudioOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import "../../style/chat/chat-page.css";
import useChatSocket from "../../hooks/useChatSocket";
import useChatInboxSocket from "../../hooks/useChatInboxSocket";
import {
  fetchConversations,
  fetchMessages,
  markRoomRead,
  startDirectChat,
  uploadChatAttachment,
} from "../../utils/chatApi";
import { useAuth } from "../../components/contexts/AuthContext";

import ConversationItem from "../../components/chat/ConversationItem";
import MessageBubble from "../../components/chat/MessageBubble";
import ChatHistoryPanel from "../../components/chat/ChatHistoryPanel";
import NewChatModal from "../../components/chat/NewChatModal";
import ChatHeader from "../../components/chat/ChatHeader";
import {
  normalizeConversationOwnership,
  normalizeMessageOwnership,
} from "../../utils/chat/chatHelpers";

const { Text, Title } = Typography;
const { TextArea } = Input;

export default function ChatPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [openNewChat, setOpenNewChat] = useState(false);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const messageNodeRefs = useRef({});

  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeRoomId) || null,
    [conversations, activeRoomId]
  );

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchConversations();
      const normalizedData = data.map((item) =>
        normalizeConversationOwnership(item, user?.id)
      );

      setConversations(normalizedData);

      setActiveRoomId((prev) => {
        if (prev) return prev;
        return normalizedData.length > 0 ? normalizedData[0].id : null;
      });
    } catch (error) {
      toast.error(error.message || "Không tải được conversations");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadMessages = useCallback(
    async (roomId) => {
      try {
        const data = await fetchMessages(roomId);
        setMessages(data.map((item) => normalizeMessageOwnership(item, user?.id)));
      } catch (error) {
        toast.error(error.message || "Không tải được messages");
      }
    },
    [user?.id]
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeRoomId) return;
    loadMessages(activeRoomId);
  }, [activeRoomId, loadMessages]);

  useEffect(() => {
    scrollToBottom("auto");
  }, [activeRoomId, scrollToBottom]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      scrollToBottom("auto");
    });
    return () => cancelAnimationFrame(id);
  }, [messages, scrollToBottom]);

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

      setActiveRoomId((prev) => prev || normalizedConversation.id);
    },
    [user?.id]
  );

  const handleIncomingMessage = useCallback(
    (message) => {
      const normalizedMessage = normalizeMessageOwnership(message, user?.id);

      setMessages((prev) => {
        const exists = prev.some((item) => item.id === normalizedMessage.id);
        if (exists) return prev;
        return [...prev, normalizedMessage];
      });

      mergeConversation({
        id: message.room,
        last_message: normalizedMessage,
      });
    },
    [mergeConversation, user?.id]
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
  }, []);

  useChatInboxSocket({
    onConversationCreated: mergeConversation,
    onConversationUpdated: mergeConversation,
    onPresence: handlePresence,
  });

  const handleRead = useCallback(
    ({ room_id, user_id }) => {
      if (room_id !== activeRoomId) return;

      setMessages((prev) =>
        prev.map((msg) => {
          if (String(msg.sender?.id) === String(user_id)) return msg;

          const readBy = new Set(msg.read_by_user_ids || []);
          readBy.add(user_id);

          return {
            ...msg,
            read_by_user_ids: Array.from(readBy),
          };
        })
      );
    },
    [activeRoomId]
  );

  const { status, sendTextMessage, sendAttachmentMessage, markRead } =
    useChatSocket(activeRoomId, {
      onMessage: handleIncomingMessage,
      onPresence: handlePresence,
      onRead: handleRead,
      onOpen: async () => {
        if (activeRoomId) {
          try {
            await markRoomRead(activeRoomId);
            markRead();
          } catch (_) {}
        }
      },
    });

  const handleSendText = () => {
    const value = draft.trim();
    if (!value) return;

    if (status !== "open") {
      toast.error("Vui lòng chờ kết nối chat hoàn tất");
      return;
    }

    const ok = sendTextMessage(value);
    if (!ok) {
      toast.error("WebSocket chưa kết nối");
      return;
    }

    setDraft("");
  };

  const handleUploadAndSend = async (file) => {
    if (status !== "open") {
      toast.error("Vui lòng chờ kết nối chat hoàn tất");
      return false;
    }

    try {
      setUploading(true);
      const uploaded = await uploadChatAttachment(file);

      const ok = sendAttachmentMessage({
        messageType: uploaded.message_type,
        attachmentUrl: uploaded.attachment_url,
        filename: uploaded.filename,
        size: uploaded.size,
        content: "",
      });

      if (!ok) {
        toast.error("WebSocket chưa kết nối");
      }
    } catch (error) {
      toast.error(error.message || "Upload thất bại");
    } finally {
      setUploading(false);
    }

    return false;
  };

  const scrollToMessage = useCallback((messageId) => {
    const node = messageNodeRefs.current[messageId];
    if (!node) return;

    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.add("message-row-highlight");

    window.setTimeout(() => {
      node.classList.remove("message-row-highlight");
    }, 1600);
  }, []);

  const handleCreateConversation = async (selectedUser) => {
    try {
      const data = await startDirectChat(selectedUser.id);
      setOpenNewChat(false);
      setActiveRoomId(data.room_id);
      await loadMessages(data.room_id);
    } catch (error) {
      toast.error(error.message || "Không tạo được cuộc trò chuyện");
    }
  };

  if (loading) {
    return (
      <div className="chat-page chat-page-in-layout">
        <div className="chat-empty">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page chat-page-in-layout">
      <div className="chat-layout">
        <Card className="chat-card chat-sidebar" bodyStyle={{ padding: 16 }}>
          <Space
            style={{
              width: "100%",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Title level={3} className="chat-sidebar-title">
              Tin nhắn
            </Title>

            <Button
              type="primary"
              shape="circle"
              icon={<PlusOutlined />}
              onClick={() => setOpenNewChat(true)}
            />
          </Space>

          <div className="conversation-list">
            {conversations.length === 0 ? (
              <Empty description="Chưa có cuộc trò chuyện" />
            ) : (
              conversations.map((item) => (
                <ConversationItem
                  key={item.id}
                  item={item}
                  active={item.id === activeRoomId}
                  onClick={() => setActiveRoomId(item.id)}
                />
              ))
            )}
          </div>
        </Card>

        <Card className="chat-card chat-messages-wrap" bodyStyle={{ padding: 0 }}>
          {activeConversation ? (
            <>
              <ChatHeader peer={activeConversation.peer} />

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <Empty description="Chưa có tin nhắn" />
                ) : (
                  <>
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        containerRef={(node) => {
                          if (node) messageNodeRefs.current[message.id] = node;
                          else delete messageNodeRefs.current[message.id];
                        }}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div className="chat-composer">
                <div className="chat-composer-actions">
                  <Upload
                    showUploadList={false}
                    beforeUpload={handleUploadAndSend}
                    disabled={uploading || status !== "open"}
                  >
                    <Button
                      className="composer-icon-btn"
                      icon={<PictureOutlined />}
                      loading={uploading}
                      disabled={status !== "open"}
                    />
                  </Upload>

                  <Upload
                    showUploadList={false}
                    beforeUpload={handleUploadAndSend}
                    disabled={uploading || status !== "open"}
                  >
                    <Button
                      className="composer-icon-btn"
                      icon={<AudioOutlined />}
                      loading={uploading}
                      disabled={status !== "open"}
                    />
                  </Upload>

                  <Upload
                    showUploadList={false}
                    beforeUpload={handleUploadAndSend}
                    disabled={uploading || status !== "open"}
                  >
                    <Button
                      className="composer-icon-btn"
                      icon={<PaperClipOutlined />}
                      loading={uploading}
                      disabled={status !== "open"}
                    />
                  </Upload>
                </div>

                <TextArea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  placeholder={
                    status === "open"
                      ? "Nhập tin nhắn..."
                      : "Đang kết nối realtime..."
                  }
                  disabled={status !== "open"}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                />

                <Button
                  type="primary"
                  className="composer-send-btn"
                  icon={<SendOutlined />}
                  onClick={handleSendText}
                  disabled={status !== "open"}
                />
              </div>
            </>
          ) : (
            <div className="chat-empty">
              <Empty description="Chọn một cuộc trò chuyện" />
            </div>
          )}
        </Card>

        <Card className="chat-card right-panel" bodyStyle={{ padding: 16 }}>
          {activeConversation?.peer ? (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Avatar
                size={80}
                src={activeConversation.peer.avatar_url}
                icon={<UserOutlined />}
              />

              <Title level={4} className="chat-profile-name">
                {activeConversation.peer.display_name ||
                  activeConversation.peer.username}
              </Title>

              <Text style={{ color: "#94a3b8" }}>
                {activeConversation.peer.email}
              </Text>

              <Button icon={<MessageOutlined />} block>
                Hồ sơ
              </Button>

              <ChatHistoryPanel
                messages={messages}
                onJumpToMessage={scrollToMessage}
              />
            </Space>
          ) : (
            <Empty description="Không có thông tin" />
          )}
        </Card>
      </div>

      <NewChatModal
        open={openNewChat}
        onClose={() => setOpenNewChat(false)}
        onSelectUser={handleCreateConversation}
      />
    </div>
  );
}