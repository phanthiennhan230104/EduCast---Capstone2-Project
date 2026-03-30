import { useState } from "react";
import { Modal, Typography } from "antd";
import {
  DownloadOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import ChatAudioPlayer from "./ChatAudioPlayer";
import {
  formatFileSize,
  getFileExtension,
  getFileNameFromUrl,
} from "../../utils/chat/chatHelpers";

const { Text } = Typography;

function FileTypeIcon({ ext }) {
  if (ext === "pdf") return <FilePdfOutlined />;
  if (["doc", "docx"].includes(ext)) return <FileWordOutlined />;
  if (["txt", "md"].includes(ext)) return <FileTextOutlined />;
  return <FileOutlined />;
}

export default function MessageBubble({ message, containerRef }) {
  const mine = message.is_mine;
  const [previewOpen, setPreviewOpen] = useState(false);
  const timeLabel = dayjs(message.created_at).format("HH:mm");

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