import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Input, Button, Spin, Empty } from 'antd'
import { Search, Send, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { apiRequest } from '../../utils/api'
import { getToken, getCurrentUser } from '../../utils/auth'
import { API_BASE_URL } from '../../config/apiBase'
import { getInitials } from '../../utils/getInitials'
import styles from '../../style/feed/ProfileShareModal.module.css'

export default function ProfileShareModal({
    profileUser,
    profileUserId,
    onClose,
    onShareSuccess,
}) {
    const [friends, setFriends] = useState([])
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [searchText, setSearchText] = useState('')
    const [caption, setCaption] = useState('')
    const [selectedUserIds, setSelectedUserIds] = useState([])


    const displayName =
        profileUser?.display_name ||
        profileUser?.full_name ||
        profileUser?.name ||
        profileUser?.username ||
        'Trang cá nhân'

    const username = profileUser?.username || ''
    const avatarUrl =
        profileUser?.avatar_url ||
        profileUser?.avatar ||
        profileUser?.profile_image ||
        profileUser?.image ||
        ''

    const bio = profileUser?.bio || ''

    const currentUser = getCurrentUser()
    useEffect(() => {
        fetchFriends()
    }, [])

    const fetchFriends = async () => {
        try {
            setLoading(true)

            const data = await apiRequest(
                `/social/friends/?user_id=${currentUser?.id}`
            )

            const mutualFriends =
                data?.data?.friends ||
                data?.data?.results ||
                []

            setFriends(mutualFriends)
        } catch (err) {
            console.error('Failed to fetch friends:', err)
            toast.error('Không thể tải danh sách người nhận')
            setFriends([])
        } finally {
            setLoading(false)
        }
    }

    const filteredFriends = useMemo(() => {
        const keyword = searchText.trim().toLowerCase()

        if (!keyword) return friends

        return friends.filter((friend) => {
            const name = String(
                friend.display_name ||
                friend.name ||
                friend.full_name ||
                friend.username ||
                ''
            ).toLowerCase()

            const friendUsername = String(friend.username || '').toLowerCase()

            return name.includes(keyword) || friendUsername.includes(keyword)
        })
    }, [friends, searchText])

    const toggleUser = (friend) => {
        const id = String(friend.id || friend.user_id || friend.username || '')
        if (!id) return

        setSelectedUserIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((item) => item !== id)
            }

            return [...prev, id]
        })
    }

    const handleSend = async () => {
        if (!profileUserId) {
            toast.error('Không tìm thấy trang cá nhân cần chia sẻ')
            return
        }

        if (selectedUserIds.length === 0) {
            toast.warning('Vui lòng chọn ít nhất một người nhận')
            return
        }

        try {
            setSending(true)

            const token = getToken()
            const sender = getCurrentUser()

            const payload = {
                user_id: sender?.id,
                target_user_ids: selectedUserIds,
                caption: caption.trim(),
                profile: {
                    type: 'profile',
                    profile_user_id: String(profileUserId),
                    username,
                    display_name: displayName,
                    avatar_url: avatarUrl,
                    bio,
                    caption: caption.trim(),
                },
            }

            const res = await fetch(
                `${API_BASE_URL}/social/profiles/${profileUserId}/share-to-user/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify(payload),
                }
            )

            const data = await res.json()

            if (!res.ok || data?.success === false) {
                throw new Error(data?.message || `HTTP ${res.status}`)
            }

            toast.success('Đã gửi trang cá nhân vào tin nhắn')
            onShareSuccess?.(data?.data || data)
        } catch (err) {
            console.error('Share profile failed:', err)
            toast.error(err.message || 'Không thể chia sẻ trang cá nhân')
        } finally {
            setSending(false)
        }
    }

    return (
        <Modal
            open={true}
            footer={null}
            onCancel={onClose}
            centered
            width={520}
            closeIcon={<X size={18} />}
            title="Chia sẻ trang cá nhân"
            wrapClassName="profile-share-modal"
        >
            <div className={styles.modal}>
                <div className={styles.profileCard}>
                    {avatarUrl ? (
                        <div className={styles.avatarWrap}>
                            <img
                                src={avatarUrl}
                                alt={displayName}
                                className={styles.avatarImg}
                            />
                        </div>
                    ) : (
                        <div className={styles.avatarWrap}>
                            {getInitials({
                                username,
                                display_name: displayName,
                                name: displayName,
                            })}
                        </div>
                    )}

                    <div className={styles.profileInfo}>
                        <div className={styles.profileName}>
                            {displayName}
                        </div>

                        {username ? (
                            <div className={styles.profileUsername}>
                                @{username}
                            </div>
                        ) : null}

                        {bio ? (
                            <div className={styles.profileBio}>
                                {bio}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div style={{ marginTop: 16 }}>
                    <textarea
                        className={styles.textarea}
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Viết lời nhắn..."
                        rows={3}
                        maxLength={300}
                    />
                    <div style={{ fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 4 }}>
                        {caption.length} / 300
                    </div>
                </div>

                <div style={{ marginTop: 16 }}>
                    <Input
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Tìm người nhận..."
                        prefix={<Search size={16} />}
                        allowClear
                    />
                </div>

                <div className={styles.friendsList} style={{ marginTop: 16 }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                            <Spin />
                        </div>
                    ) : filteredFriends.length === 0 ? (
                        <Empty description="Không có người nhận" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                        filteredFriends.map((friend) => {
                            const friendId = String(friend.id || friend.user_id || friend.username || '')
                            const friendName =
                                friend.display_name ||
                                friend.name ||
                                friend.full_name ||
                                friend.username ||
                                'Người dùng'

                            const friendUsername = friend.username || ''
                            const friendAvatar = friend.avatar_url || friend.avatar || ''
                            const checked = selectedUserIds.includes(friendId)

                            return (
                                <button
                                    key={friendId}
                                    type="button"
                                    onClick={() => toggleUser(friend)}
                                    className={`${styles.friendItem} ${checked ? styles.friendItemSelected : ''}`}
                                >
                                    {friendAvatar ? (
                                        <div className={styles.friendAvatarWrap}>
                                            <img
                                                src={friendAvatar}
                                                alt={friendName}
                                                className={styles.friendAvatarImg}
                                            />
                                        </div>
                                    ) : (
                                        <div className={styles.friendAvatarWrap}>
                                            {getInitials({
                                                username: friendUsername,
                                                display_name: friendName,
                                                name: friendName,
                                            })}
                                        </div>
                                    )}

                                    <div className={styles.friendInfo}>
                                        <div className={styles.friendName}>
                                            {friendName}
                                        </div>

                                        {friendUsername ? (
                                            <div className={styles.friendUsername}>
                                                @{friendUsername}
                                            </div>
                                        ) : null}
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        readOnly
                                        style={{ width: 18, height: 18, accentColor: '#6366f1', cursor: 'pointer' }}
                                    />
                                </button>
                            )
                        })
                    )}
                </div>

                <div className={styles.actions}>
                    <Button className={styles.cancelBtn} type="text" onClick={onClose}>
                        Hủy
                    </Button>

                    <Button
                        className={styles.sendBtn}
                        type="primary"
                        loading={sending}
                        disabled={selectedUserIds.length === 0}
                        onClick={handleSend}
                    >
                        <Send size={16} />
                        Gửi
                    </Button>
                </div>
            </div>
        </Modal>
    )
}