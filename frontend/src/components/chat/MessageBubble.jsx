import { useState } from "react";
import React from "react";
import { Modal, Typography } from "antd";
import {
  DownloadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
} from "@ant-design/icons";
import ChatAudioPlayer from "./ChatAudioPlayer"
import CommentModal from "../feed/CommentModal"
import {
  formatFileSize,
  getFileExtension,
  getFileNameFromUrl,
  formatChatTime,
} from "../../utils/chat/chatHelpers"


const { Text } = Typography;

function FileTypeIcon({ ext }) {
  if (ext === "pdf") return <FilePdfOutlined />;
  if (["doc", "docx"].includes(ext)) return <FileWordOutlined />;
  if (["txt", "md"].includes(ext)) return <FileTextOutlined />;
  return <FileOutlined />;
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Vừa xong'

  const created = new Date(dateString)
  const now = new Date()
  const diffMs = now - created
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  return `${diffDays} ngày trước`
}

export default function MessageBubble({ message, containerRef }) {
  const mine = message.is_mine
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [podcastData, setPodcastData] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const messageTimeLabel = formatChatTime(message.created_at);

  const fileName =
    message.original_filename || getFileNameFromUrl(message.attachment_url || "");
  const fileExt = getFileExtension(fileName);
  const fileSize = formatFileSize(message.file_size);

  const isText = message.message_type === "text"
  const isImage = message.message_type === "image"
  const isAudio = message.message_type === "audio"
  const isFile = message.message_type === "file"
  const isPodcast = message.message_type === "podcast"
  const senderLabel =
    message?.sender?.display_name ||
    message?.sender?.username ||
    (mine ? "Ban" : "Nguoi gui")
  const fallbackAuthor =
    message?.sender?.display_name ||
    message?.sender?.username ||
    message?.sender?.full_name ||
    (mine ? "Ban" : "Nguoi gui")

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
    if (podcastData) {
      setShowCommentModal(true)
    }
  }

  // Parse podcast data on mount or when message changes
  React.useEffect(() => {
    if (!message.content) {
      setPodcastData(null)
      return
    }

    const looksLikeJson = typeof message.content === 'string' && message.content.trim().startsWith('{')

    if (isPodcast || looksLikeJson) {
      try {
        const podcast = JSON.parse(message.content)
        setPodcastData(podcast)
      } catch (err) {
        console.error('Failed to parse podcast data:', err)
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

  const isSharedPostMessage = Boolean(podcastData?.post_id) && (isPodcast || isText)
  const sharedAuthor =
  typeof podcastData?.author === 'object'
    ? podcastData.author?.name ||
      podcastData.author?.username ||
      senderLabel
    : podcastData?.author ||
      podcastData?.author_username ||
      senderLabel

  return (
    <>
      <div ref={containerRef} className={`message-row ${mine ? "mine" : ""}`}>
        {isText && !isSharedPostMessage && (
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

        {isSharedPostMessage && podcastData && (
          <div className={`message-podcast ${mine ? "mine" : ""}`}>
            <button
              type="button"
              className={`shared-post-card ${podcastData.thumbnail_url ? "" : "shared-post-card-no-cover"}`}
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
                <div className="shared-post-title" title={podcastData.title || "Podcast"}>
                  {podcastData.title || "Podcast"}
                </div>
                <div className="shared-post-author">
                  {sharedAuthor}
                </div>

                {podcastData.caption ? (
                  <div className="shared-post-caption" title={podcastData.caption}>
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

      {showCommentModal && podcastData && (
        <CommentModal
          podcast={{
            id: podcastData.post_id,
            postId: podcastData.post_id,
            title: podcastData.title,
            description: podcastData.description,
            author: podcastData.author || sharedAuthor,
            author_avatar:
              typeof podcastData?.author === 'object'
                ? podcastData.author?.avatar_url || ''
                : '',
            authorUsername:
              typeof podcastData?.author === 'object'
                ? podcastData.author?.username || ''
                : podcastData.author_username || sharedAuthor || '',
            cover: podcastData.thumbnail_url || '',
            thumbnail_url: podcastData.thumbnail_url || '',
            audio_url: podcastData.audio_url || '',
            audioUrl: podcastData.audio_url || '',
            duration_seconds: podcastData.duration_seconds || 0,
            durationSeconds: podcastData.duration_seconds || 0,
            created_at: podcastData.created_at || message.created_at,
            timeAgo: podcastData.created_at ? formatTimeAgo(podcastData.created_at) : undefined,
            isOwner: false,
          }}
          liked={false}
          saved={false}
          likeCount={Number(podcastData.like_count || 0)}
          shareCount={Number(podcastData.share_count || 0)}
          saveCount={Number(podcastData.save_count || 0)}
          commentCount={Number(podcastData.comment_count || 0)}
          onClose={() => setShowCommentModal(false)}
          disableAutoScroll={true}
        />
      )}
    </>
  )
}