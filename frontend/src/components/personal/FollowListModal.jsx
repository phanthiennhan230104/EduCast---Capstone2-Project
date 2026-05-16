import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/api';
import { getInitials } from '../../utils/getInitials';
import { toast } from 'react-toastify';
import ConfirmModal from '../common/ConfirmModal';
import styles from '../../style/personal/FollowListModal.module.css';

const FollowListModal = ({
  isOpen,
  onClose,
  userId,
  type, // 'followers' or 'following'
  isOwnProfile,
  onUpdateStats,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, user: null });

  useEffect(() => {
    if (isOpen && userId) {
      fetchUsers();
    }
  }, [isOpen, userId, type]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const endpoint = type === 'followers' 
        ? `/social/followers/?user_id=${userId}`
        : `/social/follow-list/?user_id=${userId}`;
      
      const response = await apiRequest(endpoint);
      const data = type === 'followers' ? response.data?.followers : response.data?.following;
      setUsers(data || []);
    } catch (err) {
      console.error(`Error fetching ${type}:`, err);
      toast.error(t(`personal.fetch${type === 'followers' ? 'Followers' : 'Friends'}Failed`));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async (targetUser) => {
    setActionLoading(prev => ({ ...prev, [targetUser.id]: true }));
    try {
      const response = await apiRequest(`/social/users/${targetUser.id}/follow/`, {
        method: 'POST',
      });
      
      if (response.success) {
        setUsers(prev => prev.map(u => {
          if (u.id === targetUser.id) {
            return { ...u, is_following: response.data.followed };
          }
          return u;
        }));
        if (onUpdateStats) onUpdateStats();
      }
    } catch (err) {
      console.error('Toggle follow error:', err);
      toast.error(t('personal.followFailed'));
    } finally {
      setActionLoading(prev => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const handleRemoveFollower = async (targetUser) => {
    setActionLoading(prev => ({ ...prev, [targetUser.id]: true }));
    try {
      const response = await apiRequest(`/social/users/${targetUser.id}/remove-follower/`, {
        method: 'POST',
      });
      
      if (response.success) {
        setUsers(prev => prev.filter(u => u.id !== targetUser.id));
        toast.success(t('personal.followerRemoved'));
        if (onUpdateStats) onUpdateStats();
      }
    } catch (err) {
      console.error('Remove follower error:', err);
      toast.error(t('personal.removeFollowerFailed'));
    } finally {
      setActionLoading(prev => ({ ...prev, [targetUser.id]: false }));
    }
  };

  const confirmRemove = (user) => {
    setConfirmModal({ isOpen: true, user });
  };

  const handleNavigate = (targetUserId) => {
    onClose();
    navigate(`/profile/${targetUserId}`);
    window.scrollTo(0, 0);
  };

  const filteredUsers = users.filter(u => 
    (u.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={styles.overlay} onClick={onClose}>
        <motion.div 
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.header}>
            <div className={styles.headerTitle}>
              {type === 'followers' ? t('personal.tabs.followers') : t('personal.tabs.following')}
            </div>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className={styles.searchContainer}>
            <div className={styles.searchWrapper}>
              <Search size={18} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder={t('common.search')}
                className={styles.searchInput}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.content}>
            {loading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className={styles.userList}>
                {filteredUsers.map(u => (
                  <div key={u.id} className={styles.userItem}>
                    <div 
                      className={styles.userInfo} 
                      onClick={() => handleNavigate(u.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className={styles.avatarWrapper}>
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt={u.username} className={styles.avatar} />
                        ) : (
                          <div className={styles.initials}>
                            {getInitials({ username: u.username, display_name: u.display_name })}
                          </div>
                        )}
                      </div>
                      <div className={styles.userDetails}>
                        <div className={styles.username}>{u.username}</div>
                        <div className={styles.displayName}>{u.display_name}</div>
                      </div>
                    </div>
                    
                    <div className={styles.actions}>
                      {isOwnProfile && type === 'followers' ? (
                        <button 
                          className={styles.removeBtn}
                          onClick={() => confirmRemove(u)}
                          disabled={actionLoading[u.id]}
                        >
                          {actionLoading[u.id] ? '...' : t('publishPost.remove')}
                        </button>
                      ) : !u.is_current_user && (
                        <button 
                          className={`${styles.followBtn} ${u.is_following ? styles.following : ''}`}
                          onClick={() => handleToggleFollow(u)}
                          disabled={actionLoading[u.id]}
                        >
                          {actionLoading[u.id] ? '...' : u.is_following ? t('buttons.following') : t('buttons.follow')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <UserIcon size={48} className={styles.emptyIcon} />
                <p>{t('personal.noResults')}</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, user: null })}
        onConfirm={() => handleRemoveFollower(confirmModal.user)}
        avatarUrl={confirmModal.user?.avatar_url}
        title={t('personal.removeFollower')}
        message={t('personal.removeFollowerConfirm', { name: confirmModal.user?.display_name || confirmModal.user?.username })}
        confirmText={t('publishPost.remove')}
        cancelText={t('common.cancel')}
        type="danger"
      />
    </AnimatePresence>
  );
};

export default FollowListModal;
