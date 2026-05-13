import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from 'react-i18next'
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
  deleteChatRoom,
} from "../../utils/chatApi";
import { useAuth } from "../../components/contexts/AuthContext";

import ConversationItem from "../../components/chat/ConversationItem";
import MessageBubble from "../../components/chat/MessageBubble";
import ChatHistoryPanel from "../../components/chat/ChatHistoryPanel";
import NewChatModal from "../../components/chat/NewChatModal";
import ChatHeader from "../../components/chat/ChatHeader";
import CommentModal from "../../components/feed/CommentModal";
import {
  normalizeConversationOwnership,
  normalizeMessageOwnership,
} from "../../utils/chat/chatHelpers";
import { useNavigate } from "react-router-dom";
import { getToken, getCurrentUser } from "../../utils/auth";
import { getCanonicalPostIdForEngagement } from "../../utils/canonicalPostId";
import { API_BASE_URL } from "../../config/apiBase";
import { PodcastContext } from "../../components/contexts/PodcastContext";
import { POST_REMOVED_EVENT, matchesRemovedPost } from "../../utils/postRemoval";

const { Text, Title } = Typography;
const { TextArea } = Input;
const IMAGE_ACCEPT = "image/*";
const FILE_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".zip",
  ".rar",
  ".mp3",
  ".wav",
  ".m4a",
  ".ogg",
  "audio/*",
].join(",");

export default function ChatPage() {
  const { t } = useTranslation()
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isPostDeleted, isPostHidden } = useContext(PodcastContext) || {
    isPostDeleted: () => false,
    isPostHidden: () => false,
  };
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [openNewChat, setOpenNewChat] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const micStreamRef = useRef(null);
  const discardRecordingRef = useRef(false);

  const messagesEndRef = useRef(null);
  const messageNodeRefs = useRef({});

  // Post detail modal state (mở từ MessageBubble click hoặc AudioPlayer click)
  const [postDetailModalOpen, setPostDetailModalOpen] = useState(false);
  const [postDetail, setPostDetail] = useState(null);
  const [postLiked, setPostLiked] = useState(false);
  const [postSaved, setPostSaved] = useState(false);
  const [postLikeCount, setPostLikeCount] = useState(0);
  const [postSaveCount, setPostSaveCount] = useState(0);
  const [postShareCount, setPostShareCount] = useState(0);
  const [postCommentCount, setPostCommentCount] = useState(0);

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

      normalizedData.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at || "";
        const bTime = b.last_message?.created_at || b.created_at || "";
        return dayjs(bTime).valueOf() - dayjs(aTime).valueOf();
      });

      setConversations(normalizedData);

      setActiveRoomId((prev) => {
        if (prev) return prev;
        return normalizedData.length > 0 ? normalizedData[0].id : null;
      });
    } catch (error) {
      toast.error(error.message || t('chat.loadConversationsFailed'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const handleDeleteRoom = async (roomId) => {
    try {
      await deleteChatRoom(roomId);

      setConversations((prev) => {
        const next = prev.filter((item) => item.id !== roomId);

        if (activeRoomId === roomId) {
          setActiveRoomId(next[0]?.id || null);
          setMessages([]);
        }

        return next;
      });

      toast.success("Đã xoá cuộc trò chuyện");
    } catch (error) {
      toast.error(error.message || "Không xoá được cuộc trò chuyện");
    }
  };

  const loadMessages = useCallback(
    async (roomId) => {
      try {
        const data = await fetchMessages(roomId);
        setMessages(data.map((item) => normalizeMessageOwnership(item, user?.id)));
      } catch (error) {
        toast.error(error.message || t('chat.loadMessagesFailed'));
      }
    },
    [user?.id, t]
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
          } catch (_) { }
        }
      },
    });

  const handleSendText = () => {
    const value = draft.trim();
    if (!value) return;

    if (status !== "open") {
      toast.error(t('chat.waitConnection'));
      return;
    }

    const ok = sendTextMessage(value);
    if (!ok) {
      toast.error(t('chat.websocketNotConnected'));
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
      toast.error(error.message || t('chat.uploadFailed'));
    } finally {
      setUploading(false);
    }

    return false;
  };

  const handleUploadByType = (type) => async (file) => {
    const mime = file.type || "";
    const isImage = mime.startsWith("image/");

    if (type === "image" && !isImage) {
      toast.error("Nút hình ảnh chỉ được chọn file ảnh");
      return Upload.LIST_IGNORE;
    }

    if (type === "file" && isImage) {
      toast.error("Nút attachment không dùng để gửi ảnh");
      return Upload.LIST_IGNORE;
    }

    return handleUploadAndSend(file);
  };

  const stopMicStream = () => {
    micStreamRef.current?.getTracks()?.forEach((track) => track.stop());
    micStreamRef.current = null;
  };

  const clearRecordTimer = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const handleStartRecording = async () => {
    if (status !== "open") {
      toast.error("Vui lòng chờ kết nối chat hoàn tất");
      return;
    }

    try {
      setRecordedAudio(null);
      setRecordSeconds(0);
      discardRecordingRef.current = false;
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearRecordTimer();
        stopMicStream();
        setRecording(false);

        if (discardRecordingRef.current) {
          setRecordedAudio(null);
          setRecordSeconds(0);
          return;
        }

        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        setRecordedAudio(blob);
      };

      recorder.start();
      setRecording(true);

      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error("Không thể bật micro");
    }
  };

  const handleStopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const handleCancelRecording = () => {
    discardRecordingRef.current = true;

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      stopMicStream();
      clearRecordTimer();
      setRecording(false);
      setRecordedAudio(null);
      setRecordSeconds(0);
    }
  };

  const handleSendRecordedAudio = async () => {
    if (!recordedAudio) return;

    const audioFile = new File(
      [recordedAudio],
      `voice-message-${Date.now()}.webm`,
      { type: recordedAudio.type || "audio/webm" }
    );

    await handleUploadAndSend(audioFile);
    setRecordedAudio(null);
    setRecordSeconds(0);
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

  const dispatchPostSync = useCallback((payload) => {
    if (!payload?.postId) return;
    try {
      const cached = JSON.parse(
        localStorage.getItem(`post-sync-${payload.postId}`) || "{}"
      );
      const next = { ...cached };
      if (typeof payload.liked === "boolean") next.liked = payload.liked;
      if (typeof payload.likeCount === "number") next.likeCount = payload.likeCount;
      if (typeof payload.saved === "boolean") next.saved = payload.saved;
      if (typeof payload.saveCount === "number") next.saveCount = payload.saveCount;
      localStorage.setItem(`post-sync-${payload.postId}`, JSON.stringify(next));
    } catch (_) {}
    window.dispatchEvent(
      new CustomEvent("post-sync-updated", { detail: payload })
    );
  }, []);

  const openPostDetailById = useCallback(
    async (rawPostId, options = {}) => {
      const contentPostId = String(rawPostId || "").trim();
      if (!contentPostId || contentPostId.startsWith("share_")) return;

      if (isPostDeleted?.(contentPostId)) {
        toast.info("Bài viết đã bị xoá nên không thể mở.");
        return;
      }
      if (isPostHidden?.(contentPostId)) {
        toast.info("Bài viết đã bị ẩn nên không thể mở.");
        return;
      }

      try {
        const token = getToken();
        const res = await fetch(
          `${API_BASE_URL}/content/posts/${encodeURIComponent(contentPostId)}/`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );

        if (res.status === 404) {
          toast.info("Bài viết không tồn tại hoặc đã bị xoá.");
          return;
        }

        const json = await res.json();
        const raw = json?.data;
        if (!res.ok || !raw?.id) return;

        let sync = {};
        try {
          sync = JSON.parse(localStorage.getItem(`post-sync-${raw.id}`) || "{}");
        } catch (_) {
          sync = {};
        }

        const detail = {
          id: raw.id,
          postId: raw.id,
          post_id: raw.id,
          title: raw.title,
          description: raw.description,
          author:
            raw.author ||
            raw.author_username ||
            options?.podcastPreview?.author ||
            "",
          author_avatar:
            raw.author_avatar ||
            (typeof options?.podcastPreview?.author === "object"
              ? options.podcastPreview.author?.avatar_url
              : "") ||
            "",
          authorUsername: raw.author_username || "",
          authorId: raw.author_id,
          author_id: raw.author_id,
          userId: raw.author_id,
          user_id: raw.author_id,
          isOwner: String(user?.id) === String(raw.author_id),
          cover: raw.thumbnail_url || "",
          thumbnail_url: raw.thumbnail_url || "",
          audio_url: raw.audio_url || "",
          audioUrl: raw.audio_url || "",
          duration_seconds: raw.duration_seconds || 0,
          durationSeconds: raw.duration_seconds || 0,
          created_at: raw.created_at,
          timeAgo: raw.timeAgo,
        };

        setPostDetail(detail);
        setPostLiked(
          typeof sync.liked === "boolean" ? sync.liked : Boolean(raw.is_liked)
        );
        setPostSaved(
          typeof sync.saved === "boolean" ? sync.saved : Boolean(raw.is_saved)
        );
        setPostLikeCount(
          typeof sync.likeCount === "number"
            ? sync.likeCount
            : Number(raw.like_count || 0)
        );
        setPostSaveCount(
          typeof sync.saveCount === "number"
            ? sync.saveCount
            : Number(raw.save_count || 0)
        );
        setPostShareCount(Number(raw.share_count || 0));
        setPostCommentCount(Number(raw.comment_count || 0));
        setPostDetailModalOpen(true);
      } catch (err) {
        console.error("ChatPage: failed to load post detail", err);
      }
    },
    [user?.id, isPostDeleted, isPostHidden]
  );

  // Tự động đóng modal chi tiết khi chính bài đó vừa bị xoá/ẩn ở nơi khác.
  useEffect(() => {
    const handleRemoved = (event) => {
      const removedId = event.detail?.postId;
      if (!removedId) return;
      setPostDetail((prev) =>
        prev && matchesRemovedPost(prev, removedId) ? null : prev
      );
      setPostDetailModalOpen((prev) => {
        if (!prev) return prev;
        if (postDetail && matchesRemovedPost(postDetail, removedId)) {
          return false;
        }
        return prev;
      });
    };
    window.addEventListener(POST_REMOVED_EVENT, handleRemoved);
    return () => window.removeEventListener(POST_REMOVED_EVENT, handleRemoved);
  }, [postDetail]);

  useEffect(() => {
    const handleOpenPostDetail = (event) => {
      const detail = event.detail || {};
      const rowPostId = detail.postId;
      if (!rowPostId) return;

      const contentPostId =
        detail.canonicalPostId ||
        getCanonicalPostIdForEngagement({
          id: rowPostId,
          postId: rowPostId,
          post_id: rowPostId,
        }) ||
        rowPostId;

      void openPostDetailById(contentPostId, {
        podcastPreview: detail.podcastPreview,
      });
    };

    window.addEventListener("open-post-detail", handleOpenPostDetail);
    return () => {
      window.removeEventListener("open-post-detail", handleOpenPostDetail);
    };
  }, [openPostDetailById]);

  // Đồng bộ tiêu đề / mô tả / like / save khi bài bị chỉnh sửa ở nơi khác (Feed/Search/Favorites).
  useEffect(() => {
    const handlePostSync = (event) => {
      const d = event.detail || {};
      if (!d.postId) return;
      setPostDetail((prev) => {
        if (!prev || String(prev.id) !== String(d.postId)) return prev;
        return {
          ...prev,
          ...(typeof d.title === "string" ? { title: d.title } : {}),
          ...(typeof d.description === "string"
            ? { description: d.description }
            : {}),
        };
      });
      if (postDetail && String(postDetail.id) === String(d.postId)) {
        if (typeof d.liked === "boolean") setPostLiked(d.liked);
        if (typeof d.likeCount === "number") setPostLikeCount(d.likeCount);
        if (typeof d.saved === "boolean") setPostSaved(d.saved);
        if (typeof d.saveCount === "number") setPostSaveCount(d.saveCount);
      }
    };

    window.addEventListener("post-sync-updated", handlePostSync);
    return () => {
      window.removeEventListener("post-sync-updated", handlePostSync);
    };
  }, [postDetail]);

  const handleClosePostDetail = useCallback(() => {
    setPostDetailModalOpen(false);
    setPostDetail(null);
  }, []);

  const handleTogglePostLike = useCallback(async () => {
    if (!postDetail?.id) return;
    try {
      const token = getToken();
      const currentUser = getCurrentUser();
      const res = await fetch(
        `${API_BASE_URL}/social/posts/${encodeURIComponent(postDetail.id)}/like/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: currentUser?.id }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      const nextLiked = Boolean(data.data?.liked);
      const nextLikeCount = Number(data.data?.like_count || 0);
      setPostLiked(nextLiked);
      setPostLikeCount(nextLikeCount);
      dispatchPostSync({
        postId: postDetail.id,
        liked: nextLiked,
        likeCount: nextLikeCount,
      });
    } catch (err) {
      console.error("ChatPage: toggle like failed", err);
    }
  }, [postDetail, dispatchPostSync]);

  const handleTogglePostSave = useCallback(async () => {
    if (!postDetail?.id) return;
    try {
      const token = getToken();
      const currentUser = getCurrentUser();
      const res = await fetch(
        `${API_BASE_URL}/social/posts/${encodeURIComponent(postDetail.id)}/save/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: currentUser?.id }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      const nextSaved = Boolean(data.data?.saved);
      const nextSaveCount = Number(data.data?.save_count || 0);
      setPostSaved(nextSaved);
      setPostSaveCount(nextSaveCount);
      dispatchPostSync({
        postId: postDetail.id,
        saved: nextSaved,
        saveCount: nextSaveCount,
      });
    } catch (err) {
      console.error("ChatPage: toggle save failed", err);
    }
  }, [postDetail, dispatchPostSync]);

  const handlePostDeletedInChat = useCallback(() => {
    setPostDetailModalOpen(false);
    setPostDetail(null);
  }, []);

  
  useEffect(() => {
    const handleChatMessageSent = async (event) => {
      const roomId = event.detail?.roomId;

      await loadConversations();

      if (roomId) {
        setActiveRoomId(roomId);
        await loadMessages(roomId);
        return;
      }

      if (activeRoomId) {
        await loadMessages(activeRoomId);
      }
    };

    window.addEventListener("chat-message-sent", handleChatMessageSent);

    return () => {
      window.removeEventListener("chat-message-sent", handleChatMessageSent);
    };
  }, [activeRoomId, loadMessages, loadConversations]);

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
      <div className={`chat-layout ${rightPanelOpen ? "" : "right-panel-hidden"}`}>
        <Card className="chat-card chat-sidebar" bodyStyle={{ padding: 16 }}>
          <Space
            style={{
              width: "100%",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <Title level={3} className="chat-sidebar-title">
              {t('chat.title')}
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
              <Empty description={t('chat.noConversations')} />
            ) : (
              conversations.map((item) => (
                <ConversationItem
                  key={item.id}
                  item={item}
                  active={item.id === activeRoomId}
                  onClick={() => setActiveRoomId(item.id)}
                  onDelete={() => handleDeleteRoom(item.id)}
                />
              ))
            )}
          </div>
        </Card>

        <Card className="chat-card chat-messages-wrap" bodyStyle={{ padding: 0 }}>
          {activeConversation ? (
            <>
              <ChatHeader
                peer={activeConversation.peer}
                rightPanelOpen={rightPanelOpen}
                onToggleInfoPanel={() => setRightPanelOpen((prev) => !prev)}
              />

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <Empty description={t('chat.noMessages')} />
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
                    accept={IMAGE_ACCEPT}
                    showUploadList={false}
                    beforeUpload={handleUploadByType("image")}
                    disabled={uploading || status !== "open"}
                  >
                    <Button
                      className="composer-icon-btn"
                      icon={<PictureOutlined />}
                      loading={uploading}
                      disabled={status !== "open"}
                    />
                  </Upload>

                  <div className="record-control">
                    <Button
                      className={`composer-icon-btn recording-mic-btn ${recording ? "is-recording" : ""}`}
                      icon={<AudioOutlined />}
                      disabled={status !== "open" || uploading}
                      onClick={recording ? handleStopRecording : handleStartRecording}
                    />
                    {recording && (
                      <span className="record-timer-under-icon">{recordSeconds}s</span>
                    )}
                  </div>

                  <Upload
                    accept={FILE_ACCEPT}
                    showUploadList={false}
                    beforeUpload={handleUploadByType("file")}
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
                {recordedAudio && !recording && (
                  <div className="recording-box">
                    <audio controls src={URL.createObjectURL(recordedAudio)} />
                    <Button size="small" type="primary" onClick={handleSendRecordedAudio}>
                      Gửi
                    </Button>
                    <Button size="small" danger onClick={() => setRecordedAudio(null)}>
                      Huỷ
                    </Button>
                  </div>
                )}
                <TextArea
                  className="composer-textarea"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoSize={{ minRows: 1, maxRows: 3 }}
                  placeholder={
                    status === "open"
                      ? t('chat.messagePlaceholder')
                      : t('chat.connectingRealtime')
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
              <Empty description={t('chat.selectConversation')} />
            </div>
          )}
        </Card>

        <Card
          className={`chat-card right-panel ${rightPanelOpen ? "is-open" : "is-hidden"}`}
          bodyStyle={{ padding: 16 }}
        >
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

              <Button
                icon={<MessageOutlined />}
                block
                onClick={() => {
                  const peerId = activeConversation?.peer?.id;
                  if (!peerId) {
                    toast.error("Không tìm thấy ID người dùng");
                    return;
                  }

                  navigate(`/profile/${peerId}`);
                }}
              >
                Hồ sơ
              </Button>

              <ChatHistoryPanel
                messages={messages}
                onJumpToMessage={scrollToMessage}
              />
            </Space>
          ) : (
            <Empty description={t('chat.noInfo')} />
          )}
        </Card>
      </div>

      <NewChatModal
        open={openNewChat}
        onClose={() => setOpenNewChat(false)}
        onSelectUser={handleCreateConversation}
      />

      {postDetailModalOpen && postDetail && (
        <CommentModal
          podcast={postDetail}
          liked={postLiked}
          saved={postSaved}
          likeCount={postLikeCount}
          shareCount={postShareCount}
          saveCount={postSaveCount}
          commentCount={postCommentCount}
          onClose={handleClosePostDetail}
          onCommentCountChange={setPostCommentCount}
          onToggleLike={handleTogglePostLike}
          onToggleSave={handleTogglePostSave}
          onShare={() => {}}
          onPostDeleted={handlePostDeletedInChat}
          disableAutoScroll={true}
        />
      )}
    </div>
  );
}