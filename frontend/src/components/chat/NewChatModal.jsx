import { useEffect, useState } from "react";
import { Avatar, Input, List, Modal } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { toast } from "react-toastify";
import { searchChatUsers } from "../../utils/chatApi";
import { useTranslation } from "react-i18next";

const { Search } = Input;

export default function NewChatModal({ open, onClose, onSelectUser }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

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

  useEffect(() => {
    if (open) handleSearch("");
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={t("newChatModal.title")}
    >
      <Search
        placeholder={t("newChatModal.searchPlaceholder")}
        onSearch={handleSearch}
        allowClear
        enterButton
      />

      <div style={{ marginTop: 16 }}>
        <List
          loading={loading}
          dataSource={users}
          renderItem={(user) => (
            <List.Item
              style={{ cursor: "pointer" }}
              onClick={() => onSelectUser(user)}
            >
              <List.Item.Meta
                avatar={<Avatar src={user.avatar_url} icon={<UserOutlined />} />}
                title={user.display_name || user.username}
                description={user.email}
              />
            </List.Item>
          )}
        />
      </div>
    </Modal>
  );
}