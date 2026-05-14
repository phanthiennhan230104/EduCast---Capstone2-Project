import { useEffect, useMemo, useState } from 'react'
import { useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Select, ConfigProvider, theme as antTheme } from 'antd'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import { useTranslation } from 'react-i18next'
import {
  createDraft,
  getTopics,
  getTags,
  publishPost,
  saveDraftWithAudio,
  updateDraft,
  uploadAudioFile,
  uploadThumbnail,
} from '../../utils/contentApi'
import { getAudioDuration } from '../../utils/formatDuration'
import { getToken } from '../../utils/auth'
import styles from '../../style/pages/PublishPostPage/PublishPostPage.module.css'

const VISIBILITY_OPTIONS = [
  { value: 'public', labelKey: 'publishPost.visibility.public' },
  { value: 'private', labelKey: 'publishPost.visibility.private' },
]

const MAX_TAGS = 5
const MAX_TOPICS = 5

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return '—'
  const total = Number(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function cleanText(text) {
  return (text || '').replace(/\*\*/g, '').trim()
}

function getDisplayScript(draftData) {
  return cleanText(
    draftData?.summary_text ||
      draftData?.dialogue_script ||
      draftData?.transcript_text ||
      draftData?.original_text ||
      ''
  )
}

function normalizeListResponse(raw) {
  const data = raw?.data ?? raw ?? []
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

function normalizeTopicList(raw) {
  const list = normalizeListResponse(raw)

  return list
    .map((item) => ({
      id: item?.id ?? item?.topic_id ?? '',
      name: item?.name ?? item?.topic_name ?? '',
      slug: item?.slug ?? '',
    }))
    .filter((item) => item.id && item.name)
}

function toIntegerDuration(value) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue <= 0) return 0
  return Math.max(0, Math.round(numberValue))
}

export default function PublishPostPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const draftData = location.state?.draftData || null

  const initialForm = useMemo(
    () => ({
      draftId: draftData?.id || '',
      title: draftData?.title || '',
      description: draftData?.description || '',
      script: getDisplayScript(draftData),
      originalText: draftData?.original_text || '',
      audioUrl:
        draftData?.audio_url ||
        draftData?.audioUrl ||
        draftData?.audio_versions?.find((item) => item?.is_default)?.audio_url ||
        '',
      thumbnailUrl: draftData?.thumbnail_url || '',
      durationSeconds:
        draftData?.duration_seconds ||
        draftData?.durationSeconds ||
        draftData?.audio_versions?.find((item) => item?.is_default)?.duration_seconds ||
        0,
      topicIds: Array.isArray(draftData?.topics)
        ? draftData.topics
            .map((item) => item?.id ?? item?.topic_id ?? '')
            .filter(Boolean)
        : [],
      tags: Array.isArray(draftData?.tags)
        ? draftData.tags
            .map((item) => (typeof item === 'string' ? item : item?.name || ''))
            .filter(Boolean)
        : [],
      learningField: draftData?.learning_field || '',
      visibility: draftData?.visibility || 'public',
    }),
    [draftData]
  )

  const [form, setForm] = useState(initialForm)
  const [topics, setTopics] = useState([])
  const [availableTags, setAvailableTags] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)
  const thumbnailInputRef = useRef(null)
  const [showDraftModal, setShowDraftModal] = useState(false)
  const [drafts, setDrafts] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)

  const hasDraftWork = useMemo(() => {
    return Boolean(
      form.audioUrl ||
        form.title.trim() ||
        form.description.trim() ||
        form.originalText.trim() ||
        form.script.trim() ||
        form.tags.length ||
        form.topicIds.length ||
        form.learningField.trim() ||
        form.ageGroup ||
        form.thumbnailUrl
    )
  }, [
    form.audioUrl,
    form.title,
    form.description,
    form.originalText,
    form.script,
    form.tags.length,
    form.topicIds.length,
    form.learningField,
    form.ageGroup,
    form.thumbnailUrl,
  ])
  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleTagChange = (selectedTags) => {
    const normalized = selectedTags
      .map((raw) =>
        (raw || '')
          .replace(/^#+/, '')
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ')
      )
      .filter((t) => t && t.length <= 30)

    const unique = [...new Set(normalized)]

    if (unique.length > MAX_TAGS) {
      toast.info(t('publishPost.maxTags', { count: MAX_TAGS }))
      updateField('tags', unique.slice(0, MAX_TAGS))
      return
    }

    updateField('tags', unique)
  }

  const toggleTopic = (topicId) => {
    const exists = form.topicIds.includes(topicId)

    if (exists) {
      updateField(
        'topicIds',
        form.topicIds.filter((item) => item !== topicId)
      )
      return
    }

    if (form.topicIds.length >= MAX_TOPICS) {
      toast.info(t('publishPost.maxTopics', { count: MAX_TOPICS }))
      return
    }

    updateField('topicIds', [...form.topicIds, topicId])
  }

  const handleTopicChange = (selectedIds) => {
    if (selectedIds.length > MAX_TOPICS) {
      toast.info(t('publishPost.maxTopics', { count: MAX_TOPICS }))
      return
    }
    updateField('topicIds', selectedIds)
  }

  useEffect(() => {
    let mounted = true

    const fetchMeta = async () => {
      try {
        setLoadingMeta(true)
        const [topicRes, tagRes] = await Promise.all([getTopics(), getTags()])

        if (!mounted) return

        setTopics(normalizeTopicList(topicRes))

        const tagList = tagRes?.data ?? tagRes ?? []
        setAvailableTags(
          (Array.isArray(tagList) ? tagList : [])
            .map((item) => ({ value: item?.name ?? '', label: item?.name ?? '' }))
            .filter((item) => item.value)
        )
      } catch (error) {
        console.error(error)
        toast.error(t('publishPost.loadTopicsFailed'))
      } finally {
        if (mounted) setLoadingMeta(false)
      }
    }

    fetchMeta()

    return () => {
      mounted = false
    }
  }, [])


  const resolveAudioSource = async () => {
    let audioUrl = form.audioUrl
    let durationSeconds = toIntegerDuration(form.durationSeconds)
    let publicId = null

    if (!audioUrl) {
      return { audioUrl, durationSeconds, publicId }
    }

    if (audioUrl.startsWith('blob:')) {
      if (!durationSeconds) {
        durationSeconds = toIntegerDuration(await getAudioDuration(audioUrl))
        if (durationSeconds) {
          setForm((prev) => ({ ...prev, durationSeconds }))
        }
      }

      toast.info(t('publishPost.uploadingAudio'))

      try {
        const response = await fetch(audioUrl)
        const blob = await response.blob()
        const file = new File([blob], 'audio.mp3', {
          type: blob.type || 'audio/mpeg',
        })
        const result = await uploadAudioFile(file)

        audioUrl = result.audio_url
        publicId = result.public_id || null

        const uploadedDuration = toIntegerDuration(result.duration)
        durationSeconds =
          uploadedDuration || durationSeconds || toIntegerDuration(await getAudioDuration(form.audioUrl))

        if (durationSeconds) {
          setForm((prev) => ({ ...prev, durationSeconds }))
        }

        toast.success(t('publishPost.uploadAudioSuccess'))
      } catch (error) {
        throw new Error(
          t('publishPost.uploadAudioFailedWithMessage', {
            message: error?.message || t('publishPost.unknownError'),
          })
       )
      }
    } else if (!durationSeconds) {
      durationSeconds = toIntegerDuration(await getAudioDuration(audioUrl))
      if (durationSeconds) {
        setForm((prev) => ({ ...prev, durationSeconds }))
      }
    }

    return { audioUrl, durationSeconds, publicId }
  }

  const handleSubmit = async () => {
    if (!form.audioUrl) {
      toast.info(t('publishPost.noAudioToPublish'))
      return
    }

    if (!form.title.trim()) {
      toast.info(t('publishPost.titleRequired'))
      return
    }

    try {
      setSubmitting(true)
      const audioResult = await resolveAudioSource()

      const payload = {
        draft_id: form.draftId || null,
        title: form.title.trim(),
        description: form.description.trim(),
        original_text: form.originalText || form.script || '',
        transcript_text: form.script || '',
        audio_url: audioResult.audioUrl,
        duration_seconds: toIntegerDuration(audioResult.durationSeconds) || null,
        public_id: audioResult.publicId || null,
        thumbnail_url: form.thumbnailUrl || null,
        topic_ids: form.topicIds,
        tags: form.tags,
        learning_field: form.learningField.trim() || null,
        visibility: form.visibility,
        source_type: 'ai_generated',
        is_ai_generated: true,
      }

      console.log(t('publishPost.submittingPayloadLog'), payload)
      toast.info(t('publishPost.publishing'))

      await publishPost(payload)

      navigate('/feed', {
        state: {
          toast: {
            type: 'success',
            message: t('publishPost.publishSuccess'),
          },
          refreshFeed: true,
        },
      })
    } catch (error) {
      console.error(t('publishPost.publishErrorLog'), error)
       toast.error(error?.message || t('publishPost.publishFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const saveCurrentDraft = async () => {
    if (!hasDraftWork) return

    try {
      setSubmitting(true)

      const audioResult = form.audioUrl ? await resolveAudioSource() : null

      if (form.draftId) {
        await updateDraft(form.draftId, {
          title: form.title.trim(),
          description: form.description.trim(),
          original_text: form.originalText || form.script || '',
          summary_text: form.script || '',
          audio_url: audioResult?.audioUrl || form.audioUrl || '',
          public_id: audioResult?.publicId || null,
          voice_name: t('publishPost.defaultVoiceName'),
          format: 'mp3',
          duration_seconds: toIntegerDuration(audioResult?.durationSeconds || form.durationSeconds) || null,
          status: 'draft',
        })
      } else if (form.audioUrl) {
        await saveDraftWithAudio({
          title: form.title.trim(),
          description: form.description.trim(),
          original_text: form.originalText || form.script || '',
          source_type: 'ai_generated',
          mode: 'summary',
          processed_text: form.script || form.originalText || '',
          audio_url: audioResult?.audioUrl || form.audioUrl,
          public_id: audioResult?.publicId || null,
          voice_name: t('publishPost.defaultVoiceName'),
          format: 'mp3',
          duration_seconds: toIntegerDuration(audioResult?.durationSeconds || form.durationSeconds) || null,
        })
      } else {
        await createDraft({
          title: form.title.trim(),
          description: form.description.trim(),
          original_text: form.originalText || form.script || '',
          source_type: 'ai_generated',
        })
      }

      toast.success(t('publishPost.saveDraftSuccess'))
      setShowLeaveConfirm(false)
      navigate(-1)
    } catch (error) {
      console.error(t('publishPost.saveDraftErrorLog'), error)
      toast.error(error?.message || t('publishPost.saveDraftFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const requestLeave = () => {
    if (hasDraftWork) {
      setShowLeaveConfirm(true)
      return
    }

    navigate(-1)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const loadDrafts = async () => {
    try {
      setLoadingDrafts(true)
      const token = getToken()

      const res = await fetch('http://localhost:8000/api/content/drafts/my/', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) throw new Error(t('publishPost.loadDraftsFailed'))

      const data = await res.json()
      const draftList = Array.isArray(data) ? data : data.results || data.data || []
      setDrafts(draftList.filter((d) => d?.id))
    } catch (error) {
      console.error(t('publishPost.loadDraftsErrorLog'), error)
      toast.error(t('publishPost.loadDraftsFailed'))
    } finally {
      setLoadingDrafts(false)
    }
  }

  const handleDraftsClick = async () => {
    setShowDraftModal(true)
    await loadDrafts()
  }

  const handleDraftSelect = (draft) => {
    setShowDraftModal(false)
    // load draft into form
    setForm((prev) => ({
      ...prev,
      draftId: draft.id || '',
      title: draft.title || '',
      description: draft.description || '',
      script: getDisplayScript(draft) || '',
      originalText: draft.original_text || '',
      audioUrl: draft.audio_url || draft.audioUrl || '',
      durationSeconds: draft.duration_seconds || draft.durationSeconds || 0,
      topicIds: Array.isArray(draft?.topics)
        ? draft.topics.map((t) => t?.id ?? t?.topic_id ?? '').filter(Boolean)
        : prev.topicIds,
      tags: Array.isArray(draft?.tags)
        ? draft.tags.map((item) => (typeof item === 'string' ? item : item?.name || '')).filter(Boolean)
        : prev.tags,
    }))
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('audio/')) {
      toast.error(t('publishPost.selectAudioFile'))
      return
    }

    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      toast.error(t('publishPost.audioFileTooLarge'))
      return
    }

    const audioUrl = URL.createObjectURL(file)
    setForm((prev) => ({ ...prev, audioUrl, durationSeconds: 0 }))

    try {
      const dur = await getAudioDuration(audioUrl)
      setForm((prev) => ({ ...prev, durationSeconds: dur }))
    } catch (err) {
      console.warn(t('publishPost.readAudioDurationFailedLog'), err)
    }
  }

  const handleRemoveAudio = () => {
    // revoke object URL if any
    try {
      if (form.audioUrl && form.audioUrl.startsWith('blob:')) URL.revokeObjectURL(form.audioUrl)
    } catch (e) {}
    setForm((prev) => ({ ...prev, audioUrl: '', durationSeconds: 0 }))
  }

  const handleThumbnailClick = () => {
    thumbnailInputRef.current?.click()
  }

  const handleThumbnailSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error(t('publishPost.selectImageFile'))
      return
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast.error(t('publishPost.imageFileTooLarge'))
      return
    }

    try {
      setUploadingThumbnail(true)
      toast.info(t('publishPost.uploadingThumbnail'))
      
      const result = await uploadThumbnail(file)
      
      setForm((prev) => ({
        ...prev,
        thumbnailUrl: result.thumbnail_url,
      }))
      
      toast.success(t('publishPost.uploadThumbnailSuccess'))
    } catch (error) {
      console.error(t('publishPost.thumbnailUploadErrorLog'), error)
      toast.error(error?.message || t('publishPost.uploadThumbnailFailed'))
    } finally {
      setUploadingThumbnail(false)
    }
  }

  const handleRemoveThumbnail = () => {
    setForm((prev) => ({ ...prev, thumbnailUrl: '' }))
  }

  return (
    <MainLayout rightPanel={null}>
      <div className={styles.page}>
        <div className={styles.hero}>
          <div>
            <h1 className={styles.title}>{t('publishPost.pageTitle')}</h1>
            <p className={styles.subtitle}>
              {t('publishPost.pageSubtitle')}
            </p>
          </div>

          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={requestLeave}
            >
              {t('publishPost.back')}
            </button>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? t('publishPost.publishingShort') : t('publishPost.publishPost')}
            </button>
          </div>
        </div>

        <div className={styles.layout}>
          <section className={styles.leftColumn}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>{t('publishPost.contentTitle')}</h2>
                  <p className={styles.cardDesc}>
                    {t('publishPost.contentDesc')}
                  </p>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t('publishPost.titleLabel')}</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder={t('publishPost.titlePlaceholder')}
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t('publishPost.descriptionLabel')}</label>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  rows={4}
                  placeholder={t('publishPost.descriptionPlaceholder')}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>{t('publishPost.categoryTitle')}</h2>
                  <p className={styles.cardDesc}>
                    {t('publishPost.categoryDesc')}
                  </p>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t('publishPost.learningFieldLabel')}</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder={t('publishPost.learningFieldPlaceholder')}
                  value={form.learningField}
                  onChange={(e) => updateField('learningField', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  {t('publishPost.topicLabel')}{' '}
                  <span className={styles.helper}>
                    {t('publishPost.maxCount', { count: MAX_TOPICS })}
                  </span>
                </label>

                <ConfigProvider
                  theme={{
                    token: {
                      colorBgContainer: 'rgba(8, 12, 27, 0.74)',
                      colorBgElevated: '#101828',
                      colorBorder: 'rgba(245, 240, 232, 0.11)',
                      colorText: '#f5f0e8',
                      colorTextPlaceholder: 'rgba(245, 240, 232, 0.38)',
                      colorPrimary: '#f4a227',
                      borderRadius: 14,
                    },
                    components: {
                      Select: {
                        selectorBg: 'rgba(8, 12, 27, 0.74)',
                        multipleItemBg: 'rgba(244, 162, 39, 0.17)',
                        optionSelectedBg: 'rgba(244, 162, 39, 0.18)',
                        optionActiveBg: 'rgba(255, 255, 255, 0.06)',
                      },
                    },
                  }}
                >
                  <Select
                    className={styles.topicAntSelect}
                    mode="multiple"
                    allowClear
                    showSearch={{ optionFilterProp: 'label' }}
                    placeholder={t('publishPost.topicPlaceholder')}
                    value={form.topicIds}
                    onChange={handleTopicChange}
                    disabled={loadingMeta}
                    style={{ width: '100%' }}
                    options={topics.map((topic) => ({
                      value: topic.id,
                      label: topic.name,
                    }))}
                  />
                </ConfigProvider>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  {t('publishPost.tagLabel')}{' '}
                  <span className={styles.helper}>
                    {t('publishPost.maxCount', { count: MAX_TAGS })}
                  </span>
                </label>

                <ConfigProvider
                  theme={{
                    token: {
                      colorBgContainer: 'rgba(8, 12, 27, 0.74)',
                      colorBgElevated: '#101828',
                      colorBorder: 'rgba(245, 240, 232, 0.11)',
                      colorText: '#f5f0e8',
                      colorTextPlaceholder: 'rgba(245, 240, 232, 0.38)',
                      colorPrimary: '#f4a227',
                      borderRadius: 14,
                    },
                    components: {
                      Select: {
                        selectorBg: 'rgba(8, 12, 27, 0.74)',
                        multipleItemBg: 'rgba(244, 162, 39, 0.17)',
                        optionSelectedBg: 'rgba(244, 162, 39, 0.18)',
                        optionActiveBg: 'rgba(255, 255, 255, 0.06)',
                      },
                    },
                  }}
                >
                  <Select
                    className={styles.tagAntSelect}
                    mode="tags"
                    allowClear
                    tokenSeparators={[',']}
                    placeholder={t('publishPost.tagPlaceholder')}
                    value={form.tags}
                    onChange={handleTagChange}
                    disabled={loadingMeta}
                    style={{ width: '100%' }}
                    maxCount={MAX_TAGS}
                    options={availableTags}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </ConfigProvider>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>{t('publishPost.privacyLabel')}</label>
                <div className={styles.radioGroup}>
                  {VISIBILITY_OPTIONS.map((item) => (
                    <label key={`visibility-${item.value}`} className={styles.radioItem}>
                      <input
                        type="radio"
                        name="visibility"
                        value={item.value}
                        checked={form.visibility === item.value}
                        onChange={(e) => updateField('visibility', e.target.value)}
                      />
                      <span>{t(item.labelKey)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className={styles.rightColumn}>
            <div className={`${styles.card} ${styles.stickyCard}`}>
              <div className={styles.previewTop}>
                <span className={styles.previewBadge}>{t('publishPost.audioPreview')}</span>
                <div className={styles.previewTopActions}>
                  
                  {/* <span className={styles.previewDuration}>
                    {formatDuration(form.durationSeconds)}
                  </span> */}

                  <div className={styles.topCornerActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={handleUploadClick}
                      title={t('publishPost.uploadAudioTitle')}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" />
                        <path d="M12 2v7M9 6l3 3 3-3" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={handleDraftsClick}
                      title={t('publishPost.chooseDraftTitle')}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="19" x2="12" y2="13" />
                        <line x1="9" y1="16" x2="15" y2="16" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => navigate('/create')}
                      title={t('publishPost.createAudioTitle')}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Hidden file input for upload in publish page */}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />

              {showLeaveConfirm && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.62)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1400,
                  }}
                  onClick={() => setShowLeaveConfirm(false)}
                >
                  <div
                    style={{
                      width: 'min(92vw, 460px)',
                      borderRadius: 16,
                      padding: 20,
                      background: '#11172d',
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: '0 24px 60px rgba(0, 0, 0, 0.42)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ margin: 0, color: '#fff', fontSize: 20 }}>
                      {t('publishPost.leaveConfirmTitle')}
                    </h3>
                    <p style={{ margin: '10px 0 0', color: 'rgba(245,240,232,0.72)', lineHeight: 1.6 }}>
{t('publishPost.leaveConfirmMessage')}                    </p>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => {
                          setShowLeaveConfirm(false)
                          navigate(-1)
                        }}
                        disabled={submitting}
                      >
                        {t('publishPost.leave')}
                      </button>

                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setShowLeaveConfirm(false)}
                        disabled={submitting}
                      >
                        {t('publishPost.stay')}
                      </button>

                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={saveCurrentDraft}
                        disabled={submitting}
                      >
                        {submitting ? t('publishPost.saving') : t('publishPost.saveDraft')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showDraftModal && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1200,
                  }}
                  onClick={() => setShowDraftModal(false)}
                >
                  <div
                    style={{
                      width: '90%',
                      maxWidth: 760,
                      maxHeight: '80vh',
                      overflow: 'auto',
                      background: '#0e1224',
                      borderRadius: 12,
                      padding: 18,
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0 }}>{t('publishPost.chooseDraft')}</h3>
                      <button
                        onClick={() => setShowDraftModal(false)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      {loadingDrafts ? (
<div style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {t('publishPost.loadingDrafts')}
                        </div>                      ) : drafts.length === 0 ? (
                        <div style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {t('publishPost.noDrafts')}
                          <div style={{ marginTop: 12 }}>
                            <button
                              className={styles.primaryButton}
                              onClick={() => {
                                setShowDraftModal(false)
                                navigate('/create')
                              }}
                            >
                              + {t('publishPost.createDraft')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {drafts.map((draft) => (
                            <div
                              key={`modal-draft-${draft.id}`}
                              onClick={() => handleDraftSelect(draft)}
                              style={{
                                cursor: 'pointer',
                                padding: 12,
                                borderRadius: 8,
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.04)',
                                display: 'flex',
                                gap: 12,
                                alignItems: 'center',
                              }}
                            >
                              <div style={{ width: 56, height: 56, borderRadius: 8, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {draft.thumbnail_url ? (
                                  <img src={draft.thumbnail_url} alt={draft.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                                ) : (
                                  <div style={{ fontSize: 22 }}>🎙️</div>
                                )}
                              </div>

                              <div style={{ flex: 1 }}>
<div style={{ fontWeight: 700, color: '#fff' }}>
                                  {draft.title || t('publishPost.untitled')}
                                </div>                                <div style={{ color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>{draft.status || ''}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <h3 className={styles.previewTitle}>
                {form.title || t('publishPost.untitled')}
              </h3>

              <p className={styles.previewDescription}>
                {form.description || t('publishPost.noDescription')}
              </p>

              <div className={styles.audioBox}>
                {form.audioUrl ? (
                  <audio controls className={styles.audioPlayer}>
                    <source src={form.audioUrl} type="audio/mpeg" />
                    {t('publishPost.browserNotSupportAudio')}
                  </audio>
                ) : (
                  <div className={styles.audioEmpty}>{t('publishPost.noAudioToPlay')}</div>
                )}
              </div>

              <div className={styles.thumbnailBox}>
                <div className={styles.thumbnailLabel}>{t('publishPost.thumbnailLabel')}</div>
                {form.thumbnailUrl ? (
                  <div className={styles.thumbnailPreview}>
                    <img 
                      src={form.thumbnailUrl} 
                      alt={t('publishPost.thumbnailAlt')} 
                      className={styles.thumbnailImage}
                    />
                    <div className={styles.thumbnailActions}>
                      <button
                        type="button"
                        className={styles.thumbnailChangeBtn}
                        onClick={handleThumbnailClick}
                        disabled={uploadingThumbnail}
                      >
                        {t('publishPost.change')}
                      </button>
                      <button
                        type="button"
                        className={styles.thumbnailRemoveBtn}
                        onClick={handleRemoveThumbnail}
                        disabled={uploadingThumbnail}
                      >
                        {t('publishPost.remove')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.thumbnailUploadBtn}
                    onClick={handleThumbnailClick}
                    disabled={uploadingThumbnail}
                  >
                    {uploadingThumbnail
                      ? t('publishPost.uploading')
                      : t('publishPost.addThumbnail')}
                  </button>
                )}
              </div>

              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleThumbnailSelect}
              />

              <div className={styles.previewMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>{t('publishPost.topicLabel')}</span>
                  <div className={styles.metaTopicWrap}>
                    {form.topicIds.length === 0 ? (
                      <span className={styles.metaValue}>—</span>
                    ) : (
                      <>
                        {form.topicIds.map((id) => {
                          const topic = topics.find((item) => item?.id === id)
                          return (
                            <span key={`preview-topic-${id}`} className={styles.metaTopicTag}>
                              {topic?.name || id}
                            </span>
                          )
                        })}
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>{t('publishPost.tagLabel')}</span>
                  <div className={styles.metaTopicWrap}>
                    {form.tags.length === 0 ? (
                      <span className={styles.metaValue}>—</span>
                    ) : (
                      form.tags.map((tag) => (
                        <span key={`preview-tag-${tag}`} className={styles.metaTopicTag}>
                          #{tag}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.submitBox}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? t('publishPost.publishingShort') : t('publishPost.publishNow')}
                </button>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={requestLeave}
                  disabled={submitting}
                >
                  {t('publishPost.cancel')}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </MainLayout>
  )
}