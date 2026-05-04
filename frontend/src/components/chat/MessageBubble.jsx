import { useState } from "react";
import React, { useEffect } from "react";
import { Modal, Typography } from "antd";
import {
  DownloadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import ChatAudioPlayer from "./ChatAudioPlayer"
import CommentModal from "../feed/CommentModal"
import {
  formatFileSize,
  getFileExtension,
  getFileNameFromUrl,
} from "../../utils/chat/chatHelpers"

const { Text } = Typography;

function FileTypeIcon({ ext }) {
  if (ext === "pdf") return <FilePdfOutlined />;
  if (["doc", "docx"].includes(ext)) return <FileWordOutlined />;
  if (["txt", "md"].includes(ext)) return <FileTextOutlined />;
  return <FileOutlined />;
}

export default function MessageBubble({ message, containerRef }) {
  const mine = message.is_mine
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [podcastData, setPodcastData] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const timeLabel = dayjs(message.created_at).format("HH:mm");

  const fileName =
    message.original_filename || getFileNameFromUrl(message.attachment_url || "");
  const fileExt = getFileExtension(fileName);
  const fileSize = formatFileSize(message.file_size);

  const isText = message.message_type === "text"
  const isImage = message.message_type === "image"
  const isAudio = message.message_type === "audio"
  const isFile = message.message_type === "file"
  const isPodcast = message.message_type === "podcast"

  const handlePodcastClick = () => {
    if (podcastData) {
      setShowCommentModal(true)
    }
  }

  // Parse podcast data on mount or when message changes
  React.useEffect(() => {
    if (isPodcast && message.content) {
      try {
        const podcast = JSON.parse(message.content)
        setPodcastData(podcast)
      } catch (err) {
        console.error('Failed to parse podcast data:', err)
      }
    }
  }, [message.content, isPodcast])

  return (
    <>
      <div ref={containerRef} className={`message-row ${mine ? "mine" : ""}`}>
        {isText && (
          <div className="message-content-shell">
            <div className="message-bubble">
              <div className="message-text">{message.content}</div>
            </div>
            <div className="message-time">
              <Text className="message-time-text">{timeLabel}</Text>
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
              <Text className="message-time-text">{timeLabel}</Text>
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
              <Text className="message-time-text">{timeLabel}</Text>
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
              <Text className="message-time-text">{timeLabel}</Text>
            </div>
          </div>
        )}

        {isPodcast && podcastData && (
          <div className={`message-podcast ${mine ? "mine" : ""}`} onClick={handlePodcastClick} style={{ cursor: 'pointer', marginTop: 8 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: mine ? '#154' : '#0f1724',
              padding: '8px',
              borderRadius: 12,
              maxWidth: 320,
            }}>
              {podcastData.thumbnail_url ? (
                <img src={podcastData.thumbnail_url} alt={podcastData.title} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, marginRight: 10 }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: 8, background: '#222', marginRight: 10 }} />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{podcastData.title || 'Podcast'}</div>
                <div style={{ color: '#9aa', fontSize: 12, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{podcastData.author || 'Unknown'}</div>
                {podcastData.caption ? (
                  <div style={{ color: '#cdd', fontSize: 12, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {podcastData.caption}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="message-time" style={{ marginTop: 6 }}>
              <Text className="message-time-text">{timeLabel}</Text>
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
            author: podcastData.author || 'Unknown',
            authorUsername: podcastData.author || '',
            cover: podcastData.thumbnail_url || '',
            thumbnail_url: podcastData.thumbnail_url || '',
            audio_url: podcastData.audio_url || '',
            audioUrl: podcastData.audio_url || '',
            duration_seconds: podcastData.duration_seconds || 0,
            durationSeconds: podcastData.duration_seconds || 0,
            isOwner: false,
          }}
          liked={false}
          saved={false}
          likeCount={0}
          shareCount={0}
          saveCount={0}
          commentCount={0}
          onClose={() => setShowCommentModal(false)}
          disableAutoScroll={true}
        />
      )}
    </>
  )
}