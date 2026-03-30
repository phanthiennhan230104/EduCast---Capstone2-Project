import { useMemo, useState } from "react";
import { Empty, Modal, Tabs, Typography } from "antd";
import {
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
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

function HistoryList({ type, items, onJumpToMessage, onPreviewImage }) {
  if (!items.length) {
    return (
      <Empty
        description="Chưa có dữ liệu"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div className="chat-history-list">
      {items.map((item) => {
        const fileName =
          item.original_filename || getFileNameFromUrl(item.attachment_url || "");
        const fileExt = getFileExtension(fileName);
        const fileSize = formatFileSize(item.file_size);

        return (
          <button
            key={item.id}
            type="button"
            className="chat-history-item"
            onClick={() => {
              if (type === "image") {
                onPreviewImage(item.attachment_url);
              }
              onJumpToMessage(item.id);
            }}
          >
            <div className="chat-history-thumb">
              {type === "image" ? (
                <img src={item.attachment_url} alt={fileName} />
              ) : type === "audio" ? (
                <div className="chat-history-thumb-icon audio">
                  <PlayCircleOutlined />
                </div>
              ) : (
                <div className="chat-history-thumb-icon file">
                  <FileTypeIcon ext={fileExt} />
                </div>
              )}
            </div>

            <div className="chat-history-info">
              <div className="chat-history-name" title={fileName}>
                {type === "audio" ? fileName || "Audio" : fileName}
              </div>

              <div className="chat-history-meta">
                <span>{dayjs(item.created_at).format("DD/MM • HH:mm")}</span>
                {type === "file" && (fileSize || fileExt.toUpperCase()) ? (
                  <span>{fileSize || fileExt.toUpperCase()}</span>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function ChatHistoryPanel({ messages, onJumpToMessage }) {
  const [previewImage, setPreviewImage] = useState(null);

  const imageItems = useMemo(
    () =>
      messages
        .filter((item) => item.message_type === "image" && item.attachment_url)
        .slice()
        .reverse(),
    [messages]
  );

  const audioItems = useMemo(
    () =>
      messages
        .filter((item) => item.message_type === "audio" && item.attachment_url)
        .slice()
        .reverse(),
    [messages]
  );

  const fileItems = useMemo(
    () =>
      messages
        .filter((item) => item.message_type === "file" && item.attachment_url)
        .slice()
        .reverse(),
    [messages]
  );

  return (
    <>
      <div className="chat-history-panel">
        <div className="chat-history-header">
          <Text strong className="chat-history-title">
            Lịch sử chia sẻ
          </Text>
          <Text className="chat-history-subtitle">
            Ảnh, audio và file trong cuộc trò chuyện này
          </Text>
        </div>

        <Tabs
          className="chat-history-tabs"
          defaultActiveKey="images"
          items={[
            {
              key: "images",
              label: "Ảnh",
              children: (
                <HistoryList
                  type="image"
                  items={imageItems}
                  onJumpToMessage={onJumpToMessage}
                  onPreviewImage={setPreviewImage}
                />
              ),
            },
            {
              key: "audio",
              label: "Audio",
              children: (
                <HistoryList
                  type="audio"
                  items={audioItems}
                  onJumpToMessage={onJumpToMessage}
                  onPreviewImage={setPreviewImage}
                />
              ),
            },
            {
              key: "files",
              label: "File",
              children: (
                <HistoryList
                  type="file"
                  items={fileItems}
                  onJumpToMessage={onJumpToMessage}
                  onPreviewImage={setPreviewImage}
                />
              ),
            },
          ]}
        />
      </div>

      <Modal
        open={!!previewImage}
        footer={null}
        onCancel={() => setPreviewImage(null)}
        centered
        width="auto"
        className="image-preview-modal"
      >
        <img
          src={previewImage || ""}
          alt="preview"
          className="image-preview-modal-img"
        />
      </Modal>
    </>
  );
}