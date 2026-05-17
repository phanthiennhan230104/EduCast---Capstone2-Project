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

  LogOut,
  Settings,
  Loader,
  Heart,
  Save,
  UserPlus,
  MessageSquare,
  Share2,
  UserRound,
  ShieldAlert,
} from 'lucide-react'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import { useAuth } from '../../components/contexts/AuthContext'
import { getInitials } from '../../utils/getInitials'
import { showToast } from '../../utils/toast'
import { updateUserProfile, updateUserSettings, changePassword, deleteAccount, exportUserData, getActivityLogs } from '../../utils/usersApi'

import { apiRequest } from '../../utils/api'
import { Select, ConfigProvider } from 'antd'
import styles from '../../style/pages/SettingsPage/SettingsPage.module.css'
import { useTranslation } from 'react-i18next'

const TABS = [
  { id: 'account', labelKey: 'settings.tabs.account', icon: UserRound },
  // { id: 'notifications', labelKey: 'settings.tabs.notifications', icon: Bell },
  // { id: 'ai', labelKey: 'settings.tabs.ai', icon: BrainCircuit },
  // { id: 'privacy', labelKey: 'settings.tabs.privacy', icon: Lock },
  { id: 'other', labelKey: 'settings.tabs.other', icon: Settings },
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
  const { t } = useTranslation()

}

function SettingsRightPanel({ onLogout }) {
  const { t } = useTranslation()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const result = await getActivityLogs()
        if (result.success && Array.isArray(result.data)) {
          setActivities(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch activity logs', error)
      } finally {
        setLoading(false)
      }
    }
    fetchActivities()
  }, [])

  const getTimeAgo = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) return t('common.time.justNow')
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) return `${diffInMinutes} ${t('common.time.minutesAgo')}`
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} ${t('common.time.hoursAgo')}`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 30) return `${diffInDays} ${t('common.time.daysAgo')}`
    return date.toLocaleDateString()
  }

  const getActivityIcon = (type) => {
    switch (type) {
      case 'created_post': return <Bell size={14} />
      case 'liked_post': return <Heart size={14} />
      case 'saved_post': return <Save size={14} />
      case 'followed_user': return <UserPlus size={14} />
      case 'commented_post': return <MessageSquare size={14} />
      case 'shared_post': return <Share2 size={14} />
      default: return <Bell size={14} />
    }
  }

  return (
    <aside className={styles.sidePanel}>
      <div className={styles.sideTitle}>
        <Home size={13} />
        <span>{t('settings.rightPanel.accountTitle')}</span>
      </div>

      <AccountSummaryCard />

      {/* <div className={styles.listenCard}>
        <span>Tổng giờ đã nghe</span>
        <strong>142h</strong>
        <small>↑ 12h so với tháng trước</small>
      </div> */}

      <div className={styles.miniStats}>
        <div className={styles.miniCard}>
          <span>{t('settings.rightPanel.saved')}</span>
          <strong>18</strong>
          <small>{t('settings.rightPanel.podcast')}</small>
        </div>

        <div className={styles.miniCard}>
          <span>{t('settings.rightPanel.collections')}</span>
          <strong>4</strong>
          <small>{t('settings.rightPanel.lists')}</small>
        </div>
      </div>

      <div className={styles.activityCard}>
        <h4>{t('settings.rightPanel.recentActivity')}</h4>

        <div className={styles.activityList}>
          {loading ? (
            <div className={styles.loadingActivity}>
              <Loader size={16} className={styles.spin} />
            </div>
          ) : activities.length > 0 ? (
            activities.map((item) => (
              <div key={item.id} className={styles.activityItem}>
                {getActivityIcon(item.activity_type)}
                <div>
                  <b>{t(`settings.rightPanel.activities.${item.activity_type}`)}</b>
                  <span>{getTimeAgo(item.created_at)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.noActivity}>
              <span>{t('settings.rightPanel.noActivity')}</span>
            </div>
          )}
        </div>
      </div>

      <button className={styles.logoutBtn} onClick={onLogout}>
        <span className={styles.logoutIcon}>
          <LogOut size={12} />
        </span>
        <span>{t('header.logout')}</span>
      </button>
    </aside>
  )
}

function AccountSettings({ profile, onProfileUpdate }) {
  const { t } = useTranslation()
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
  const [favoriteTopics, setFavoriteTopics] = useState(profile.favorite_topics?.map(t => t.id) || [])
  const [availableTopics, setAvailableTopics] = useState([])

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const res = await apiRequest('/content/topics/')
        if (res && res.data && Array.isArray(res.data)) {
          setAvailableTopics(res.data)
        }
      } catch (err) {
        console.error('Error fetching topics:', err)
      }
    }
    fetchTopics()
  }, [])

  const toggleTopic = (topicId) => {
    setFavoriteTopics(prev =>
      prev.includes(topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    )
  }

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

      showToast(t('settings.account.avatarUpdated'), 'success')
    } catch (error) {
      setAvatarPreview(profile.avatar)
      showToast(error?.message || t('settings.account.avatarUpdateFailed'), 'error')
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
      formData.append('favorite_topics', JSON.stringify(favoriteTopics))
      if (avatar) {
        formData.append('avatar', avatar)
      }

      const result = await updateUserProfile(formData)
      if (result) {
        showToast(t('settings.account.profileUpdated'), 'success')
        // Update avatar preview with new URL if upload succeeded
        if (result.data && result.data.avatar_url) {
          setAvatarPreview(result.data.avatar_url)
        }
        onProfileUpdate({ name: displayName, bio: result.data?.bio, avatar_url: result.data?.avatar_url || avatarPreview })
        setIsEditing(false)
        setAvatar(null)
      }
    } catch (error) {
      console.error(t('settings.account.saveProfileErrorLog'), error)
      const errorMsg = error?.message || t('settings.account.updateFailed')
      showToast(errorMsg, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showToast(t('settings.account.passwordMismatch'), 'error')
      return
    }
    if (newPassword.length < 6) {
      showToast(t('settings.account.passwordMin'), 'error')
      return
    }

    setIsLoading(true)
    try {
      const result = await changePassword(oldPassword, newPassword)
      if (result) {
        showToast(t('settings.account.passwordChanged'), 'success')
        setOldPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setShowPasswordModal(false)
      }
    } catch (error) {
      showToast(t('settings.account.passwordChangeFailed'), 'error')
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
          <h3>{t('settings.account.title')}</h3>
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
                placeholder={t('settings.account.displayName')}
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
                placeholder={t('settings.account.bio')}
                className={styles.textarea}
              />

              <div className={styles.topicsSection} style={{ marginTop: '10px' }}>
                <ConfigProvider
                  theme={{
                    token: {
                      colorBgContainer: 'rgba(255, 255, 255, 0.03)',
                      colorBgElevated: '#1c214a',
                      colorBorder: 'rgba(255, 255, 255, 0.12)',
                      colorText: '#f5f0e7',
                      colorTextPlaceholder: '#8f95b5',
                      colorPrimary: '#f0a84c',
                      borderRadius: 6,
                    },
                    components: {
                      Select: {
                        selectorBg: 'rgba(255, 255, 255, 0.03)',
                        multipleItemBg: 'rgba(240, 168, 76, 0.18)',
                        optionSelectedBg: 'rgba(240, 168, 76, 0.18)',
                        optionActiveBg: 'rgba(255, 255, 255, 0.06)',
                      },
                    },
                  }}
                >
                  <Select
                    mode="multiple"
                    placeholder={t('personal.favoriteTopics')}
                    value={favoriteTopics}
                    onChange={(values) => setFavoriteTopics(values)}
                    className={styles.customSelect}
                    classNames={{ popup: { root: 'custom-select-dropdown' } }}
                    style={{ width: '100%' }}
                    options={availableTopics.map(t => ({ label: t.name, value: t.id }))}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </ConfigProvider>
              </div>

              <div className={styles.profileActions} style={{ marginTop: '16px' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                  id="avatar-upload"
                />
                <label htmlFor="avatar-upload" className={styles.inlineBtn} style={{ cursor: 'pointer', marginBottom: 0 }}>
                  <Camera size={12} />
                  {t('settings.account.changeAvatar')}
                </label>
                <button
                  className={styles.inlineBtn}
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader size={12} className={styles.spin} /> : '✓'} {t('settings.account.save')}
                </button>
                <button
                  className={styles.inlineBtn}
                  onClick={() => {
                    setIsEditing(false)
                    setAvatar(null)
                    setAvatarPreview(profile.avatar)
                  }}
                >
                  ✕ {t('settings.account.cancel')}
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
                <button className={styles.inlineBtn} onClick={() => setIsEditing(true)}>✎ {t('settings.account.edit')}</button>
                <button
                  className={styles.inlineBtn}
                  onClick={() => document.getElementById('avatar-upload-view')?.click()}
                >
                  <Camera size={12} />
                  {t('settings.account.changeAvatar')}
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
            <span>{t('settings.account.displayName')}</span>
            <strong>{displayName}</strong>
            <button className={styles.smallBtn} onClick={() => setIsEditing(true)}>{t('settings.account.editShort')}</button>
          </div>

          <div className={styles.infoRow}>
            <span>Email</span>
            <strong>{email}</strong>
            <button className={styles.smallBtn}>{t('settings.account.editShort')}</button>
          </div>

          <div className={styles.infoRow}>
            <span>{t('settings.account.password')}</span>
            <strong>{t('settings.account.passwordSet')}</strong>
            <button className={styles.smallBtn} onClick={() => setShowPasswordModal(true)}>{t('settings.account.change')}</button>
          </div>

          <div className={styles.infoRow}>
            <span>{t('settings.account.bio')}</span>
            <strong>{bio || t('settings.account.notUpdated')}</strong>
            <button className={styles.smallBtn} onClick={() => setIsEditing(true)}>{t('settings.account.editShort')}</button>
          </div>

          <div className={styles.infoRow} style={{ borderBottom: 'none' }}>
            <span>{t('personal.favoriteTopics')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profile.favorite_topics && profile.favorite_topics.length > 0 ? (
                profile.favorite_topics.map(t => (
                  <span key={t.id} style={{ fontSize: '12px', background: '#374151', padding: '2px 8px', borderRadius: '12px' }}>
                    {t.name}
                  </span>
                ))
              ) : (
                <strong>{t('settings.account.notUpdated')}</strong>
              )}
            </div>
            <button className={styles.smallBtn} onClick={() => setIsEditing(true)}>{t('settings.account.editShort')}</button>
          </div>
        </div>
      </section>

      {showPasswordModal && (
        <section className={`${styles.card} ${styles.modal}`}>
          <div className={styles.cardTitle}>
            <h3>{t('settings.account.changePassword')}</h3>
          </div>
          <div className={styles.infoTable}>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder={t('settings.account.currentPassword')}
              className={styles.input}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('settings.account.newPassword')}
              className={styles.input}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('settings.account.confirmNewPassword')}
              className={styles.input}
            />
            <div className={styles.profileActions}>
              <button
                className={styles.inlineBtn}
                onClick={handleChangePassword}
                disabled={isLoading}
              >
                {isLoading ? <Loader size={12} className={styles.spin} /> : '✓'} {t('settings.account.confirm')}
              </button>
              <button className={styles.inlineBtn} onClick={() => setShowPasswordModal(false)}>
                ✕ {t('settings.account.cancel')}
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
          <h3>{t('settings.account.linkAccount')}</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>Google</span>
            <strong>{t('settings.account.linked')}</strong>
            <button className={styles.smallBtn}>{t('settings.account.unlink')}</button>
          </div>
        </div>
      </section>

      <section className={`${styles.card} ${styles.dangerCard}`}>
        <div className={styles.cardTitle}>
          <div className={`${styles.cardIcon} ${styles.dangerIcon}`}>
            <ShieldAlert size={16} />
          </div>
          <h3>{t('settings.account.dangerZone')}</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>{t('settings.account.deleteAccount')}</span>
            <strong>{t('settings.account.deleteAccountWarning')}</strong>
            <button className={styles.deleteBtn} onClick={() => {
              if (window.confirm(t('settings.account.deleteConfirm'))) {
                deleteAccount('')
              }
            }}>{t('settings.account.deleteAccount')}</button>
          </div>
        </div>
      </section>
    </>
  )
}

// function NotificationSettings() {
//   const { t } = useTranslation()
//   const [settings, setSettings] = useState({
//     email_notifications: true,
//     push_notifications: true,
//   })
//   const [isLoading, setIsLoading] = useState(false)

//   const handleSettingChange = async (key) => {
//     const newValue = !settings[key]
//     setSettings(prev => ({ ...prev, [key]: newValue }))

//     setIsLoading(true)
//     try {
//       const updateData = { [key]: newValue }
//       const result = await updateUserSettings(updateData)
//       if (result) {
//         showToast(t('settings.notifications.updated'), 'success')
//       }
//     } catch (error) {
//       setSettings(prev => ({ ...prev, [key]: !newValue }))
//       showToast(t('settings.notifications.updateFailed'), 'error')
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   return (
//     <section className={styles.card}>
//       <div className={styles.cardTitle}>
//         <div className={styles.cardIcon}>
//           <Bell size={16} />
//         </div>
//         <h3>{t('settings.notifications.title')}</h3>
//       </div>

//       <div className={styles.infoTable}>
//         <div className={styles.infoRow}>
//           <span>{t('settings.notifications.general')}</span>
//           <strong>
//             {settings.push_notifications
//               ? t('settings.notifications.on')
//               : t('settings.notifications.off')}
//           </strong>
//           <Switch defaultChecked={settings.push_notifications} onChange={() => handleSettingChange('push_notifications')} />
//         </div>

//         <div className={styles.infoRow}>
//           <span>{t('settings.notifications.email')}</span>
//           <strong>
//             {settings.email_notifications
//               ? t('settings.notifications.on')
//               : t('settings.notifications.off')}
//           </strong>
//           <Switch defaultChecked={settings.email_notifications} onChange={() => handleSettingChange('email_notifications')} />
//         </div>
//       </div>
//     </section>
//   )
// }


// function AISettings() {
//   const { t } = useTranslation()
//   const [settings, setSettings] = useState({
//     aiRecommendations: true,
//     aiContentCreation: 'allow',
//   })

//   // Note: AI settings are not in user_settings table yet
//   // These are stored locally or in localStorage for now
//   const handleAIRecommendationChange = () => {
//     const newValue = !settings.aiRecommendations
//     setSettings(prev => ({ ...prev, aiRecommendations: newValue }))
//     localStorage.setItem('aiRecommendations', JSON.stringify(newValue))
//     showToast(t('settings.ai.recommendationsUpdated'), 'success')
//   }

//   const handleAIContentChange = (value) => {
//     setSettings(prev => ({ ...prev, aiContentCreation: value }))
//     localStorage.setItem('aiContentCreation', JSON.stringify(value))
//     showToast(t('settings.ai.contentCreationUpdated'), 'success')
//   }

//   return (
//     <section className={styles.card}>
//       <div className={styles.cardTitle}>
//         <div className={styles.cardIcon}>
//           <BrainCircuit size={16} />
//         </div>
//         <h3>{t('settings.ai.title')}</h3>
//       </div>

//       <div className={styles.infoTable}>
//         <div className={styles.infoRow}>
//           <span>{t('settings.ai.recommendations')}</span>
//           <strong>
//             {settings.aiRecommendations ? t('settings.ai.on') : t('settings.ai.off')}
//           </strong>
//           <Switch defaultChecked={settings.aiRecommendations} onChange={handleAIRecommendationChange} />
//         </div>

//         <div className={styles.infoRow}>
//           <span>{t('settings.ai.contentCreation')}</span>
//           <div className={styles.aiContentOptions}>
//             <button
//               className={settings.aiContentCreation === 'allow' ? styles.active : ''}
//               onClick={() => handleAIContentChange('allow')}
//             >
//               {t('settings.ai.allow')}
//             </button>
//             <button
//               className={settings.aiContentCreation === 'review' ? styles.active : ''}
//               onClick={() => handleAIContentChange('review')}
//             >
//               {t('settings.ai.review')}
//             </button>
//             <button
//               className={settings.aiContentCreation === 'deny' ? styles.active : ''}
//               onClick={() => handleAIContentChange('deny')}
//             >
//               {t('settings.ai.deny')}
//             </button>
//           </div>
//         </div>
//       </div>
//     </section>
//   )
// }

// function PrivacySettings() {
//   const { t } = useTranslation()
//   const [settings, setSettings] = useState({
//     profile_visibility: 'private',
//   })

//   const visibilityOptions = [
//     {
//       value: 'public',
//       label: t('settings.privacy.options.public.label'),
//       description: t('settings.privacy.options.public.description'),
//     },
//     {
//       value: 'followers_only',
//       label: t('settings.privacy.options.followersOnly.label'),
//       description: t('settings.privacy.options.followersOnly.description'),
//     },
//     {
//       value: 'private',
//       label: t('settings.privacy.options.private.label'),
//       description: t('settings.privacy.options.private.description'),
//     },
//   ]

//   const handleProfileVisibilityChange = async (newValue) => {
//     setSettings(prev => ({ ...prev, profile_visibility: newValue }))
//     try {
//       const result = await updateUserSettings({
//         profile_visibility: newValue
//       })
//       if (result) {
//         showToast(t('settings.privacy.visibilityUpdated'), 'success')
//       }
//     } catch (error) {
//       setSettings(prev => ({ ...prev, profile_visibility: settings.profile_visibility }))
//       showToast(t('settings.privacy.updateFailed'), 'error')
//     }
//   }

//   return (
//     <section className={styles.card}>
//       <div className={styles.cardTitle}>
//         <div className={styles.cardIcon}>
//           <Lock size={16} />
//         </div>
//         <h3>{t('settings.privacy.title')}</h3>
//       </div>

//       <div className={styles.infoTable}>
//         {visibilityOptions.map(option => (
//           <div key={option.value} className={styles.infoRow} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
//             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
//               <input
//                 type="radio"
//                 name="profile_visibility"
//                 value={option.value}
//                 checked={settings.profile_visibility === option.value}
//                 onChange={() => handleProfileVisibilityChange(option.value)}
//                 style={{ cursor: 'pointer' }}
//               />
//               <label style={{ cursor: 'pointer', flex: 1 }}>
//                 <strong>{option.label}</strong>
//               </label>
//             </div>
//             <p style={{ margin: 0, marginLeft: '28px', fontSize: '12px', color: '#666' }}>
//               {option.description}
//             </p>
//           </div>
//         ))}
//       </div>
//     </section>
//   )
// }

function OtherSettings() {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState(
    (i18n.resolvedLanguage || i18n.language || 'vi').split('-')[0]
  )

  useEffect(() => {
    setLanguage((i18n.resolvedLanguage || i18n.language || 'vi').split('-')[0])
  }, [i18n.language])

  const handleLanguageChange = async (lang) => {
    setLanguage(lang)
    await i18n.changeLanguage(lang)
    localStorage.setItem('i18nextLng', lang)

    try {
      const result = await updateUserSettings({ language_code: lang })
      if (result) {
        showToast(t('settings.toast.languageUpdated'), 'success')
      }
    } catch (error) {
      showToast(t('settings.toast.updateFailed'), 'error')
    }
  }

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardTitle}>
          <div className={styles.cardIcon}>
            <Settings size={16} />
          </div>
          <h3>{t('settings.other.title')}</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>{t('settings.other.language')}</span>
            <div className={styles.languageOptions}>
              <button
                className={language === 'vi' ? styles.active : ''}
                onClick={() => handleLanguageChange('vi')}
              >
                {t('settings.language.vi')}
              </button>

              <button
                className={language === 'en' ? styles.active : ''}
                onClick={() => handleLanguageChange('en')}
              >
                {t('settings.language.en')}
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
          <h3>{t('settings.other.dangerZone')}</h3>
        </div>

        <div className={styles.infoTable}>
          <div className={styles.infoRow}>
            <span>{t('settings.other.deleteAccount')}</span>
            <strong>{t('settings.other.deleteAccountWarning')}</strong>
            <button
              className={styles.deleteBtn}
              onClick={() => {
                if (window.confirm(t('settings.other.deleteConfirm'))) {
                  deleteAccount('')
                }
              }}
            >
              {t('settings.other.deleteAccount')}
            </button>
          </div>
        </div>
      </section>
    </>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
        (user?.email ? user.email.split('@')[0] : t('settings.account.userFallback'))

      setProfile({
        name: fallbackName,
        username: user?.username || '',
        email: user?.email || '',
        avatar: user?.avatar || user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=667eea&color=fff&size=120`,
        bio: user?.bio || '',
        favorite_topics: user?.favorite_topics || [],
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
      return <div className={styles.loading}>{t('common.loading')}</div>
    }

    switch (activeTab) {
      case 'account':
        return <AccountSettings profile={profile} onProfileUpdate={handleProfileUpdate} />
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
            <h2>{t('settings.pageTitle')}</h2>
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
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.contentArea}>{renderContent()}</div>
      </div>
    </MainLayout>
  )
}