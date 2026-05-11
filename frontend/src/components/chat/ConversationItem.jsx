import { Avatar, Badge, Typography, Button, Modal } from "antd";
import {
  DeleteOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { getMessagePreview, formatChatTime } from "../../utils/chat/chatHelpers";

const { Text } = Typography;

export default function ConversationItem({ item, active, onClick, onDelete }) {
  const peer = item.peer;
  const lastMessage = item.last_message;

  const handleDeleteConversation = (e) => {
    e.stopPropagation();

    Modal.confirm({
      title: "Xoá cuộc trò chuyện?",
      icon: <ExclamationCircleOutlined />,
      content: "Bạn có chắc muốn xoá cuộc trò chuyện này không?",
      okText: "Xoá",
      cancelText: "Huỷ",
      okButtonProps: {
        danger: true,
      },
      centered: true,
      onOk: async () => {
        await onDelete?.();
      },
    });
  };

  return (
    <div
      className={`conversation-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <div className="conversation-row">
        <div className="conversation-left">
          <div className="conversation-avatar-wrap">
            <Avatar icon={<UserOutlined />} src={peer?.avatar_url} />

            {!!item.unread_count && (
              <span className="conversation-unread-dot" />
            )}
          </div>

          <div className="conversation-content">
            <Text strong className="conversation-name">
              {peer?.display_name || peer?.username || "Unknown"}
            </Text>

            <Text className="conversation-preview">
              {getMessagePreview(lastMessage)}
            </Text>
          </div>
        </div>

        <div className="conversation-meta">
          {lastMessage?.created_at && (
            <Text className="conversation-time">
              {formatChatTime(lastMessage.created_at)}
            </Text>
          )}

          <Button
            className="conversation-delete-btn"
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={handleDeleteConversation}
          />

          {!!item.unread_count && (
            <div className="conversation-unread">
              <Badge count={item.unread_count} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}