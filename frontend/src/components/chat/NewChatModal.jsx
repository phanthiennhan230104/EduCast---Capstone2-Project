import { useEffect, useMemo, useState } from "react";
import { Avatar, Modal } from "antd";
import { MessageOutlined, SearchOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { toast } from "react-toastify";
import { searchChatUsers } from "../../utils/chatApi";
import { useTranslation } from "react-i18next";
import "../../style/chat/new-chat-modal.css";

export default function NewChatModal({ open, onClose, onSelectUser, conversations = [] }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = async (value) => {
    try {
      setLoading(true);
      const data = await searchChatUsers(value);
      setUsers(data);
    } catch (error) {
      toast.error(error.message || t("newChatModal.searchUserFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchValue(val);
    if (!val) handleSearch("");
  };

  const handleClear = () => {
    setSearchValue("");
    handleSearch("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch(searchValue);
  };

  useEffect(() => {
    if (open) {
      setSearchValue("");
      handleSearch("");
    }
  }, [open]);

  const existingPeerIds = useMemo(
    () => new Set(conversations.map((c) => String(c.peer?.id)).filter(Boolean)),
    [conversations]
  );

  const newFriends = useMemo(
    () => users.filter((u) => !existingPeerIds.has(String(u.id))),
    [users, existingPeerIds]
  );
  const existingFriends = useMemo(
    () => users.filter((u) => existingPeerIds.has(String(u.id))),
    [users, existingPeerIds]
  );

  const renderItem = (user, hasRoom) => (
    <div
      key={user.id}
      className={`ncm-friend-item ${hasRoom ? "ncm-friend-item--existing" : ""}`}
      onClick={() => onSelectUser(user)}
    >
      <div className="ncm-avatar-wrap">
        <Avatar
          size={44}
          src={user.avatar_url}
          icon={<UserOutlined />}
          className="ncm-avatar"
        />
        {hasRoom && <span className="ncm-room-dot" />}
      </div>

      <div className="ncm-friend-info">
        <span className="ncm-friend-name">{user.display_name || user.username}</span>
        <span className={`ncm-friend-sub ${hasRoom ? "ncm-friend-sub--green" : ""}`}>
          {hasRoom
            ? t("newChatModal.existingRoom", "Nhấn để mở cuộc trò chuyện")
            : user.email}
        </span>
      </div>

      <div className={`ncm-friend-action ${hasRoom ? "ncm-friend-action--open" : ""}`}>
        {hasRoom ? <MessageOutlined /> : <span className="ncm-plus-icon">+</span>}
      </div>
    </div>
  );

  const hasAnyFriend = newFriends.length > 0 || existingFriends.length > 0;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={null}
      className="ncm-modal"
      styles={{ content: { padding: 0 } }}
    >
      {/* Header */}
      <div className="ncm-header">
        <div className="ncm-header-icon">
          <TeamOutlined />
        </div>
        <div className="ncm-header-title">
          {t("newChatModal.title", "Tin nhắn mới")}
        </div>
      </div>

      {/* Search */}
      <div className="ncm-search-wrap">
        <div className="ncm-search-box">
          <span className="ncm-search-icon">
            <SearchOutlined />
          </span>
          <input
            className="ncm-search-input"
            type="text"
            placeholder={t("newChatModal.searchPlaceholder", "Tìm theo username hoặc email")}
            value={searchValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          {searchValue && (
            <button className="ncm-search-clear" onClick={handleClear} type="button">
              ×
            </button>
          )}
          <button
            className="ncm-search-btn"
            onClick={() => handleSearch(searchValue)}
            type="button"
            disabled={loading}
          >
            {loading ? (
              <span className="ncm-search-spinner" />
            ) : (
              <SearchOutlined />
            )}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="ncm-list-wrap">
        {loading && users.length === 0 ? (
          <div className="ncm-skeleton-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ncm-skeleton-item">
                <div className="ncm-skeleton-avatar" />
                <div className="ncm-skeleton-lines">
                  <div className="ncm-skeleton-line ncm-skeleton-line--name" />
                  <div className="ncm-skeleton-line ncm-skeleton-line--sub" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasAnyFriend ? (
          <div className="ncm-empty">
            <div className="ncm-empty-icon">
              <TeamOutlined />
            </div>
            <div className="ncm-empty-title">Chưa có bạn bè nào</div>
            <div className="ncm-empty-sub">
              {t(
                "newChatModal.noFriends",
                "Hãy follow lẫn nhau để bắt đầu trò chuyện!"
              )}
            </div>
          </div>
        ) : (
          <>
            {newFriends.length > 0 && (
              <div className="ncm-section">
                {existingFriends.length > 0 && (
                  <div className="ncm-section-label">Bắt đầu trò chuyện mới</div>
                )}
                {newFriends.map((u) => renderItem(u, false))}
              </div>
            )}

            {existingFriends.length > 0 && (
              <div className="ncm-section">
                <div className="ncm-section-label">
                  {t("newChatModal.existingChats", "Đã có cuộc trò chuyện")}
                </div>
                {existingFriends.map((u) => renderItem(u, true))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}