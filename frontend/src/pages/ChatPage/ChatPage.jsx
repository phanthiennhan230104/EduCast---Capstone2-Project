import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  DownloadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import "./chat-page.css";
import useChatSocket from "../../hooks/useChatSocket";
import useChatInboxSocket from "../../hooks/useChatInboxSocket";
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
  if (message.message_type === "file") {
    return message.original_filename || "Đã gửi một file";
  }
  return message.content || "Tin nhắn";
}

function getFileNameFromUrl(url = "") {
  try {
    const cleanUrl = url.split("?")[0];
    const rawName = cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1);
    return decodeURIComponent(rawName || "attachment");
  } catch {
    return "attachment";
  }
}

function getFileExtension(filename = "") {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function formatFileSize(bytes) {
  if (!bytes || Number.isNaN(Number(bytes))) return "";
  const value = Number(bytes);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function FileTypeIcon({ ext }) {
  if (ext === "pdf") return <FilePdfOutlined />;
  if (["doc", "docx"].includes(ext)) return <FileWordOutlined />;
  if (["txt", "md"].includes(ext)) return <FileTextOutlined />;
  return <FileOutlined />;
}

function ConversationItem({ item, active, onClick }) {
  const peer = item.peer;
  const lastMessage = item.last_message;

  return (
    <div
      className={`conversation-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <Space
        align="start"
        style={{ width: "100%", justifyContent: "space-between" }}
      >
        <Space align="start" size={12}>
          <Badge dot={peer?.is_online}>
            <Avatar icon={<UserOutlined />} src={peer?.avatar_url} />
          </Badge>

          <div className="conversation-content">
            <Text strong className="conversation-name">
              {peer?.display_name || peer?.username || "Unknown"}
            </Text>
            <Text className="conversation-preview">
              {getMessagePreview(lastMessage)}
            </Text>
          </div>
        </Space>

        <div className="conversation-meta">
          {lastMessage?.created_at && (
            <Text className="conversation-time">
              {dayjs(lastMessage.created_at).format("HH:mm")}
            </Text>
          )}

          {!!item.unread_count && (
            <div className="conversation-unread">
              <Badge count={item.unread_count} />
            </div>
          )}
        </div>
      </Space>
    </div>
  );
}

function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function ChatAudioPlayer({ src, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) audio.pause();
    else audio.play();
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime || 0);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const value = Number(e.target.value);
    audio.currentTime = value;
    setCurrentTime(value);
  };

  return (
    <div className={`chat-audio ${mine ? "mine" : ""}`}>
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <button
        type="button"
        className="chat-audio-play"
        onClick={togglePlay}
        aria-label={playing ? "Pause audio" : "Play audio"}
      >
        {playing ? "❚❚" : "▶"}
      </button>

      <div className="chat-audio-body">
        <div className="chat-audio-wave">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <input
          className="chat-audio-range"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={handleSeek}
        />

        <div className="chat-audio-time">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const mine = message.is_mine;
  const [previewOpen, setPreviewOpen] = useState(false);

  const fileName =
    message.original_filename || getFileNameFromUrl(message.attachment_url || "");
  const fileExt = getFileExtension(fileName);
  const fileSize = formatFileSize(message.file_size);

  const isText = message.message_type === "text";
  const isImage = message.message_type === "image";
  const isAudio = message.message_type === "audio";
  const isFile = message.message_type === "file";

  return (
    <>
      <div className={`message-row ${mine ? "mine" : ""}`}>
        {isText && (
          <div className="message-bubble">
            <div>{message.content}</div>
            <div className="message-time">
              <Text style={{ color: "#dbeafe", fontSize: 11 }}>
                {dayjs(message.created_at).format("HH:mm")}
              </Text>
            </div>
          </div>
        )}

        {isImage && (
          <div
            className={`message-media message-media-image ${mine ? "mine" : ""}`}
          >
            {message.content ? (
              <div className="message-media-caption">{message.content}</div>
            ) : null}

            <img
              className="attachment-preview attachment-preview-clickable"
              src={message.attachment_url}
              alt="attachment"
              onClick={() => setPreviewOpen(true)}
            />

            <div className="message-media-time">
              <Text style={{ color: "#cbd5e1", fontSize: 11 }}>
                {dayjs(message.created_at).format("HH:mm")}
              </Text>
            </div>
          </div>
        )}

        {isAudio && (
          <div
            className={`message-media message-media-audio ${mine ? "mine" : ""}`}
          >
            {message.content ? (
              <div className="message-media-caption">{message.content}</div>
            ) : null}

            <ChatAudioPlayer src={message.attachment_url} mine={mine} />

            <div className="message-media-time">
              <Text style={{ color: "#cbd5e1", fontSize: 11 }}>
                {dayjs(message.created_at).format("HH:mm")}
              </Text>
            </div>
          </div>
        )}

        {isFile && (
          <div className={`message-file ${mine ? "mine" : ""}`}>
            {message.content ? (
              <div className="message-media-caption">{message.content}</div>
            ) : null}

            <a
              href={message.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="file-card"
            >
              <div className="file-card-icon">
                <FileTypeIcon ext={fileExt} />
              </div>

              <div className="file-card-info">
                <div className="file-card-name" title={fileName}>
                  {fileName}
                </div>
                <div className="file-card-meta">
                  {fileSize || fileExt.toUpperCase() || "FILE"}
                </div>
              </div>

              <div className="file-card-action">
                <DownloadOutlined />
              </div>
            </a>

            <div className="message-media-time">
              <Text style={{ color: "#cbd5e1", fontSize: 11 }}>
                {dayjs(message.created_at).format("HH:mm")}
              </Text>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={previewOpen}
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        centered
        width="auto"
        className="image-preview-modal"
      >
        <img
          src={message.attachment_url}
          alt="preview"
          className="image-preview-modal-img"
        />
      </Modal>
    </>
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

  const messagesEndRef = useRef(null);

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
      setConversations(data);

      setActiveRoomId((prev) => {
        if (prev) return prev;
        return data.length > 0 ? data[0].id : null;
      });
    } catch (error) {
      toast.error(error.message || "Không tải được conversations");
    } finally {
      setLoading(false);
    }
  }, []);

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

  const mergeConversation = useCallback((conversation) => {
  if (!conversation?.id) return;

  setConversations((prev) => {
    const next = [...prev];
    const index = next.findIndex((item) => item.id === conversation.id);

    if (index >= 0) {
      next[index] = {
        ...next[index],
        ...conversation,
      };
    } else {
      next.unshift(conversation);
    }

    next.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at || "";
      const bTime = b.last_message?.created_at || b.created_at || "";
      return dayjs(bTime).valueOf() - dayjs(aTime).valueOf();
    });

    return next;
  });

  setActiveRoomId((prev) => prev || conversation.id);
}, []);

const handleIncomingMessage = useCallback((message) => {
  setMessages((prev) => {
    const exists = prev.some((item) => item.id === message.id);
    if (exists) return prev;
    return [...prev, message];
  });

  mergeConversation({
    id: message.room,
    last_message: message,
  });
}, [mergeConversation]);

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

  const handleCreateConversation = async (user) => {
    try {
      const data = await startDirectChat(user.id);
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
                      {activeConversation.peer?.display_name ||
                        activeConversation.peer?.username}
                    </Text>

                    <Text style={{ color: "#94a3b8" }}>
                      {status === "open"
                        ? "Đã kết nối realtime"
                        : "Đang kết nối..."}
                    </Text>
                  </div>
                </Space>
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <Empty description="Chưa có tin nhắn" />
                ) : (
                  <>
                    {messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
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

              <Title level={4} style={{ color: "white", margin: 0 }}>
                {activeConversation.peer.display_name ||
                  activeConversation.peer.username}
              </Title>

              <Text style={{ color: "#94a3b8" }}>
                {activeConversation.peer.email}
              </Text>

              <div>
                <span
                  className={`status-dot ${
                    activeConversation.peer.is_online ? "" : "offline"
                  }`}
                />
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