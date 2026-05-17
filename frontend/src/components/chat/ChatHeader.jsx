import { Avatar, Button, Space, Typography } from "antd";
import { InfoCircleOutlined, UserOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const { Text } = Typography;

export default function ChatHeader({ peer, onToggleInfoPanel, rightPanelOpen, onBack }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openPeerProfile = () => {
    if (!peer?.id) return;
    navigate(`/profile/${peer.id}`);
  };

  return (
    <div className="chat-header">
      <div className="chat-header-inner">
        <Space
          className="chat-header-profile-link"
        >
          {onBack && (
            <Button
              type="text"
              shape="circle"
              className="chat-header-back-btn"
              icon={<ArrowLeftOutlined />}
              onClick={onBack}
              aria-label="Back"
            />
          )}
          <Avatar 
            size={44} 
            src={peer?.avatar_url} 
            icon={<UserOutlined />} 
            style={{ cursor: peer?.id ? "pointer" : "default" }}
            role={peer?.id ? "button" : undefined}
            tabIndex={peer?.id ? 0 : undefined}
            onClick={openPeerProfile}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && peer?.id) {
                event.preventDefault();
                openPeerProfile();
              }
            }}
          />

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
