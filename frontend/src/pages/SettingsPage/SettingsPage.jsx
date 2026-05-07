import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Bell,
  BrainCircuit,
  Camera,
  Flame,
  Home,
  Link2,
  Lock,
  LogOut,
  Settings,
  ShieldAlert,
  Star,
  Upload,
  UserRound,
  Loader,
} from 'lucide-react'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import { useAuth } from '../../components/contexts/AuthContext'
import { getInitials } from '../../utils/getInitials'
import { showToast } from '../../utils/toast'
import { updateUserProfile, updateUserSettings, changePassword, deleteAccount, exportUserData } from '../../utils/usersApi'
import styles from '../../style/pages/SettingsPage/SettingsPage.module.css'

const TABS = [
  { id: 'account', label: 'Tài khoản', icon: UserRound },
  { id: 'notifications', label: 'Thông báo', icon: Bell },
  { id: 'ai', label: 'AI & Nội dung', icon: BrainCircuit },
  { id: 'privacy', label: 'Riêng tư', icon: Lock },
  { id: 'other', label: 'Khác', icon: Settings },
]

function Switch({ defaultChecked = false, onChange }) {
  return (
    <label className={styles.switch}>
      <input type="checkbox" defaultChecked={defaultChecked} onChange={onChange} />
      <span className={styles.slider}></span>
    </label>
  )
}

function AccountSummaryCard() {
  return (
    <div className={styles.accountCard}>
      <div className={styles.accountTop}>
        <div className={styles.accountBadge}>🔥</div>
        <div className={styles.accountMeta}>
          <h4>EduCast Pro</h4>
          <p>Còn 18 ngày · Tự động gia hạn</p>
        </div>
      </div>
      <button className={styles.premiumBtn}>Nâng cấp Premium</button>
    </div>
  )
}

function SettingsRightPanel({ onLogout }) {
  return (
    <aside className={styles.sidePanel}>
      <div className={styles.sideTitle}>
        <Home size={13} />
        <span>Tài khoản của bạn</span>
      </div>

      <AccountSummaryCard />

      <div className={styles.listenCard}>
        <span>Tổng giờ đã nghe</span>
        <strong>142h</strong>
        <small>↑ 12h so với tháng trước</small>
      </div>

      <div className={styles.miniStats}>
        <div className={styles.miniCard}>
          <span>Đã lưu</span>
          <strong>18</strong>
          <small>podcast</small>
        </div>

        <div className={styles.miniCard}>
          <span>Bộ sưu tập</span>
          <strong>4</strong>
          <small>danh sách</small>
        </div>
      </div>

      <div className={styles.streakCard}>
        <div className={styles.streakRow}>
          <Flame size={14} />
          <span>3 ngày liên tiếp</span>
        </div>
      </div>

      <div className={styles.levelCard}>
        <div className={styles.levelPill}>
          <Star size={13} />
          <span>Cấp 12</span>
        </div>
      </div>

      <div className={styles.activityCard}>
        <h4>Hoạt động gần đây</h4>

        <div className={styles.activityList}>
          <div className={styles.activityItem}>
            <Bell size={14} />
            <div>
              <b>Đổi email thành công</b>
              <span>2 ngày trước</span>
            </div>
          </div>

          <div className={styles.activityItem}>
            <BadgeCheck size={14} />
            <div>
              <b>Gia hạn Pro thành công</b>
              <span>12 ngày trước</span>
            </div>
          </div>

          <div className={styles.activityItem}>
            <ShieldAlert size={14} />
            <div>
              <b>Đăng nhập từ thiết bị mới</b>
              <span>18 ngày trước</span>
            </div>
          </div>

          <div className={styles.activityItem}>
            <Link2 size={14} />
            <div>
              <b>Liên kết Google thành công</b>
              <span>12 ngày trước</span>
            </div>
          </div>
        </div>
      </div>

      <button className={styles.logoutBtn} onClick={onLogout}>
        <LogOut size={17} />
        Đăng xuất
      </button>
    </aside>
  )
}

function AccountSettings({ profile, onProfileUpdate }) {
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [bio, setBio] = useState(profile.bio)
  const [isLoading, setIsLoading] = useState(false)
  const [avatar, setAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const previewAvatarFile = (file) => {
    setAvatar(file)

    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    previewAvatarFile(file)
  }

  const handleAvatarUploadOnly = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    previewAvatarFile(file)
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('display_name', displayName || profile.name)
      formData.append('bio', bio || '')
      formData.append('avatar', file)

      const result = await updateUserProfile(formData)
      const payload = result?.data || result?.user || {}
      const newAvatarUrl = payload.avatar_url

      if (newAvatarUrl) {
        setAvatarPreview(newAvatarUrl)
      }

      onProfileUpdate({
        name: payload.display_name || displayName,
        bio: payload.bio ?? bio,
        avatar_url: newAvatarUrl || avatarPreview,
      })

      showToast('Ảnh đại diện đã được cập nhật thành công', 'success')
    } catch (error) {
      setAvatarPreview(profile.avatar)
      showToast(error?.message || 'Đổi ảnh thất bại', 'error')
    } finally {
      setAvatar(null)
      setIsLoading(false)
      e.target.value = ''
    }
  }

  const handleSaveProfile = async () => {
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('display_name', displayName)
      formData.append('bio', bio)
      if (avatar) {
        formData.append('avatar', avatar)
      }

      const result = await updateUserProfile(formData)
      if (result) {
        showToast('Thông tin cá nhân đã được cập nhật thành công', 'success')
        // Update avatar preview with new URL if upload succeeded
        if (result.data && result.data.avatar_url) {
          setAvatarPreview(result.data.avatar_url)
        }
        onProfileUpdate({ name: displayName, bio: result.data?.bio, avatar_url: result.data?.avatar_url || avatarPreview })
        setIsEditing(false)
        setAvatar(null)
      }
    } catch (error) {
      console.error('Save profile error:', error)
      const errorMsg = error?.message || 'Cập nhật thất bại'
      showToast(errorMsg, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showToast('Mật khẩu xác nhận không khớp', 'error')
      return
    }
    if (newPassword.length < 6) {
      showToast('Mật khẩu phải có ít nhất 6 ký tự', 'error')
      return
    }

    setIsLoading(true)
    try {
      const result = await changePassword(oldPassword, newPassword)
      if (result) {
        showToast('Mật khẩu đã được thay đổi thành công', 'success')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setShowPasswordModal(false)
      }
    } catch (error) {
      showToast('Thay đổi mật khẩu thất bại', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardTitle}>
          <div className={styles.cardIcon}>
            <UserRound size={16} />
          </div>
          <h3>Thông tin cá nhân</h3>
        </div>

        {isEditing ? (
          <div className={styles.profileBox}>
            <div className={styles.avatar}>
              {avatarPreview && !avatarPreview.includes('ui-avatars') ? (
                <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <div className={styles.profileInfo}>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tên hiển thị"
                className={styles.input}
              />
              <input
                type="email"
                value={email}
                disabled
                placeholder="Email"
                className={styles.input}
              />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Bio giới thiệu"
                className={styles.textarea}
              />
              <div className={styles.profileActions}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                  id="avatar-upload"
                />
                <label htmlFor="avatar-upload" className={styles.inlineBtn} style={{ cursor: 'pointer', marginBottom: 0 }}>
                  <Camera size={12} />
                  Đổi ảnh
                </label>
                <button
                  className={styles.inlineBtn}
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader size={12} className={styles.spin} /> : '✓'} Lưu
                </button>
                <button
                  className={styles.inlineBtn}
                  onClick={() => {
                    setIsEditing(false)
                    setAvatar(null)
                    setAvatarPreview(profile.avatar)
                  }}
                >
                  ✕ Hủy
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.profileBox}>
            <div className={styles.avatar}>
              {avatarPreview && !avatarPreview.includes('ui-avatars') ? (
                <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                getInitials(profile.name)
              )}
            </div>
            <div className={styles.profileInfo}>
              <h4>{displayName}</h4>
              <p>{email}</p>
              <div className={styles.profileActions}>
                <button className={styles.inlineBtn} onClick={() => setIsEditing(true)}>✎ Chỉnh sửa</button>
                <button
                  className={styles.inlineBtn}
                  onClick={() => document.getElementById('avatar-upload-view')?.click()}
                >
                  <Camera size={12} />
                  Đổi ảnh
                </button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUploadOnly}
                  style={{ display: 'none' }}
                  id="avatar-upload-view"
                />
              </div>
            </div>
          </div>
        )}

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Tên hiển thị</span>
            <strong>{displayName}</strong>
            <button className={styles.smallBtn} onClick={() => setIsEditing(true)}>Sửa</button>
          </div>

          <div className={styles.infoRow}>
            <span>Email</span>
            <strong>{email}</strong>
            <button className={styles.smallBtn}>Sửa</button>
          </div>

          <div className={styles.infoRow}>
            <span>Mật khẩu</span>
            <strong>Đã thiết lập</strong>
            <button className={styles.smallBtn} onClick={() => setShowPasswordModal(true)}>Đổi</button>
          </div>

          <div className={styles.infoRow}>
            <span>Bio giới thiệu</span>
            <strong>{bio || 'Chưa cập nhật'}</strong>
            <button className={styles.smallBtn} onClick={() => setIsEditing(true)}>Sửa</button>
          </div>
        </div>
      </section>

      {showPasswordModal && (
        <section className={`${styles.card} ${styles.modal}`}>
          <div className={styles.cardTitle}>
            <h3>Đổi mật khẩu</h3>
          </div>
          <div className={styles.infoTable}>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Mật khẩu hiện tại"
              className={styles.input}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mật khẩu mới"
              className={styles.input}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Xác nhận mật khẩu mới"
              className={styles.input}
            />
            <div className={styles.profileActions}>
              <button
                className={styles.inlineBtn}
                onClick={handleChangePassword}
                disabled={isLoading}
              >
                {isLoading ? <Loader size={12} className={styles.spin} /> : '✓'} Xác nhận
              </button>
              <button className={styles.inlineBtn} onClick={() => setShowPasswordModal(false)}>
                ✕ Hủy
              </button>
            </div>
          </div>
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardTitle}>
          <div className={styles.cardIcon}>
            <Link2 size={16} />
          </div>
          <h3>Liên kết tài khoản</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Google</span>
            <strong>Đã liên kết</strong>
            <button className={styles.smallBtn}>Hủy liên kết</button>
          </div>
        </div>
      </section>

      <section className={`${styles.card} ${styles.dangerCard}`}>
        <div className={styles.cardTitle}>
          <div className={`${styles.cardIcon} ${styles.dangerIcon}`}>
            <ShieldAlert size={16} />
          </div>
          <h3>Vùng nguy hiểm</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Xóa tài khoản</span>
            <strong>Hành động này không thể hoàn tác</strong>
            <button className={styles.deleteBtn} onClick={() => {
              if (window.confirm('Bạn chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác')) {
                deleteAccount('')
              }
            }}>Xóa tài khoản</button>
          </div>
        </div>
      </section>
    </>
  )
}

function NotificationSettings() {
  const [settings, setSettings] = useState({
    email_notifications: true,
    push_notifications: true,
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSettingChange = async (key) => {
    const newValue = !settings[key]
    setSettings(prev => ({ ...prev, [key]: newValue }))

    setIsLoading(true)
    try {
      const updateData = { [key]: newValue }
      const result = await updateUserSettings(updateData)
      if (result) {
        showToast('Cấu hình thông báo đã được cập nhật', 'success')
      }
    } catch (error) {
      setSettings(prev => ({ ...prev, [key]: !newValue }))
      showToast('Cập nhật thất bại', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <div className={styles.cardIcon}>
          <Bell size={16} />
        </div>
        <h3>Thông báo</h3>
      </div>

      <div className={styles.infoTable}>
        <div className={styles.infoRow}>
          <span>Thông báo chung</span>
          <strong>{settings.push_notifications ? 'Bật' : 'Tắt'}</strong>
          <Switch defaultChecked={settings.push_notifications} onChange={() => handleSettingChange('push_notifications')} />
        </div>

        <div className={styles.infoRow}>
          <span>Thông báo email</span>
          <strong>{settings.email_notifications ? 'Bật' : 'Tắt'}</strong>
          <Switch defaultChecked={settings.email_notifications} onChange={() => handleSettingChange('email_notifications')} />
        </div>
      </div>
    </section>
  )
}


function AISettings() {
  const [settings, setSettings] = useState({
    aiRecommendations: true,
    aiContentCreation: 'allow',
  })

  // Note: AI settings are not in user_settings table yet
  // These are stored locally or in localStorage for now
  const handleAIRecommendationChange = () => {
    const newValue = !settings.aiRecommendations
    setSettings(prev => ({ ...prev, aiRecommendations: newValue }))
    localStorage.setItem('aiRecommendations', JSON.stringify(newValue))
    showToast('Cấu hình AI đã được cập nhật', 'success')
  }

  const handleAIContentChange = (value) => {
    setSettings(prev => ({ ...prev, aiContentCreation: value }))
    localStorage.setItem('aiContentCreation', JSON.stringify(value))
    showToast('Cấu hình tạo nội dung AI đã được cập nhật', 'success')
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <div className={styles.cardIcon}>
          <BrainCircuit size={16} />
        </div>
        <h3>AI & Nội dung</h3>
      </div>

      <div className={styles.infoTable}>
        <div className={styles.infoRow}>
          <span>Khuyến nghị AI</span>
          <strong>{settings.aiRecommendations ? 'Bật' : 'Tắt'}</strong>
          <Switch defaultChecked={settings.aiRecommendations} onChange={handleAIRecommendationChange} />
        </div>

        <div className={styles.infoRow}>
          <span>Tạo nội dung bằng AI</span>
          <div className={styles.aiContentOptions}>
            <button
              className={settings.aiContentCreation === 'allow' ? styles.active : ''}
              onClick={() => handleAIContentChange('allow')}
            >
              Cho phép
            </button>
            <button
              className={settings.aiContentCreation === 'review' ? styles.active : ''}
              onClick={() => handleAIContentChange('review')}
            >
              Yêu cầu phê duyệt
            </button>
            <button
              className={settings.aiContentCreation === 'deny' ? styles.active : ''}
              onClick={() => handleAIContentChange('deny')}
            >
              Không cho phép
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function PrivacySettings() {
  const [settings, setSettings] = useState({
    profile_visibility: 'private',
  })

  const visibilityOptions = [
    { value: 'public', label: 'Công khai', description: 'Bất kỳ ai cũng có thể xem hồ sơ của bạn' },
    { value: 'followers_only', label: 'Chỉ những người theo dõi', description: 'Chỉ những người theo dõi mới có thể xem' },
    { value: 'private', label: 'Riêng tư', description: 'Chỉ bạn có thể xem hồ sơ của mình' },
  ]

  const handleProfileVisibilityChange = async (newValue) => {
    setSettings(prev => ({ ...prev, profile_visibility: newValue }))
    try {
      const result = await updateUserSettings({
        profile_visibility: newValue
      })
      if (result) {
        showToast('Cấu hình riêng tư đã được cập nhật', 'success')
      }
    } catch (error) {
      setSettings(prev => ({ ...prev, profile_visibility: settings.profile_visibility }))
      showToast('Cập nhật thất bại', 'error')
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardTitle}>
        <div className={styles.cardIcon}>
          <Lock size={16} />
        </div>
        <h3>Riêng tư</h3>
      </div>

      <div className={styles.infoTable}>
        {visibilityOptions.map(option => (
          <div key={option.value} className={styles.infoRow} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <input
                type="radio"
                name="profile_visibility"
                value={option.value}
                checked={settings.profile_visibility === option.value}
                onChange={() => handleProfileVisibilityChange(option.value)}
                style={{ cursor: 'pointer' }}
              />
              <label style={{ cursor: 'pointer', flex: 1 }}>
                <strong>{option.label}</strong>
              </label>
            </div>
            <p style={{ margin: 0, marginLeft: '28px', fontSize: '12px', color: '#666' }}>
              {option.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function OtherSettings() {
  const [language, setLanguage] = useState('vi')

  const handleLanguageChange = async (lang) => {
    setLanguage(lang)
    try {
      const result = await updateUserSettings({ language_code: lang })
      if (result) {
        showToast('Ngôn ngữ đã được cập nhật', 'success')
        // Could reload page or update app language here
      }
    } catch (error) {
      showToast('Cập nhật thất bại', 'error')
    }
  }

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardTitle}>
          <div className={styles.cardIcon}>
            <Settings size={16} />
          </div>
          <h3>Khác</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Ngôn ngữ</span>
            <div className={styles.languageOptions}>
              <button
                className={language === 'vi' ? styles.active : ''}
                onClick={() => handleLanguageChange('vi')}
              >
                Tiếng Việt
              </button>
              <button
                className={language === 'en' ? styles.active : ''}
                onClick={() => handleLanguageChange('en')}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.card} ${styles.dangerCard}`}>
        <div className={styles.cardTitle}>
          <div className={`${styles.cardIcon} ${styles.dangerIcon}`}>
            <ShieldAlert size={16} />
          </div>
          <h3>Vùng nguy hiểm</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Xóa tài khoản</span>
            <strong>Hành động này không thể hoàn tác</strong>
            <button className={styles.deleteBtn} onClick={() => {
              if (window.confirm('Bạn chắc chắn muốn xóa tài khoản? Hành động này không thể hoàn tác')) {
                deleteAccount('')
              }
            }}>Xóa tài khoản</button>
          </div>
        </div>
      </section>
    </>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout, checkAuth } = useAuth()
  const [activeTab, setActiveTab] = useState('account')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (user) {
      const fallbackName =
        user?.full_name ||
        user?.name ||
        user?.display_name ||
        user?.username ||
        (user?.email ? user.email.split('@')[0] : 'User')

      setProfile({
        name: fallbackName,
        username: user?.username || '',
        email: user?.email || '',
        avatar: user?.avatar || user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=667eea&color=fff&size=120`,
        bio: user?.bio || '',
      })
    }
  }, [user])

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const handleProfileUpdate = async (updatedData) => {
    if (updatedData) {
      await checkAuth()
    }
  }

  const renderContent = () => {
    if (!profile) {
      return <div className={styles.loading}>Đang tải...</div>
    }

    switch (activeTab) {
      case 'account':
        return <AccountSettings profile={profile} onProfileUpdate={handleProfileUpdate} />
      case 'notifications':
        return <NotificationSettings />
      case 'ai':
        return <AISettings />
      case 'privacy':
        return <PrivacySettings />
      case 'other':
        return <OtherSettings />
      default:
        return <AccountSettings profile={profile} onProfileUpdate={handleProfileUpdate} />
    }
  }

  return (
    <MainLayout rightPanel={<SettingsRightPanel onLogout={handleLogout} />}>
      <div className={styles.page}>
        <div className={styles.headerLine}>
          <div className={styles.pageTitle}>
            <span className={styles.pageIcon}>⚙</span>
            <h2>Cài đặt</h2>
          </div>
        </div>

        <div className={styles.tabsContainer}>
          <div className={styles.tabs}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.contentArea}>{renderContent()}</div>
      </div>
    </MainLayout>
  )
}