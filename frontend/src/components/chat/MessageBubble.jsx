import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import React from "react";
import { Modal, Typography } from "antd";
import {
  DownloadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
} from "@ant-design/icons";
import { EyeOff, Ban } from "lucide-react";
import { toast } from "react-toastify";
import ChatAudioPlayer from "./ChatAudioPlayer"
import { useTranslation } from "react-i18next";
import {
  formatFileSize,
  getFileExtension,
  getFileNameFromUrl,
  formatChatTime,
} from "../../utils/chat/chatHelpers"
import { PodcastContext } from "../contexts/PodcastContext"

const { Text } = Typography

function FileTypeIcon({ ext }) {
  if (ext === "pdf") return <FilePdfOutlined />;
  if (["doc", "docx"].includes(ext)) return <FileWordOutlined />;
  if (["txt", "md"].includes(ext)) return <FileTextOutlined />;
  return <FileOutlined />;
}

function getInitialsFromName(name) {
  if (!name) return ""
  const parts = String(name).trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase()
}

function formatTimeAgo(dateString) {
  if (!dateString) return t("feed.time.justNow")

  const created = new Date(dateString)
  const now = new Date()
  const diffMs = now - created
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return t("feed.time.justNow")
  if (diffMinutes < 60) return t("feed.time.minutesAgo", { count: diffMinutes })
  if (diffHours < 24) return t("feed.time.hoursAgo", { count: diffHours })
  return t("feed.time.daysAgo", { count: diffDays })
}

export default function MessageBubble({ message, containerRef }) {
  const { t } = useTranslation();
  const navigate = useNavigate()
  const mine = message.is_mine
  const [podcastData, setPodcastData] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const messageTimeLabel = formatChatTime(message.created_at);
  const { isPostDeleted, isPostHidden } = useContext(PodcastContext) || {
    isPostDeleted: () => false,
    isPostHidden: () => false,
  }

  const fileName =
    message.original_filename || getFileNameFromUrl(message.attachment_url || "")
  const fileExt = getFileExtension(fileName)
  const fileSize = formatFileSize(message.file_size)

  const isText = message.message_type === "text"
  const isImage = message.message_type === "image"
  const isAudio = message.message_type === "audio"
  const isFile = message.message_type === "file"
  const isPodcast = message.message_type === "podcast"

  const senderLabel =
    message?.sender?.display_name ||
    message?.sender?.username ||
    (mine ? t("messageBubble.you") : t("messageBubble.sender"))
  const fallbackAuthor =
    message?.sender?.display_name ||
    message?.sender?.username ||
    message?.sender?.full_name ||
    (mine ? t("messageBubble.you") : t("messageBubble.sender"))

  const parseLegacySharedPost = (content) => {
    if (!content || typeof content !== "string") return null

    const postIdMatch = content.match(/Post\s*ID\s*:\s*([\w-]+)/i)
    const titleMatch = content.match(/Podcast\s*:\s*([^\n\r]+)/i)
    const captionMatch = content.match(/Ghi\s*chu\s*:\s*([^\n\r]+)/i)

    if (!postIdMatch) return null

    return {
      type: "podcast",
      post_id: postIdMatch[1],
      title: titleMatch?.[1]?.trim() || "Podcast",
      description: "",
      audio_url: "",
      thumbnail_url: "",
      duration_seconds: 0,
      author: fallbackAuthor,
      author_username: "",
      caption: captionMatch?.[1]?.trim() || "",
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      save_count: 0,
      __legacy: true,
    }
  }

  const handlePodcastClick = () => {
    if (!podcastData?.post_id) return

    const canonicalPostId = String(podcastData.post_id)

    if (isPostDeleted?.(canonicalPostId)) {
      toast.info('Bài viết đã bị xoá nên không thể mở.')
      return
    }
    if (isPostHidden?.(canonicalPostId)) {
      toast.info('Bài viết đã bị ẩn nên không thể mở.')
      return
    }

    window.dispatchEvent(
      new CustomEvent('open-post-detail', {
        detail: {
          postId: canonicalPostId,
          canonicalPostId,
          disableAutoScroll: true,
          source: 'chat-message',
          podcastPreview: {
            ...podcastData,
            sharedBy: message?.sender || null,
            shareCaption: podcastData.caption || '',
          },
        },
      })
    )
  }

  const handleProfileClick = () => {
    if (!profileTarget) return
    navigate(`/profile/${profileTarget}`)
  }

  // Parse podcast data on mount or when message changes
  React.useEffect(() => {
    if (!message.content) {
      setPodcastData(null)
      return
    }

    const looksLikeJson =
      typeof message.content === "string" &&
      message.content.trim().startsWith("{")

    if (isPodcast || looksLikeJson) {
      try {
        const data = JSON.parse(message.content)
        setPodcastData(data)
      } catch (err) {
        console.error("Failed to parse shared message data:", err)
        setPodcastData(null)
      }
      return
    }

    if (isText) {
      const legacyShared = parseLegacySharedPost(message.content)
      setPodcastData(legacyShared)
      return
    }

    setPodcastData(null)
  }, [message.content, isPodcast, isText])

  const isProfileShareMessage =
    Boolean(podcastData) &&
    podcastData.type === "profile" &&
    Boolean(
      podcastData.profile_user_id ||
      podcastData.user_id ||
      podcastData.username ||
      podcastData.profile_username
    )

  const isSharedPostMessage =
    Boolean(podcastData?.post_id) &&
    (isPodcast || isText) &&
    !isProfileShareMessage

  const profilePayload = podcastData?.profile || podcastData
  const profileUsername =
    profilePayload?.username ||
    podcastData?.profile_username ||
    profilePayload?.profile_username ||
    ""
  const profileDisplayName =
    profilePayload?.display_name ||
    profilePayload?.full_name ||
    profilePayload?.name ||
    profileUsername ||
    senderLabel
  const profileAvatar =
    profilePayload?.avatar_url ||
    profilePayload?.avatar ||
    profilePayload?.profile_image ||
    profilePayload?.image ||
    ""
  const profileBio = profilePayload?.bio || ""
  const profileCaption = profilePayload?.caption || podcastData?.caption || ""
  const profileTarget =
    profileUsername ||
    profilePayload?.profile_user_id ||
    profilePayload?.user_id ||
    podcastData?.profile_user_id ||
    podcastData?.user_id ||
    ""

  const sharedAuthor =
    typeof podcastData?.author === "object"
      ? podcastData.author?.name ||
      podcastData.author?.username ||
      senderLabel
      : podcastData?.author ||
      podcastData?.author_username ||
      senderLabel

  // Bài gốc bị tác giả xoá hoặc bị người dùng hiện tại ẩn → hiển thị placeholder thay vì card podcast.
  const sharedPostMissingReason = isSharedPostMessage
    ? isPostDeleted?.(String(podcastData.post_id))
      ? 'deleted'
      : isPostHidden?.(String(podcastData.post_id))
        ? 'hidden'
        : null
    : null
  const sharedPostMissing = sharedPostMissingReason !== null

  return (
    <>
      <div ref={containerRef} className={`message-row ${mine ? "mine" : ""}`}>
        {isText && !isSharedPostMessage && !isProfileShareMessage && (
          <div className="message-content-shell">
            <div className="message-bubble">
              <div className="message-text">{message.content}</div>
            </div>

            <div className="message-time">
              <Text className="message-time-text">{messageTimeLabel}</Text>
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
              <Text className="message-time-text">{messageTimeLabel}</Text>
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
              <Text className="message-time-text">{messageTimeLabel}</Text>
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
              <Text className="message-time-text">{messageTimeLabel}</Text>
            </div>
          </div>
        )}

        {isProfileShareMessage && profilePayload && (
          <div className={`message-podcast ${mine ? "mine" : ""}`}>
            <div className="shared-post-card shared-profile-card">
              {profileAvatar ? (
                <div
                  className="shared-profile-avatar-clickable"
                  onClick={handleProfileClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleProfileClick();
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <img
                    src={profileAvatar}
                    alt={profileDisplayName}
                    className="shared-profile-avatar"
                  />
                </div>
              ) : (
                <div
                  className="shared-profile-avatar shared-profile-avatar-placeholder shared-profile-avatar-clickable"
                  onClick={handleProfileClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleProfileClick();
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {getInitialsFromName(profileDisplayName)}
                </div>
              )}

              <div className="shared-post-main">
                <div className="shared-post-title" title={profileDisplayName}>
                  {profileDisplayName}
                </div>
                {profileUsername ? (
                  <div className="shared-post-author">@{profileUsername}</div>
                ) : null}
                {profileBio ? (
                  <div className="shared-post-caption" title={profileBio}>
                    {profileBio}
                  </div>
                ) : profileCaption ? (
                  <div className="shared-post-caption" title={profileCaption}>
                    {profileCaption}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="message-time message-podcast-time">
              <Text className="message-time-text">{messageTimeLabel}</Text>
            </div>
          </div>
        )}

        {isSharedPostMessage && podcastData && !sharedPostMissing && (
          <div className={`message-podcast ${mine ? "mine" : ""}`}>
            <button
              type="button"
              className={`shared-post-card ${podcastData.thumbnail_url ? "" : "shared-post-card-no-cover"
                }`}
              onClick={handlePodcastClick}
            >
              {podcastData.thumbnail_url ? (
                <img
                  src={podcastData.thumbnail_url}
                  alt={podcastData.title}
                  className="shared-post-cover"
                />
              ) : null}

              <div className="shared-post-main">
                <div
                  className="shared-post-title"
                  title={podcastData.title || "Podcast"}
                >
                  {podcastData.title || "Podcast"}
                </div>

                <div className="shared-post-author">
                  {sharedAuthor}
                </div>

                {podcastData.caption ? (
                  <div
                    className="shared-post-caption"
                    title={podcastData.caption}
                  >
                    {podcastData.caption}
                  </div>
                ) : null}
              </div>
            </button>

            <div className="message-time message-podcast-time">
              <Text className="message-time-text">{messageTimeLabel}</Text>
            </div>
          </div>
        )}

        {isSharedPostMessage && podcastData && sharedPostMissing && (
          <div className={`message-podcast message-podcast-missing ${mine ? "mine" : ""}`}>
            <div className="shared-post-card shared-post-card-missing">
              <div className="shared-post-missing-icon">
                {sharedPostMissingReason === 'hidden' ? (
                  <EyeOff size={22} />
                ) : (
                  <Ban size={22} />
                )}
              </div>
              <div className="shared-post-main">
                <div className="shared-post-title">
                  Bài viết không tồn tại
                </div>
                <div className="shared-post-author">
                  {sharedPostMissingReason === 'hidden'
                    ? 'Bài viết đã được ẩn khỏi danh sách của bạn.'
                    : 'Bài viết đã bị xoá hoặc không còn khả dụng.'}
                </div>
              </div>
            </div>

            <div className="message-time message-podcast-time">
              <Text className="message-time-text">{messageTimeLabel}</Text>
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
  )
}