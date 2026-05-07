import { Search, Mic, AlertCircle, Lock, X, Volume2, Unlock } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import AdminLayout from "./AdminLayout";
import "../../style/admin/admin-moderation-page.css";
import { getAdminPosts, lockPostWithReport, rejectReportWithPublish, updateReportStatus, openPost } from "../../utils/adminApi";
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

export default function AdminContentModerationPage() {
  const [posts, setPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [updatingReportId, setUpdatingReportId] = useState(null);
  const [audioTime, setAudioTime] = useState({});
  const [selectedAudioVersion, setSelectedAudioVersion] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const audioRefs = {};

  // Fetch posts on component mount
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await getAdminPosts({
        page_size: 50,
      });
      // Filter only posts that have reports
      const postsWithReports = (response.posts || []).filter(post => post.report_count > 0);
      setPosts(postsWithReports);
      if (postsWithReports.length > 0) {
        setSelectedPostId(postsWithReports[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải dữ liệu');
      console.error('Error fetching posts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter posts based on tab and search
  useEffect(() => {
    let filtered = posts;

    // Filter by report status tab
    if (activeTab === 'pending') {
      filtered = filtered.filter(post => post.pending_reports > 0);
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter(post => post.pending_reports === 0);
    }

    // Filter by keyword
    if (keyword) {
      filtered = filtered.filter(post =>
        post.title.toLowerCase().includes(keyword.toLowerCase()) ||
        post.username.toLowerCase().includes(keyword.toLowerCase())
      );
    }

    // Sort: In "all" tab, show pending reports first
    if (activeTab === 'all') {
      filtered = filtered.sort((a, b) => b.pending_reports - a.pending_reports);
    }

    setFilteredPosts(filtered);
    setCurrentPage(1); // Reset to page 1 when filter changes
  }, [posts, activeTab, keyword]);

  // Paginate filtered posts
  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedPosts = filteredPosts.slice(startIdx, endIdx);

  const tabs = [
    { key: "all", label: `Tất cả (${posts.length})` },
    { key: "pending", label: `Chờ duyệt (${posts.filter(p => p.pending_reports > 0).length})` },
    { key: "resolved", label: `Đã xử lý (${posts.filter(p => p.pending_reports === 0).length})` },
  ];

  const selectedPost = filteredPosts.find(item => item.id === selectedPostId) || filteredPosts[0];

  const handleUpdateReportStatus = async (reportId, newStatus, postId) => {
    if (!selectedPost) return;
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
      
      await fetchPosts();
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
      await fetchPosts();
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
      <AdminLayout title="KIỂM DUYỆT NỘI DUNG" subtitle={formatSubtitle()}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Đang tải dữ liệu...
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="KIỂM DUYỆT NỘI DUNG" subtitle={formatSubtitle()}>
        <div style={{ padding: '40px', textAlign: 'center', color: '#e74c3c' }}>
          {error}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="KIỂM DUYỆT NỘI DUNG"
      subtitle={formatSubtitle()}
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
            {paginatedPosts.length === 0 && filteredPosts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                Không có bài viết nào
              </div>
            ) : (
              <>
                {paginatedPosts.map((post) => {
                const createdDate = new Date(post.created_at);
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

                return (
                  <button
                    key={post.id}
                    type="button"
                    className={`admin-moderation-item ${selectedPost?.id === post.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedPostId(post.id)}
                  >
                    <div className="admin-moderation-item-left">
                      <div className="admin-moderation-item-icon">
                        <Mic size={15} />
                      </div>

                      <div className="admin-moderation-item-body">
                        <div className="admin-moderation-item-title">{post.title}</div>
                        <div className="admin-moderation-item-meta">
                          bởi {post.username} · {post.age_group || 'N/A'} · {timeStr}
                        </div>
                      </div>
                    </div>

                    <div className="admin-moderation-item-right">
                      <div className="admin-report-count">
                        <AlertCircle size={14} />
                        {post.report_count} báo cáo
                      </div>
                      <div className={`admin-pending-badge ${post.pending_reports === 0 ? 'resolved' : 'pending'}`}>
                        {post.pending_reports > 0 ? `${post.pending_reports} chờ duyệt` : 'Đã xử lý'}
                      </div>
                    </div>
                  </button>
                );
              })}

                {totalPages > 1 && (
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

            {selectedPost ? (
              <div className="admin-moderation-detail-card">
                <h3>{selectedPost.title}</h3>

                <div className="admin-moderation-detail-grid">
                  <span>Tác giả</span>
                  <strong>{selectedPost.username}</strong>

                  <span>Nhóm Tuổi</span>
                  <strong>{selectedPost.age_group || 'N/A'}</strong>

                  <span>Lượt Nghe</span>
                  <strong>{selectedPost.listen_count}</strong>

                  <span>Mô Tả</span>
                  <strong>{selectedPost.description || 'Không có'}</strong>
                </div>

                {selectedPost.audio_versions && selectedPost.audio_versions.length > 0 && (
                  <div className="admin-moderation-audio-player">
                    <div className="admin-moderation-audio-header">
                      <Volume2 size={16} />
                      <span>Nghe audio</span>
                    </div>

                    {selectedPost.audio_versions.length > 1 && (
                      <div className="admin-moderation-audio-versions">
                        {selectedPost.audio_versions.map((audioVersion) => (
                          <button
                            key={audioVersion.id}
                            className={`admin-moderation-audio-version-btn ${
                              (selectedAudioVersion[selectedPost.id] === audioVersion.id || 
                               (audioVersion.is_default && !selectedAudioVersion[selectedPost.id])) 
                                ? 'is-active' 
                                : ''
                            }`}
                            onClick={() => setSelectedAudioVersion(prev => ({
                              ...prev,
                              [selectedPost.id]: audioVersion.id
                            }))}
                          >
                            <span className="version-name">{audioVersion.voice_name}</span>
                            <span className="version-format">{audioVersion.format?.toUpperCase()}</span>
                            {audioVersion.is_default && <span className="version-default">Mặc định</span>}
                          </button>
                        ))}
                      </div>
                    )}

                    {(() => {
                      const currentAudioId = selectedAudioVersion[selectedPost.id];
                      const currentAudio = selectedPost.audio_versions.find(a => 
                        currentAudioId ? a.id === currentAudioId : a.is_default
                      ) || selectedPost.audio_versions[0];
                      
                      return (
                        <>
                          <audio
                            ref={(el) => { audioRefs[selectedPost.id] = el; }}
                            className="admin-moderation-audio-control"
                            controls
                            key={currentAudio.id}
                            onTimeUpdate={(e) => {
                              setAudioTime(prev => ({
                                ...prev,
                                [selectedPost.id]: e.target.currentTime
                              }));
                            }}
                          >
                            <source src={currentAudio.audio_url} type={`audio/${currentAudio.format}`} />
                            Trình duyệt của bạn không hỗ trợ audio tag.
                          </audio>
                          <div className="admin-moderation-audio-time">
                            <span>{formatTime(audioTime[selectedPost.id] || 0)}</span>
                            <span className="audio-separator">/</span>
                            <span>{formatTime(currentAudio.duration_seconds || 0)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="admin-moderation-reports-section">
                  <h4>Báo cáo ({selectedPost.reports?.length || 0})</h4>
                  
                  {selectedPost.reports && selectedPost.reports.length > 0 ? (
                    <div className="admin-moderation-reports-list">
                      {selectedPost.reports.map((report) => {
                        const reportStatusMeta = getReportStatusBadge(report.status);
                        const reportDate = new Date(report.created_at);
                        const now = new Date();
                        const reportDiffMs = now - reportDate;
                        const reportDiffMins = Math.floor(reportDiffMs / 60000);
                        const reportDiffHours = Math.floor(reportDiffMs / 3600000);
                        const reportDiffDays = Math.floor(reportDiffMs / 86400000);
                        
                        let reportTimeStr;
                        if (reportDiffMins < 60) {
                          reportTimeStr = `${reportDiffMins} phút trước`;
                        } else if (reportDiffHours < 24) {
                          reportTimeStr = `${reportDiffHours} giờ trước`;
                        } else {
                          reportTimeStr = `${reportDiffDays} ngày trước`;
                        }

                        return (
                          <div key={report.id} className="admin-moderation-report-item">
                            <div className="admin-moderation-report-header">
                              <div className="admin-moderation-report-info">
                                <div className="admin-moderation-report-reason">
                                  {getReasonLabel(report.reason)}
                                </div>
                                <div className="admin-moderation-report-reporter">
                                  Báo cáo bởi {report.reporter_username} · {reportTimeStr}
                                </div>
                              </div>
                              <div className={`admin-moderation-report-status ${reportStatusMeta.className}`}>
                                {reportStatusMeta.label}
                              </div>
                            </div>
                            
                            {report.description && (
                              <div className="admin-moderation-report-description">
                                {report.description}
                              </div>
                            )}

                            <div className="admin-moderation-report-actions">
                              {(report.status === 'resolved' || report.status === 'rejected') ? (
                                selectedPost.status === 'published' ? (
                                  <>
                                    <div className="admin-moderation-status-note">
                                       Bài đăng đã mở và đang hiển thị
                                    </div>
                                    <button
                                      className="admin-moderation-action-btn admin-moderation-action-approve"
                                      onClick={() => handleUpdateReportStatus(report.id, 'resolved', selectedPost.id)}
                                      disabled={updatingReportId === report.id}
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
                                    onClick={() => handleUpdateReportStatus(report.id, 'resolved', selectedPost.id)}
                                    disabled={updatingReportId === report.id}
                                  >
                                    <Lock size={14} />
                                    Khóa bài đăng
                                  </button>
                                  <button
                                    className="admin-moderation-action-btn admin-moderation-action-reject"
                                    onClick={() => handleUpdateReportStatus(report.id, 'rejected', selectedPost.id)}
                                    disabled={updatingReportId === report.id}
                                  >
                                    <X size={14} />
                                    Từ chối
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '12px', color: '#999', textAlign: 'center' }}>
                      Không có báo cáo nào cho bài viết này
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                Chọn một bài viết để xem chi tiết
              </div>
            )}
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}

