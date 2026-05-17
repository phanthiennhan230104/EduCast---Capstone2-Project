import { Search, Mic, AlertCircle, Lock, X, Volume2, Unlock, Play, Pause } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useAudioPlayer } from "../contexts/AudioPlayerContext";
import { API_ORIGIN } from "../../config/apiBase";
import AdminLayout from "./AdminLayout";
import "../../style/admin/admin-moderation-page.css";
import {
  getAdminReports,
  getAdminOverview,
  lockPostWithReport,
  rejectReportWithPublish,
  updateReportStatus,
  openPost,
} from "../../utils/adminApi";
import notify from "../../utils/toast";


function formatSubtitle() {
  const today = new Date();
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayName = days[today.getDay()];
  const date = String(today.getDate()).padStart(2, "0");
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  return `EduCast · ${dayName}, ${date} tháng ${month}, ${year}`;
}

function getReasonLabel(reason) {
  const reasons = {
    'spam': 'Spam',
    'inappropriate_content': 'Nội dung không phù hợp',
    'harassment': 'Quấy rối',
    'misinformation': 'Thông tin sai lệch',
    'copyright': 'Vi phạm bản quyền',
    'other': 'Khác'
  };
  return reasons[reason] || reason;
}

function getReportStatusBadge(status) {
  const statuses = {
    'pending': { label: 'Chờ duyệt', className: 'pending' },
    'reviewed': { label: 'Đã xem xét', className: 'reviewed' },
    'resolved': { label: 'Đã xử lý', className: 'resolved' },
    'rejected': { label: 'Đã từ chối', className: 'rejected' }
  };
  return statuses[status] || { label: status, className: 'pending' };
}

function getPostStatusLabel(status) {
  const statuses = {
    'processing': 'Chờ duyệt',
    'published': 'Đã đăng',
    'hidden': 'Ẩn',
    'draft': 'Bản nháp',
    'failed': 'Bị từ chối'
  };
  return statuses[status] || status;
}

function formatAudioTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getFullAudioUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('blob:')) return raw;
  if (raw.startsWith('//')) return `${window.location.protocol}${raw}`;
  if (raw.startsWith('/')) return `${API_ORIGIN}${raw}`;
  return `${API_ORIGIN}/${raw}`;
}

function getTrackProgressKey(track) {
  if (!track) return null;
  if (track.audioId) return `audio:${track.audioId}`;
  if (track.audio_id) return `audio:${track.audio_id}`;
  if (track.id && track.audioUrl) return `track:${track.id}:${track.audioUrl}`;
  if (track.audioUrl) return `url:${track.audioUrl}`;
  if (track.id) return `track:${track.id}`;
  return null;
}

function AdminAudioPlayer({ post }) {
  const progressBarRef = useRef(null);
  const {
    playTrack,
    currentTrack,
    playing,
    togglePlay,
    currentTime,
    trackProgressMap,
    seekToPercent,
  } = useAudioPlayer();

  const audioUrl = post?.audio_url || '';
  const fullUrl = getFullAudioUrl(audioUrl);

  // Create a temporary track object to get the correct progress key
  const tempTrack = { id: post?.id, audioUrl: fullUrl };
  const trackKey = getTrackProgressKey(tempTrack);

  const isThisTrack = currentTrack?.audioUrl === fullUrl;
  const isPlaying = isThisTrack && playing;

  const progress = isThisTrack ? trackProgressMap[trackKey]?.progressPercent || 0 : 0;
  const displayTime = isThisTrack ? currentTime : 0;
  const displayDuration = isThisTrack
    ? (trackProgressMap[trackKey]?.duration || post?.duration_seconds || 0)
    : (post?.duration_seconds || 0);

  const handlePlayPause = (e) => {
    e.stopPropagation();
    if (isThisTrack) {
      togglePlay();
    } else {
      playTrack({
        ...post,
        audioUrl: fullUrl,
        title: post.title || 'Admin Preview'
      });
    }
  };

  const handleProgressClick = (e) => {
    e.stopPropagation();
    if (!isThisTrack) return;
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    seekToPercent(percent);
  };

  return (
    <div className="admin-audio-player-custom">
      <button
        className={`admin-audio-play-btn ${isPlaying ? 'playing' : ''}`}
        onClick={handlePlayPause}
        type="button"
      >
        {isPlaying ? (
          <Pause size={18} fill="currentColor" />
        ) : (
          <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />
        )}
      </button>

      <div className="admin-audio-info">
        <span className="admin-audio-time">{formatAudioTime(displayTime)}</span>
        <div
          className="admin-audio-progress-container"
          ref={progressBarRef}
          onClick={handleProgressClick}
        >
          <div className="admin-audio-progress-bg" />
          <div
            className="admin-audio-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="admin-audio-duration">{formatAudioTime(displayDuration)}</span>
      </div>
    </div>
  );
}

export default function AdminContentModerationPage() {
  const [onlineUsers, setOnlineUsers] = useState(0);
  const [reports, setReports] = useState([]);
  const [reportCounts, setReportCounts] = useState({});
  const [filteredReports, setFilteredReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [updatingReportId, setUpdatingReportId] = useState(null);
  const [audioTime, setAudioTime] = useState({});
  const [selectedAudioVersion, setSelectedAudioVersion] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const audioRefs = {};

  // Fetch reports on component mount
  useEffect(() => {
    fetchReports();

    const handleAdminUpdate = (event) => {
      console.log(" Admin update received in AdminModeration:", event.detail);
      const { type } = event.detail || {};
      if (type === "post_change" || type === "new_post") {
        fetchReports();
      }
    };

    window.addEventListener("admin-update", handleAdminUpdate);
    return () => {
      window.removeEventListener("admin-update", handleAdminUpdate);
    };
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);

      const [reportsResponse, overviewResponse] = await Promise.all([
        getAdminReports({ page_size: 100 }),
        getAdminOverview(),
      ]);

      const overview = overviewResponse?.overview || overviewResponse?.data?.overview;
      setOnlineUsers(overview?.users?.active_users || 0);

      const reportsData = reportsResponse.reports || [];
      setReports(reportsData);
      setReportCounts(reportsResponse.counts || {});

      if (reportsData.length > 0) {
        setSelectedReportId(reportsData[0].id);
      }

      setError(null);
    } catch (err) {
      setError(err.message || "Lỗi khi tải dữ liệu");
      console.error("Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter reports based on tab and search
  useEffect(() => {
    let filtered = reports;

    // Filter by report status tab
    if (activeTab === 'pending') {
      filtered = filtered.filter(report => report.status === 'pending');
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter(report =>
        report.status === 'resolved' || report.status === 'rejected'
      );
    }

    // Filter by keyword
    if (keyword) {
      filtered = filtered.filter(report => {
        const postTitle = report.post?.title || '';
        const postAuthor = report.post?.author_username || '';
        const reportReason = report.reason || '';
        const reporterName = report.reporter_username || '';

        return (
          postTitle.toLowerCase().includes(keyword.toLowerCase()) ||
          postAuthor.toLowerCase().includes(keyword.toLowerCase()) ||
          reportReason.toLowerCase().includes(keyword.toLowerCase()) ||
          reporterName.toLowerCase().includes(keyword.toLowerCase())
        );
      });
    }

    // Sort: pending first, then by created_at descending
    filtered = filtered.sort((a, b) => {
      const aPending = a.status === 'pending' ? 0 : 1;
      const bPending = b.status === 'pending' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    setFilteredReports(filtered);
    setCurrentPage(1); // Reset to page 1 when filter changes
  }, [reports, activeTab, keyword]);

  // Paginate filtered reports
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedReports = filteredReports.slice(startIdx, endIdx);

  const tabs = [
    { key: "all", label: `Tất cả (${reportCounts.total || 0})` },
    { key: "pending", label: `Chờ duyệt (${reportCounts.pending || 0})` },
    { key: "resolved", label: `Đã xử lý (${(reportCounts.resolved || 0) + (reportCounts.rejected || 0)})` },
  ];

  const selectedReport = filteredReports.find(item => item.id === selectedReportId) || filteredReports[0];
  const selectedPost = selectedReport?.post;

  const handleUpdateReportStatus = async (reportId, newStatus, postId) => {
    if (!selectedReport) return;
    try {
      setUpdatingReportId(reportId);

      let actionMessage = '';
      if (newStatus === 'resolved') {
        // Lock post and resolve report
        await lockPostWithReport(postId, reportId);
        actionMessage = 'Đã khóa bài đăng thành công!';
      } else if (newStatus === 'rejected') {
        // Publish post and reject report
        await rejectReportWithPublish(postId, reportId);
        actionMessage = 'Đã từ chối báo cáo thành công!';
      } else {
        // Just update report status
        await updateReportStatus(reportId, newStatus);
        actionMessage = 'Đã cập nhật báo cáo thành công!';
      }

      await fetchReports();
      notify.success(actionMessage);
    } catch (err) {
      console.error('Error updating report status:', err);
      notify.error(err.message || 'Lỗi khi cập nhật báo cáo!');
    } finally {
      setUpdatingReportId(null);
    }
  };

  const handleOpenPost = async (postId) => {
    try {
      setUpdatingReportId(postId);
      await openPost(postId);
      await fetchReports();
      notify.success('Đã mở bài đăng thành công!');
    } catch (err) {
      console.error('Error opening post:', err);
      notify.error(err.message || 'Lỗi khi mở bài đăng!');
    } finally {
      setUpdatingReportId(null);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <AdminLayout title="KIỂM DUYỆT BÁO CÁO" subtitle={formatSubtitle()}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Đang tải dữ liệu...
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="KIỂM DUYỆT BÁO CÁO" subtitle={formatSubtitle()}>
        <div style={{ padding: '40px', textAlign: 'center', color: '#e74c3c' }}>
          {error}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="KIỂM DUYỆT BÁO CÁO"
      subtitle={formatSubtitle()}
      onlineUsers={onlineUsers}
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
            {paginatedReports.length === 0 && filteredReports.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                Không có báo cáo nào
              </div>
            ) : (
              <>
                {paginatedReports.map((report) => {
                  const createdDate = new Date(report.created_at);
                  const now = new Date();
                  const diffMs = now - createdDate;
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMs / 3600000);
                  const diffDays = Math.floor(diffMs / 86400000);

                  let timeStr;
                  if (diffMins < 60) {
                    timeStr = `${diffMins} phút trước`;
                  } else if (diffHours < 24) {
                    timeStr = `${diffHours} giờ trước`;
                  } else {
                    timeStr = `${diffDays} ngày trước`;
                  }

                  const postTitle = report.post?.title || 'Bài đăng không tồn tại';
                  const postAuthor = report.post?.author_username || 'Unknown';
                  const statusBadge = getReportStatusBadge(report.status);

                  return (
                    <button
                      key={report.id}
                      type="button"
                      className={`admin-moderation-item ${selectedReport?.id === report.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedReportId(report.id)}
                    >
                      <div className="admin-moderation-item-left">
                        <div className="admin-moderation-item-icon">
                          <AlertCircle size={15} />
                        </div>

                        <div className="admin-moderation-item-body">
                          <div className="admin-moderation-item-title">{postTitle}</div>
                          <div className="admin-moderation-item-meta">
                            {getReasonLabel(report.reason)} · bởi {postAuthor} · {timeStr}
                          </div>
                        </div>
                      </div>

                      <div className="admin-moderation-item-right">
                        <div className="admin-report-count">
                          <AlertCircle size={14} />
                          {getReasonLabel(report.reason)}
                        </div>
                        <div className={`admin-pending-badge ${statusBadge.className}`}>
                          {statusBadge.label}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {totalPages > 0 && (
                  <div className="admin-moderation-pagination">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        className={`pagination-btn ${currentPage === page ? 'is-active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="admin-moderation-detail">
            <div className="admin-moderation-detail-title">CHI TIẾT BÀI VIẾT & BÁO CÁO</div>

            {selectedReport ? (
              <div className="admin-moderation-detail-card">
                {selectedPost ? (
                  <>
                    <h3>{selectedPost.title}</h3>

                    <div className="admin-moderation-detail-grid">
                      <span>Tác giả </span>
                      <strong>{selectedPost.author_username}</strong>

                      <span>Trạng thái</span>
                      <strong>{getPostStatusLabel(selectedPost.status)}</strong>

                      <span>Mô Tả</span>
                      <strong>{selectedPost.description || 'Không có'}</strong>
                    </div>

                    {selectedPost.audio_url && (
                      <div className="admin-moderation-audio-player">
                        <div className="admin-moderation-audio-header">
                          <Volume2 size={16} />
                          <span>Nghe audio</span>
                        </div>

                        <AdminAudioPlayer post={selectedPost} />
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '12px', color: '#999' }}>
                    Bài đăng không tồn tại hoặc đã bị xóa
                  </div>
                )}

                <div className="admin-moderation-reports-section">
                  <h4>Báo cáo</h4>

                  <div className="admin-moderation-report-item">
                    <div className="admin-moderation-report-header">
                      <div className="admin-moderation-report-info">
                        <div className="admin-moderation-report-reason">
                          {getReasonLabel(selectedReport.reason)}
                        </div>
                        <div className="admin-moderation-report-reporter">
                          Báo cáo bởi {selectedReport.reporter_username}
                        </div>
                      </div>
                      <div className={`admin-moderation-report-status ${getReportStatusBadge(selectedReport.status).className}`}>
                        {getReportStatusBadge(selectedReport.status).label}
                      </div>
                    </div>

                    {selectedReport.description && (
                      <div className="admin-moderation-report-description">
                        {selectedReport.description}
                      </div>
                    )}

                    <div className="admin-moderation-report-actions">
                      {(selectedReport.status === 'resolved' || selectedReport.status === 'rejected') ? (
                        selectedPost && selectedPost.status === 'published' ? (
                          <>
                            <div className="admin-moderation-status-note">
                              Bài đăng đã mở và đang hiển thị
                            </div>
                            <button
                              className="admin-moderation-action-btn admin-moderation-action-approve"
                              onClick={() => handleUpdateReportStatus(selectedReport.id, 'resolved', selectedPost.id)}
                              disabled={updatingReportId === selectedReport.id}
                            >
                              <Lock size={14} />
                              Khóa bài đăng
                            </button>
                          </>
                        ) : (
                          <button
                            className="admin-moderation-action-btn admin-moderation-action-open"
                            onClick={() => handleOpenPost(selectedPost.id)}
                            disabled={updatingReportId === selectedPost.id}
                          >
                            <Unlock size={14} />
                            Mở bài đăng
                          </button>
                        )
                      ) : (
                        <>
                          <button
                            className="admin-moderation-action-btn admin-moderation-action-approve"
                            onClick={() => handleUpdateReportStatus(selectedReport.id, 'resolved', selectedPost.id)}
                            disabled={updatingReportId === selectedReport.id}
                          >
                            <Lock size={14} />
                            Khóa bài đăng
                          </button>
                          <button
                            className="admin-moderation-action-btn admin-moderation-action-reject"
                            onClick={() => handleUpdateReportStatus(selectedReport.id, 'rejected', selectedPost.id)}
                            disabled={updatingReportId === selectedReport.id}
                          >
                            <X size={14} />
                            Từ chối
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                Chọn một báo cáo để xem chi tiết
              </div>
            )}
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}

