import { Avatar, Space, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function ChatHeader({ peer }) {
  return (
    <div className="chat-header">
      <Space>
        <Avatar size={44} src={peer?.avatar_url} icon={<UserOutlined />} />

        <div>
          <Text strong className="chat-header-name">
            {peer?.display_name || peer?.username}
          </Text>

          <Text className="chat-header-status">
            <span className={`status-dot ${peer?.is_online ? "" : "offline"}`} />
            <span className="chat-header-status-label">
              {peer?.is_online ? "Online" : "Offline"}
            </span>
          </Text>
        </div>
      </Space>
    </div>
  );
}