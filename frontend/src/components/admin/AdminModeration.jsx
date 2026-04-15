import { Search, Mic, Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import "../../style/admin/admin-moderation-page.css";

function formatSubtitle() {
  const today = new Date();
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = days[today.getDay()];
  const date = String(today.getDate()).padStart(2, "0");
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  return `EduCast · ${dayName}, ${date} tháng ${month}, ${year}`;
}

const moderationData = [
  {
    id: 1,
    title: "Học lập trình Python cơ bản",
    author: "Minh Hoàng",
    createdAt: "16-22",
    reportCount: 12,
    duration: "2 phút trước",
    reason: "Spam",
    status: "pending",
  },
  {
    id: 2,
    title: "Tài chính cá nhân cho sinh viên",
    author: "Túi Mơ",
    createdAt: "18-30",
    reportCount: 10,
    duration: "1 giờ trước",
    reason: "Nội dung gây hiểu lầm",
    status: "pending",
  },
  {
    id: 3,
    title: "English Speaking Practice #5",
    author: "Tiên Tiên",
    createdAt: "09-40",
    reportCount: 12,
    duration: "2 giờ trước",
    reason: "Chất lượng thấp",
    status: "active",
  },
  {
    id: 4,
    title: "Kỹ năng thuyết trình hiệu quả",
    author: "Thiên Nhân",
    createdAt: "20-35",
    reportCount: 12,
    duration: "3 giờ trước",
    reason: "Báo cáo sai",
    status: "pending",
  },
  {
    id: 5,
    title: "AI & Machine Learning 101",
    author: "Nguyễn Bắc",
    createdAt: "18-40",
    reportCount: 12,
    duration: "5 giờ trước",
    reason: "Nội dung nhạy cảm",
    status: "processed",
  },
];

const tabs = [
  { key: "all", label: "Tất cả (5)" },
  { key: "pending", label: "Chờ duyệt (3)" },
  { key: "active", label: "Đang xét (1)" },
  { key: "processed", label: "Đã xử lý (1)" },
];

function getStatusMeta(status) {
  switch (status) {
    case "active":
      return { label: "Đang xét", className: "active" };
    case "processed":
      return { label: "Đã xử lý", className: "processed" };
    default:
      return { label: "Chờ duyệt", className: "pending" };
  }
}

export default function AdminContentModerationPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState(1);

  const filteredItems = useMemo(() => {
    return moderationData.filter((item) => {
      const matchTab = activeTab === "all" ? true : item.status === activeTab;
      const matchKeyword =
        item.title.toLowerCase().includes(keyword.toLowerCase()) ||
        item.author.toLowerCase().includes(keyword.toLowerCase());
      return matchTab && matchKeyword;
    });
  }, [activeTab, keyword]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedId) || filteredItems[0] || moderationData[0];

  return (
    <AdminLayout
      title="KIỂM DUYỆT NỘI DUNG"
      subtitle={formatSubtitle()}
      onlineUsers={1255}
    >
      <div className="admin-moderation-page">
        <div className="admin-moderation-toolbar">
          <div className="admin-moderation-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`admin-moderation-tab ${activeTab === tab.key ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="admin-moderation-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>
        </div>

        <div className="admin-moderation-content">
          <section className="admin-moderation-list">
            {filteredItems.map((item) => {
              const statusMeta = getStatusMeta(item.status);

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-moderation-item ${selectedItem?.id === item.id ? "is-selected" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="admin-moderation-item-left">
                    <div className="admin-moderation-item-icon">
                      <Mic size={15} />
                    </div>

                    <div className="admin-moderation-item-body">
                      <div className="admin-moderation-item-title">{item.title}</div>
                      <div className="admin-moderation-item-meta">
                        bởi {item.author} · {item.createdAt} · {item.duration}
                      </div>
                    </div>
                  </div>

                  <div className="admin-moderation-item-right">
                    <div className="admin-report-badge">⚠ {item.reportCount} báo cáo</div>
                    <div className={`admin-status-badge ${statusMeta.className}`}>
                      {statusMeta.label}
                    </div>
                  </div>
                </button>
              );
            })}
          </section>

          <aside className="admin-moderation-detail">
            <div className="admin-moderation-detail-title">CHI TIẾT BÁO CÁO</div>

            <div className="admin-moderation-detail-card">
              <h3>{selectedItem?.title}</h3>

              <div className="admin-moderation-detail-grid">
                <span>Tác giả</span>
                <strong>{selectedItem?.author}</strong>

                <span>Nhóm Tuổi</span>
                <strong>{selectedItem?.createdAt}</strong>

                <span>Số Lần Báo Cáo</span>
                <strong>{selectedItem?.reportCount} lần</strong>

                <span>Lý Do</span>
                <strong>{selectedItem?.reason}</strong>

                <span>Thời Gian</span>
                <strong>{selectedItem?.duration}</strong>

                <span>Trạng Thái</span>
                <strong>Chờ duyệt</strong>
              </div>

              <div className="admin-moderation-actions">
                <button type="button" className="admin-action-btn approve">
                  <Check size={16} /> Đánh dấu đã xử lý
                </button>

                <button type="button" className="admin-action-btn reject">
                  <X size={16} /> Xóa nội dung
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}