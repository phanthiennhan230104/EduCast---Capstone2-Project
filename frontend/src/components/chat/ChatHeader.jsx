import { Avatar, Button, Space, Typography } from "antd";
import { InfoCircleOutlined, UserOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

const { Text } = Typography;

export default function ChatHeader({ peer, onToggleInfoPanel, rightPanelOpen }) {
  const { t } = useTranslation();
  return (
    <div className="chat-header">
      <div className="chat-header-inner">
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

        <Button
          type="text"
          shape="circle"
          className="chat-header-info-btn"
          icon={<InfoCircleOutlined />}
          onClick={onToggleInfoPanel}
          aria-label={
  rightPanelOpen
    ? t("chat.hideConversationInfo")
    : t("chat.showConversationInfo")
}
        />
      </div>
    </div>
  );
}