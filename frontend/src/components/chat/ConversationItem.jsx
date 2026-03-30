import { Avatar, Badge, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { getMessagePreview } from "../../utils/chat/chatHelpers";

const { Text } = Typography;

export default function ConversationItem({ item, active, onClick }) {
  const peer = item.peer;
  const lastMessage = item.last_message;

  return (
    <div
      className={`conversation-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <div className="conversation-row">
        <div className="conversation-left">
          <div className="conversation-avatar-wrap">
            <Avatar icon={<UserOutlined />} src={peer?.avatar_url} />
            {!!item.unread_count && <span className="conversation-unread-dot" />}
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
              {dayjs(lastMessage.created_at).format("HH:mm")}
            </Text>
          )}

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