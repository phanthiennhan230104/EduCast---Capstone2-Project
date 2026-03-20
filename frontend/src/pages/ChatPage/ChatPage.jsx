import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Input,
  List,
  Modal,
  Space,
  Spin,
  Typography,
  Upload,
} from "antd";
import {
  AudioOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  UserOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import "./chat-page.css";
import useChatSocket from "../../hooks/useChatSocket";
import {
  fetchConversations,
  fetchMessages,
  markRoomRead,
  searchChatUsers,
  startDirectChat,
  uploadChatAttachment,
} from "../../utils/chatApi";

const { Text, Title } = Typography;
const { Search, TextArea } = Input;

function getMessagePreview(message) {
  if (!message) return "Chưa có tin nhắn";
  if (message.message_type === "image") return "Đã gửi một hình ảnh";
  if (message.message_type === "audio") return "Đã gửi một audio";
  if (message.message_type === "file") return "Đã gửi một file";
  return message.content || "Tin nhắn";
}

function ConversationItem({ item, active, onClick }) {
  const peer = item.peer;
  const lastMessage = item.last_message;

  return (
    <div
      className={`conversation-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <Space align="start" style={{ width: "100%", justifyContent: "space-between" }}>
        <Space align="start">
          <Badge dot={peer?.is_online}>
            <Avatar icon={<UserOutlined />} src={peer?.avatar_url} />
          </Badge>

          <div style={{ maxWidth: 180 }}>
            <Text strong style={{ color: "white", display: "block" }}>
              {peer?.display_name || peer?.username || "Unknown"}
            </Text>
            <Text type="secondary" style={{ color: "#94a3b8" }}>
              {getMessagePreview(lastMessage)}
            </Text>
          </div>
        </Space>

        <div style={{ textAlign: "right" }}>
          {lastMessage?.created_at && (
            <Text style={{ color: "#94a3b8", fontSize: 12 }}>
              {dayjs(lastMessage.created_at).format("HH:mm")}
            </Text>
          )}
          {!!item.unread_count && (
            <div>
              <Badge count={item.unread_count} />
            </div>
          )}
        </div>
      </Space>
    </div>
  );
}

function MessageBubble({ message }) {
  const mine = message.is_mine;

  return (
    <div className={`message-row ${mine ? "mine" : ""}`}>
      <div className="message-bubble">
        {message.message_type === "text" && <div>{message.content}</div>}

        {message.message_type === "image" && (
          <div>
            {message.content ? <div>{message.content}</div> : null}
            <img
              className="attachment-preview"
              src={message.attachment_url}
              alt="attachment"
            />
          </div>
        )}

        {message.message_type === "audio" && (
          <div>
            {message.content ? <div>{message.content}</div> : null}
            <audio
              controls
              src={message.attachment_url}
              style={{ width: "100%", marginTop: 8 }}
            />
          </div>
        )}

        {message.message_type === "file" && (
          <div>
            {message.content ? <div>{message.content}</div> : null}
            <a
              href={message.attachment_url}
              target="_blank"
              rel="noreferrer"
              style={{ color: "white", textDecoration: "underline" }}
            >
              Mở file đính kèm
            </a>
          </div>
        )}

        <div style={{ marginTop: 8, textAlign: "right" }}>
          <Text style={{ color: "#dbeafe", fontSize: 11 }}>
            {dayjs(message.created_at).format("HH:mm")}
          </Text>
        </div>
      </div>
    </div>
  );
}

function NewChatModal({ open, onClose, onSelectUser }) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  const handleSearch = async (value) => {
    try {
      setLoading(true);
      const data = await searchChatUsers(value);
      setUsers(data);
    } catch (error) {
      toast.error(error.message || "Không tìm được user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) handleSearch("");
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title="Bắt đầu cuộc trò chuyện mới"
    >
      <Search
        placeholder="Tìm theo username hoặc email"
        onSearch={handleSearch}
        allowClear
        enterButton
      />

      <div style={{ marginTop: 16 }}>
        <List
          loading={loading}
          dataSource={users}
          renderItem={(user) => (
            <List.Item
              style={{ cursor: "pointer" }}
              onClick={() => onSelectUser(user)}
            >
              <List.Item.Meta
                avatar={<Avatar src={user.avatar_url} icon={<UserOutlined />} />}
                title={user.display_name || user.username}
                description={user.email}
              />
            </List.Item>
          )}
        />
      </div>
    </Modal>
  );
}

export default function ChatPage() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [openNewChat, setOpenNewChat] = useState(false);
  const [uploading, setUploading] = useState(false);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeRoomId) || null,
    [conversations, activeRoomId]
  );

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchConversations();
      setConversations(data);

      if (!activeRoomId && data.length > 0) {
        setActiveRoomId(data[0].id);
      }
    } catch (error) {
      toast.error(error.message || "Không tải được conversations");
    } finally {
      setLoading(false);
    }
  }, [activeRoomId]);

  const loadMessages = useCallback(async (roomId) => {
    try {
      const data = await fetchMessages(roomId);
      setMessages(data);
    } catch (error) {
      toast.error(error.message || "Không tải được messages");
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!activeRoomId) return;
    loadMessages(activeRoomId);
  }, [activeRoomId]);

  const handleIncomingMessage = useCallback((message) => {
    setMessages((prev) => {
      const exists = prev.some((item) => item.id === message.id);
      if (exists) return prev;
      return [...prev, message];
    });

    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === message.room
          ? {
              ...conversation,
              last_message: message,
            }
          : conversation
      )
    );
  }, []);

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

  const handleRead = useCallback(({ room_id, user_id }) => {
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
  }, [activeRoomId]);

  const { status, sendTextMessage, sendAttachmentMessage, markRead } = useChatSocket(
    activeRoomId,
    {
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
    }
  );

  const handleSendText = () => {
    const value = draft.trim();
    if (!value) return;

    const ok = sendTextMessage(value);
    if (!ok) {
      toast.error("WebSocket chưa kết nối");
      return;
    }
    setDraft("");
  };

  const handleUploadAndSend = async (file) => {
    try {
      setUploading(true);
      const uploaded = await uploadChatAttachment(file);

      const ok = sendAttachmentMessage({
        messageType: uploaded.message_type,
        attachmentUrl: uploaded.attachment_url,
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

  const handleCreateConversation = async (user) => {
    try {
      const data = await startDirectChat(user.id);
      setOpenNewChat(false);
      await loadConversations();
      setActiveRoomId(data.room_id);
      await loadMessages(data.room_id);
    } catch (error) {
      toast.error(error.message || "Không tạo được cuộc trò chuyện");
    }
  };

  if (loading) {
    return (
      <div className="chat-empty">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="chat-layout">
        <Card className="chat-card chat-sidebar" bodyStyle={{ padding: 16 }}>
          <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
            <Title level={3} style={{ color: "white", margin: 0 }}>
              Tin nhắn
            </Title>
            <Button
              type="primary"
              shape="circle"
              icon={<PlusOutlined />}
              onClick={() => setOpenNewChat(true)}
            />
          </Space>

          <div style={{ overflowY: "auto", flex: 1 }}>
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
              <div className="chat-header">
                <Space>
                  <Badge dot={activeConversation.peer?.is_online}>
                    <Avatar
                      size={44}
                      src={activeConversation.peer?.avatar_url}
                      icon={<UserOutlined />}
                    />
                  </Badge>
                  <div>
                    <Text strong style={{ color: "white", display: "block" }}>
                      {activeConversation.peer?.display_name || activeConversation.peer?.username}
                    </Text>
                    <Text style={{ color: "#94a3b8" }}>
                      {status === "open" ? "Đã kết nối realtime" : "Đang kết nối..."}
                    </Text>
                  </div>
                </Space>
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <Empty description="Chưa có tin nhắn" />
                ) : (
                  messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))
                )}
              </div>

              <div className="chat-composer">
                <Upload
                  showUploadList={false}
                  beforeUpload={handleUploadAndSend}
                  disabled={uploading}
                >
                  <Button icon={<PictureOutlined />} loading={uploading} />
                </Upload>

                <Upload
                  showUploadList={false}
                  beforeUpload={handleUploadAndSend}
                  disabled={uploading}
                >
                  <Button icon={<AudioOutlined />} loading={uploading} />
                </Upload>

                <Upload
                  showUploadList={false}
                  beforeUpload={handleUploadAndSend}
                  disabled={uploading}
                >
                  <Button icon={<PaperClipOutlined />} loading={uploading} />
                </Upload>

                <TextArea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  placeholder="Nhập tin nhắn..."
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                />

                <Button type="primary" icon={<SendOutlined />} onClick={handleSendText} />
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
              <Title level={4} style={{ color: "white", margin: 0 }}>
                {activeConversation.peer.display_name || activeConversation.peer.username}
              </Title>

              <Text style={{ color: "#94a3b8" }}>{activeConversation.peer.email}</Text>

              <div>
                <span className={`status-dot ${activeConversation.peer.is_online ? "" : "offline"}`} />
                <Text style={{ color: "#94a3b8" }}>
                  {activeConversation.peer.is_online ? "Đang online" : "Offline"}
                </Text>
              </div>

              <Button icon={<MessageOutlined />} block>
                Hồ sơ
              </Button>
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