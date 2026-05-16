import { useState, useEffect, useRef } from 'react';
import {
    Search,
    Check,
    X,
    AlertCircle,
    Filter,
    Play,
    Pause,
    ChevronDown,
    Clock,
    Calendar,
    CheckCircle,
    RotateCcw,
    Trash2,
} from 'lucide-react';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { API_ORIGIN } from '../../config/apiBase';
import AdminLayout from './AdminLayout';
import '../../style/admin/admin-content-moderation.css';
import {
    getAdminPosts,
    publishPost,
    rejectPost,
    republishPost,
    getAdminOverview,
    requestRepublishByAdmin,
} from '../../utils/adminApi';
import notify from '../../utils/toast';

function formatSubtitle() {
    const today = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[today.getDay()];
    const date = String(today.getDate()).padStart(2, '0');
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    return `EduCast · ${dayName}, ${date} tháng ${month}, ${year}`;
}

function getStatusBadge(status, post) {
    const statuses = {
        processing: { label: 'Chờ duyệt', className: 'status-processing' },
        published: { label: 'Đã đăng', className: 'status-published' },
        hidden: { label: 'Ẩn', className: 'status-hidden' },
        draft: { label: 'Bản nháp', className: 'status-draft' },
        failed: {
            label: post?.learning_field && ['1', '2'].includes(String(post.learning_field)) ? 'Bị từ chối' : 'Lỗi',
            className: 'status-failed'
        },
    };
    return statuses[status] || { label: status, className: 'status-unknown' };
}

function getVisibilityBadge(visibility) {
    const visibilities = {
        public: { label: 'Công khai', className: 'visibility-public' },
        private: { label: 'Riêng tư', className: 'visibility-private' },
        unlisted: { label: 'Không liệt kê', className: 'visibility-unlisted' },
    };
    return visibilities[visibility] || { label: visibility, className: 'visibility-unknown' };
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
function getPostAudioUrl(post) {
    return (
        post.audio?.audio_url ||
        post.audio?.url ||
        post.audioUrl ||
        post.audio_url ||
        ''
    );
}

function AdminFeedAudioPlayer({ post }) {
    const progressBarRef = useRef(null);

    const {
        playTrack,
        currentTrack,
        playing,
        togglePlay,
        currentTime,
        trackProgressMap,
        seekToPercent,
        seekTrackToPercent,
        getTrackProgressKey,
    } = useAudioPlayer();

    const audioUrl = getFullAudioUrl(getPostAudioUrl(post));
    const durationSeconds = Number(
        post.audio?.duration_seconds ||
        post.duration_seconds ||
        0
    );
    const track = {
        id: post.id,
        postId: post.id,
        title: post.title,
        author: post.display_name || post.username || 'EduCast',
        audioUrl,
        audio_url: audioUrl,
        durationSeconds,
        duration_seconds: durationSeconds,
        cover: post.thumbnail_url || '',
        thumbnail_url: post.thumbnail_url || '',
    };
    const isCurrentTrack = String(currentTrack?.id) === String(post.id);
    const isCurrentPlaying = isCurrentTrack && playing;
    const progressKey = getTrackProgressKey(track);
    const savedProgress = progressKey ? trackProgressMap?.[progressKey] : null;

    const displayTime = isCurrentTrack
        ? currentTime
        : savedProgress?.currentTime || 0;

    const displayDuration = isCurrentTrack
        ? Number(currentTrack?.durationSeconds || durationSeconds || savedProgress?.duration || 0)
        : Number(savedProgress?.duration || durationSeconds || 0);

    const displayProgress = isCurrentTrack
        ? displayDuration
            ? (displayTime / displayDuration) * 100
            : 0
        : savedProgress?.progressPercent || 0;

    const handlePlayClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!audioUrl) return;

        if (isCurrentTrack) {
            togglePlay();
            return;
        }

        playTrack(track);
    };

    const handleProgressBarClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!progressBarRef.current || !audioUrl) return;

        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));

        if (typeof seekTrackToPercent === 'function') {
            seekTrackToPercent(track, percent);
            return;
        }

        if (isCurrentTrack) {
            seekToPercent(percent);
        } else {
            playTrack(track);
        }
    };

    return (
        <div className="admin-feed-audio-player">
            <button
                type="button"
                className="admin-feed-audio-play-btn"
                onClick={handlePlayClick}
                aria-label={isCurrentPlaying ? 'Tạm dừng' : 'Phát audio'}
            >
                {isCurrentPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <span className="admin-feed-audio-time">
                {formatAudioTime(displayTime)}
            </span>

            <div
                ref={progressBarRef}
                className="admin-feed-audio-progress"
                onClick={handleProgressBarClick}
                role="button"
                tabIndex={0}
            >
                <div
                    className="admin-feed-audio-progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
                />
            </div>

            <span className="admin-feed-audio-time">
                {formatAudioTime(displayDuration)}
            </span>
        </div>
    );
}
export default function AdminContentModeration() {
    const [posts, setPosts] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [onlineUsers, setOnlineUsers] = useState(0);

    const statusDropdownRef = useRef(null);
    const itemsPerPage = 3;

    const [showVisibilityModal, setShowVisibilityModal] = useState(false);
    const [selectedPostForPublish, setSelectedPostForPublish] = useState(null);
    const [selectedVisibility, setSelectedVisibility] = useState('public');

    const statusOptions = [
        { value: 'processing', label: 'Chờ duyệt' },
        { value: 'published', label: 'Đã đăng' },
        { value: 'hidden', label: 'Ẩn' },
        { value: 'all', label: 'Tất cả' },
    ];

    const selectedStatus =
        statusOptions.find((item) => item.value === statusFilter) || statusOptions[0];

    useEffect(() => {
        fetchPosts();
    }, [statusFilter, searchKeyword, currentPage]);

    useEffect(() => {
        const fetchOnlineUsers = async () => {
            try {
                const response = await getAdminOverview();
                const overview = response?.overview || response?.data?.overview;

                setOnlineUsers(overview?.users?.active_users || 0);
            } catch (err) {
                console.error('Error fetching online users:', err);
                setOnlineUsers(0);
            }
        };

        fetchOnlineUsers();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                statusDropdownRef.current &&
                !statusDropdownRef.current.contains(event.target)
            ) {
                setIsStatusDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);




    const fetchPosts = async () => {
        try {
            setLoading(true);
            const filters = {
                status: statusFilter,
                search: searchKeyword,
                page: currentPage,
                page_size: itemsPerPage,
            };
            const response = await getAdminPosts(filters);
            setPosts(response.posts || []);
            setTotalPages(response.pagination?.total_pages || 1);
            setError(null);
        } catch (err) {
            setError(err.message || 'Lỗi khi tải dữ liệu');
            console.error('Error fetching posts:', err);
            setPosts([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async (postId) => {
        try {
            setActionLoading(postId);
            await publishPost(postId, selectedVisibility);
            notify.success('Bài viết đã được duyệt và công bố!');
            fetchPosts();
            setShowVisibilityModal(false);
            setSelectedPostForPublish(null);
        } catch (err) {
            notify.error(err.message || 'Lỗi khi duyệt bài viết');
            console.error('Error publishing post:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const openPublishModal = (post) => {
        setSelectedPostForPublish(post);
        setSelectedVisibility('public');
        setShowVisibilityModal(true);
    };

    const closePublishModal = () => {
        setShowVisibilityModal(false);
        setSelectedPostForPublish(null);
    };

    const handleReject = async (postId) => {
        try {
            setActionLoading(postId);
            await rejectPost(postId);
            notify.success('Bài viết đã bị xóa!');
            fetchPosts();
        } catch (err) {
            notify.error(err.message || 'Lỗi khi xóa bài viết');
            console.error('Error rejecting post:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleRepublish = async (postId) => {
        try {
            setActionLoading(postId);
            await republishPost(postId);
            notify.success('Bài viết đã được đăng lại công khai!');
            fetchPosts();
        } catch (err) {
            notify.error(err.message || 'Lỗi khi đăng lại bài viết');
            console.error('Error republishing post:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleAdminRequestRepublish = async (postId) => {
        try {
            setActionLoading(postId);
            await requestRepublishByAdmin(postId);
            notify.success('Đã gửi yêu cầu đăng lại cho người dùng!');
            fetchPosts();
        } catch (err) {
            notify.error(err.message || 'Lỗi khi yêu cầu đăng lại');
            console.error('Error requesting republish:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleSearch = (e) => {
        setSearchKeyword(e.target.value);
        setCurrentPage(1);
    };

    if (loading && posts.length === 0) {
        return (
            <AdminLayout title="KIỂM DUYỆT NỘI DUNG" subtitle={formatSubtitle()} onlineUsers={onlineUsers}>
                <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                    Đang tải dữ liệu...
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="KIỂM DUYỆT NỘI DUNG" subtitle={formatSubtitle()} onlineUsers={onlineUsers}>
            <div className="admin-content-moderation">
                <div className="moderation-header">
                    <div className="moderation-controls">
                        <div className="search-box">
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm bài viết..."
                                value={searchKeyword}
                                onChange={handleSearch}
                                className="search-input"
                            />
                        </div>

                        <div className="filter-group custom-status-filter" ref={statusDropdownRef}>
                            <Filter size={18} className="filter-icon" />

                            <div className="status-dropdown">
                                <button
                                    type="button"
                                    className={`status-dropdown-btn ${isStatusDropdownOpen ? 'open' : ''}`}
                                    onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
                                >
                                    <span>{selectedStatus.label}</span>
                                    <ChevronDown size={16} className="status-dropdown-arrow" />
                                </button>

                                {isStatusDropdownOpen && (
                                    <div className="status-dropdown-menu">
                                        {statusOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                className={`status-dropdown-option ${statusFilter === option.value ? 'active' : ''
                                                    }`}
                                                onClick={() => {
                                                    setStatusFilter(option.value);
                                                    setCurrentPage(1);
                                                    setIsStatusDropdownOpen(false);
                                                }}
                                            >
                                                <span>{option.label}</span>

                                                {statusFilter === option.value && (
                                                    <Check size={15} className="status-dropdown-check" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="error-message">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <div className="moderation-content">
                    {posts.length === 0 ? (
                        <div className="empty-state">
                            <AlertCircle size={48} />
                            <p>Không có bài viết nào</p>
                        </div>
                    ) : (
                        <div className="posts-grid">
                            {posts.map((post) => (
                                <div key={post.id} className={`post-card ${post.thumbnail_url ? 'has-thumbnail' : 'no-thumbnail'}`}>
                                    {/* {post.thumbnail_url && (
                                        <div className="post-thumbnail">
                                            <img src={post.thumbnail_url} alt={post.title} />
                                            <div className="status-overlay">
                                                <span className={`status-badge ${getStatusBadge(post.status).className}`}>
                                                    {getStatusBadge(post.status).label}
                                                </span>
                                                <span className={`visibility-badge ${getVisibilityBadge(post.visibility).className}`}>
                                                    {getVisibilityBadge(post.visibility).label}
                                                </span>
                                            </div>
                                        </div>
                                    )} */}

                                    <div className="post-card-content">
                                        <h3 className="post-title">{post.title}</h3>

                                        <div className="post-badges">
                                            <span className={`status-badge ${getStatusBadge(post.status, post).className}`}>
                                                {getStatusBadge(post.status, post).label}
                                            </span>
                                            <span className={`visibility-badge ${getVisibilityBadge(post.visibility).className}`}>
                                                {getVisibilityBadge(post.visibility).label}
                                            </span>
                                        </div>

                                        {post.description && (
                                            <p className="post-description">{post.description}</p>
                                        )}

                                        <div className="post-author-info">
                                            {post.user_avatar && (
                                                <img 
                                                    src={post.user_avatar} 
                                                    alt={post.display_name} 
                                                    className="author-avatar" 
                                                />
                                            )}
                                            <p className="post-author">
                                                Tác giả: <strong>{post.display_name || post.username}</strong>
                                            </p>
                                        </div>

                                        <div className="post-meta">
                                            <span className="meta-item"><Clock size={14} /> {post.duration_seconds || 0}s</span>
                                            <span className="meta-item"><Calendar size={14} /> {new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
                                        </div>

                                        {getPostAudioUrl(post) && (
                                            <AdminFeedAudioPlayer post={post} />
                                        )}

                                        {post.thumbnail_url && (
                                            <div className="post-content-image">
                                                <img src={post.thumbnail_url} alt={post.title} />
                                            </div>
                                        )}

                                        {post.status === 'processing' && (
                                            <div className="post-actions">
                                                <button
                                                    className="btn-publish"
                                                    onClick={() => openPublishModal(post)}
                                                    disabled={actionLoading === post.id}
                                                >
                                                    <CheckCircle size={18} />
                                                    {actionLoading === post.id
                                                        ? 'Đang...'
                                                        : (post.learning_field === '1' ? 'Đăng lại' : 'Duyệt')}
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => handleReject(post.id)}
                                                    disabled={actionLoading === post.id}
                                                >
                                                    <Trash2 size={18} />
                                                    {actionLoading === post.id ? 'Đang...' : 'Xóa'}
                                                </button>
                                            </div>
                                        )}
                                        {post.status === 'failed' && (
                                            <div className="post-actions">
                                                {post.learning_field === '1' && (
                                                    <button
                                                        className="btn-republish-admin"
                                                        onClick={() => handleAdminRequestRepublish(post.id)}
                                                        disabled={actionLoading === post.id}
                                                    >
                                                        <RotateCcw size={18} />
                                                        {actionLoading === post.id ? 'Đang...' : 'Yêu cầu đăng lại'}
                                                    </button>
                                                )}
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => handleReject(post.id)}
                                                    disabled={actionLoading === post.id}
                                                >
                                                    <Trash2 size={18} />
                                                    {actionLoading === post.id ? 'Đang...' : 'Xóa'}
                                                </button>
                                            </div>
                                        )}
                                        {post.status === 'hidden' && (
                                            <div className="post-actions">
                                                <button
                                                    className="btn-republish"
                                                    onClick={() => handleRepublish(post.id)}
                                                    disabled={actionLoading === post.id}
                                                >
                                                    <RotateCcw size={18} />
                                                    {actionLoading === post.id ? 'Đang...' : 'Khôi phục'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="pagination">
                        {Array.from({ length: totalPages }, (_, index) => {
                            const page = index + 1;

                            return (
                                <button
                                    key={page}
                                    type="button"
                                    onClick={() => setCurrentPage(page)}
                                    className={`pagination-btn ${currentPage === page ? 'pagination-btn-active' : ''
                                        }`}
                                >
                                    {page}
                                </button>
                            );
                        })}
                    </div>
                )}

                {showVisibilityModal && selectedPostForPublish && (
                    <div className="modal-overlay" onClick={closePublishModal}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Chọn mức độ hiển thị</h3>
                                <button className="modal-close" onClick={closePublishModal}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="modal-body">
                                <p className="modal-subtitle">
                                    Bài viết: <strong>{selectedPostForPublish.title}</strong>
                                </p>

                                <div className="visibility-options">
                                    <label className="radio-option">
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="public"
                                            checked={selectedVisibility === 'public'}
                                            onChange={(e) => setSelectedVisibility(e.target.value)}
                                        />
                                        <span className="radio-label">
                                            <strong>🌐 Công khai</strong>
                                            <small>Tất cả mọi người có thể xem</small>
                                        </span>
                                    </label>
                                    <label className="radio-option">
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="unlisted"
                                            checked={selectedVisibility === 'unlisted'}
                                            onChange={(e) => setSelectedVisibility(e.target.value)}
                                        />
                                        <span className="radio-label">
                                            <strong>🔗 Không liệt kê</strong>
                                            <small>Chỉ những người có liên kết mới xem được</small>
                                        </span>
                                    </label>
                                    <label className="radio-option">
                                        <input
                                            type="radio"
                                            name="visibility"
                                            value="private"
                                            checked={selectedVisibility === 'private'}
                                            onChange={(e) => setSelectedVisibility(e.target.value)}
                                        />
                                        <span className="radio-label">
                                            <strong>🔒 Riêng tư</strong>
                                            <small>Chỉ tác giả mới xem được</small>
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button
                                    className="btn-cancel"
                                    onClick={closePublishModal}
                                    disabled={actionLoading === selectedPostForPublish.id}
                                >
                                    Hủy
                                </button>
                                <button
                                    className="btn-confirm"
                                    onClick={() => handlePublish(selectedPostForPublish.id)}
                                    disabled={actionLoading === selectedPostForPublish.id}
                                >
                                    {actionLoading === selectedPostForPublish.id ? 'Đang duyệt...' : 'Duyệt & Đăng'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
