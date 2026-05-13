import React, { useEffect, useMemo, useState } from 'react'
import { Modal, Input, Button, Spin, Empty } from 'antd'
import { Search, Send, X } from 'lucide-react'
import { toast } from 'react-toastify'
import { apiRequest } from '../../utils/api'
import { getToken, getCurrentUser } from '../../utils/auth'
import { getInitials } from '../../utils/getInitials'

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

            const following =
                data?.data?.following ||
                data?.data?.friends ||
                data?.data?.results ||
                []

            const followersRes = await apiRequest(
                `/social/followers/?user_id=${currentUser?.id}`
            )

            const followers =
                followersRes?.data?.followers ||
                followersRes?.data?.results ||
                []

            const followerIds = new Set(
                followers.map((u) => String(u.id || u.user_id))
            )

            const mutualFriends = following.filter((u) =>
                followerIds.has(String(u.id || u.user_id))
            )

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
                `http://localhost:8000/api/social/profiles/${profileUserId}/share-to-user/`,
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
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                    style={{
                        display: 'flex',
                        gap: 12,
                        padding: 12,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt={displayName}
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                flexShrink: 0,
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#6366f1',
                                color: '#fff',
                                fontWeight: 700,
                                flexShrink: 0,
                            }}
                        >
                            {getInitials({
                                username,
                                display_name: displayName,
                                name: displayName,
                            })}
                        </div>
                    )}

                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>
                            {displayName}
                        </div>

                        {username ? (
                            <div style={{ opacity: 0.75, fontSize: 13 }}>
                                @{username}
                            </div>
                        ) : null}

                        {bio ? (
                            <div
                                style={{
                                    marginTop: 4,
                                    fontSize: 13,
                                    opacity: 0.85,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}
                            >
                                {bio}
                            </div>
                        ) : null}
                    </div>
                </div>

                <Input.TextArea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Viết lời nhắn..."
                    rows={3}
                    maxLength={300}
                    showCount
                />

                <Input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Tìm người nhận..."
                    prefix={<Search size={16} />}
                    allowClear
                />

                <div
                    style={{
                        maxHeight: 300,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}
                >
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                            <Spin />
                        </div>
                    ) : filteredFriends.length === 0 ? (
                        <Empty description="Không có người nhận" />
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
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: 10,
                                        borderRadius: 12,
                                        border: checked
                                            ? '1px solid #6366f1'
                                            : '1px solid rgba(255,255,255,0.08)',
                                        background: checked
                                            ? 'rgba(99,102,241,0.16)'
                                            : 'rgba(255,255,255,0.04)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    {friendAvatar ? (
                                        <img
                                            src={friendAvatar}
                                            alt={friendName}
                                            style={{
                                                width: 42,
                                                height: 42,
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: 42,
                                                height: 42,
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: '#334155',
                                                color: '#fff',
                                                fontWeight: 700,
                                            }}
                                        >
                                            {getInitials({
                                                username: friendUsername,
                                                display_name: friendName,
                                                name: friendName,
                                            })}
                                        </div>
                                    )}

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600 }}>
                                            {friendName}
                                        </div>

                                        {friendUsername ? (
                                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                                                @{friendUsername}
                                            </div>
                                        ) : null}
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        readOnly
                                        style={{ width: 18, height: 18 }}
                                    />
                                </button>
                            )
                        })
                    )}
                </div>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 10,
                        paddingTop: 8,
                    }}
                >
                    <Button onClick={onClose}>
                        Hủy
                    </Button>

                    <Button
                        type="primary"
                        icon={<Send size={16} />}
                        loading={sending}
                        disabled={selectedUserIds.length === 0}
                        onClick={handleSend}
                    >
                        Gửi
                    </Button>
                </div>
            </div>
        </Modal>
    )
}