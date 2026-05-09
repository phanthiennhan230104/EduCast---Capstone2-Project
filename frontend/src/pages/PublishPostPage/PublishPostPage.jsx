import { useEffect, useMemo, useState } from 'react'
import { useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import {
  createDraft,
  getCategories,
  getTopics,
  publishPost,
  saveDraftWithAudio,
  updateDraft,
  uploadAudioFile,
} from '../../utils/contentApi'
import { getAudioDuration } from '../../utils/formatDuration'
import styles from '../../style/pages/PublishPostPage/PublishPostPage.module.css'

const AGE_GROUP_OPTIONS = [
  { value: '16_22', label: '16 - 22' },
  { value: '23_30', label: '23 - 30' },
  { value: '31_40', label: '31 - 40' },
]

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Công khai' },
  { value: 'private', label: 'Riêng tư' },
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

function normalizeCategoryList(raw) {
  const list = normalizeListResponse(raw)

  return list
    .map((item) => ({
      id: item?.id ?? item?.category_id ?? '',
      name: item?.name ?? item?.category_name ?? '',
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
      durationSeconds:
        draftData?.duration_seconds ||
        draftData?.durationSeconds ||
        draftData?.audio_versions?.find((item) => item?.is_default)?.duration_seconds ||
        0,
      categoryId: draftData?.category?.id || draftData?.category_id || '',
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
      ageGroup: draftData?.age_group || '',
      learningField: draftData?.learning_field || '',
      visibility: draftData?.visibility || 'public',
    }),
    [draftData]
  )

  const [form, setForm] = useState(initialForm)
  const [tagInput, setTagInput] = useState('')
  const [newTopicInput, setNewTopicInput] = useState('')
  const [newTopics, setNewTopics] = useState([])
  const [categories, setCategories] = useState([])
  const [topics, setTopics] = useState([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)
  const [showDraftModal, setShowDraftModal] = useState(false)
  const [drafts, setDrafts] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const hasDraftWork = useMemo(() => {
    return Boolean(
      form.audioUrl ||
        form.title.trim() ||
        form.description.trim() ||
        form.originalText.trim() ||
        form.script.trim() ||
        form.tags.length ||
        form.topicIds.length ||
        newTopics.length ||
        form.learningField.trim() ||
        form.categoryId ||
        form.ageGroup
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
    form.categoryId,
    form.ageGroup,
    newTopics.length,
  ])
  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const normalizeTag = (raw) => {
    if (!raw) return null

    const cleaned = raw
      .replace(/^#+/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')

    if (!cleaned) return null
    if (cleaned.length > 30) return null

    return cleaned
  }

  const normalizeTopicName = (raw) => {
    const cleaned = (raw || '').trim().replace(/\s+/g, ' ')
    if (!cleaned) return null
    if (cleaned.length > 100) return null
    return cleaned
  }

  const addTag = () => {
    const normalized = normalizeTag(tagInput)

    if (!normalized) {
      if (tagInput.trim()) toast.info('Tag không hợp lệ')
      return
    }

    if (form.tags.length >= MAX_TAGS) {
      toast.info(`Tối đa ${MAX_TAGS} tag`)
      return
    }

    if (form.tags.includes(normalized)) {
      setTagInput('')
      return
    }

    updateField('tags', [...form.tags, normalized])
    setTagInput('')
  }

  const removeTag = (tag) => {
    updateField(
      'tags',
      form.tags.filter((item) => item !== tag)
    )
  }

  
  const addNewTopic = () => {
    const normalized = normalizeTopicName(newTopicInput)

    if (!normalized) {
      if (newTopicInput.trim()) toast.info('Chủ đề mới không hợp lệ')
      return
    }

    const existsInNewTopics = newTopics.some(
      (item) => item.toLowerCase() === normalized.toLowerCase()
    )

    const existsInTopics = topics.some(
      (item) => item?.name?.toLowerCase() === normalized.toLowerCase()
    )

    if (existsInNewTopics || existsInTopics) {
      toast.info('Chủ đề này đã tồn tại')
      setNewTopicInput('')
      return
    }

    if (form.topicIds.length + newTopics.length >= MAX_TOPICS) {
      toast.info(`Tối đa ${MAX_TOPICS} chủ đề`)
      return
    }

    setNewTopics((prev) => [...prev, normalized])
    setNewTopicInput('')
  }

  const removeNewTopic = (topicName) => {
    setNewTopics((prev) => prev.filter((item) => item !== topicName))
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

    if (form.topicIds.length + newTopics.length >= MAX_TOPICS) {
      toast.info(`Tối đa ${MAX_TOPICS} chủ đề`)
      return
    }

    updateField('topicIds', [...form.topicIds, topicId])
  }

  useEffect(() => {
    let mounted = true

    const fetchMeta = async () => {
      try {
        setLoadingMeta(true)

        const [categoryRes, topicRes] = await Promise.all([
          getCategories(),
          getTopics(),
        ])

        if (!mounted) return

        setCategories(normalizeCategoryList(categoryRes))
        setTopics(normalizeTopicList(topicRes))
      } catch (error) {
        console.error(error)
        toast.error('Không tải được category/topic')
      } finally {
        if (mounted) setLoadingMeta(false)
      }
    }

    fetchMeta()

    return () => {
      mounted = false
    }
  }, [])

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
  }

  const handleNewTopicKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addNewTopic()
    }
  }

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

      toast.info('Đang tải audio lên...')

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

        toast.success('Tải audio thành công!')
      } catch (error) {
        throw new Error('Không thể tải audio lên: ' + (error?.message || 'Lỗi không xác định'))
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
      toast.info('Chưa có audio để đăng bài')
      return
    }

    if (!form.title.trim()) {
      toast.info('Vui lòng nhập tiêu đề')
      return
    }

    if (!form.ageGroup) {
      toast.info('Vui lòng chọn nhóm tuổi')
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
        category_id: form.categoryId || null,
        topic_ids: form.topicIds,
        new_topics: newTopics,
        tags: form.tags,
        age_group: form.ageGroup,
        learning_field: form.learningField.trim() || null,
        visibility: form.visibility,
        source_type: 'ai_generated',
        is_ai_generated: true,
      }

      console.log('Submitting payload:', payload)
      toast.info('Đang đăng bài...')

      await publishPost(payload)

      navigate('/feed', {
        state: {
          toast: {
            type: 'success',
            message: 'Đăng bài thành công! Bài viết của bạn đã được công bố lên feed.',
          },
          refreshFeed: true,
        },
      })
    } catch (error) {
      console.error('Publish error:', error)
      toast.error(error?.message || 'Đăng bài thất bại. Vui lòng thử lại.')
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
          voice_name: 'Minh Tuấn',
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
          voice_name: 'Minh Tuấn',
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

      toast.success('Đã lưu nháp')
      setShowLeaveConfirm(false)
      navigate(-1)
    } catch (error) {
      console.error('Save draft error:', error)
      toast.error(error?.message || 'Không thể lưu nháp')
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
      const token = localStorage.getItem('educast_access')

      const res = await fetch('http://localhost:8000/api/content/drafts/my/', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) throw new Error('Failed to load drafts')

      const data = await res.json()
      const draftList = Array.isArray(data) ? data : data.results || data.data || []
      setDrafts(draftList.filter((d) => d?.id))
    } catch (error) {
      console.error('Load drafts error:', error)
      toast.error('Không tải được bản nháp')
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
      categoryId: draft?.category?.id || draft?.category_id || prev.categoryId,
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
      toast.error('Vui lòng chọn tệp audio')
      return
    }

    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      toast.error('Tệp quá lớn. Tối đa 50MB')
      return
    }

    const audioUrl = URL.createObjectURL(file)
    setForm((prev) => ({ ...prev, audioUrl, durationSeconds: 0 }))

    try {
      const dur = await getAudioDuration(audioUrl)
      setForm((prev) => ({ ...prev, durationSeconds: dur }))
    } catch (err) {
      console.warn('Failed to read audio duration locally', err)
    }
  }

  const handleRemoveAudio = () => {
    // revoke object URL if any
    try {
      if (form.audioUrl && form.audioUrl.startsWith('blob:')) URL.revokeObjectURL(form.audioUrl)
    } catch (e) {}
    setForm((prev) => ({ ...prev, audioUrl: '', durationSeconds: 0 }))
  }

  return (
    <MainLayout rightPanel={null}>
      <div className={styles.page}>
        <div className={styles.hero}>
          <div>
            <h1 className={styles.title}>Chuẩn bị đăng bài</h1>
            <p className={styles.subtitle}>
              Hoàn thiện thông tin trước khi xuất bản audio lên feed cộng đồng.
            </p>
          </div>

          <div className={styles.heroActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={requestLeave}
            >
              Quay lại
            </button>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Đang đăng...' : 'Đăng bài'}
            </button>
          </div>
        </div>

        <div className={styles.layout}>
          <section className={styles.leftColumn}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Nội dung bài đăng</h2>
                  <p className={styles.cardDesc}>
                    Tối ưu tiêu đề, mô tả và phân loại để bài dễ được khám phá hơn.
                  </p>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Tiêu đề</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Ví dụ: Tư duy phản biện trong công việc hằng ngày"
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Mô tả ngắn</label>
                <textarea
                  className={`${styles.input} ${styles.textarea}`}
                  rows={4}
                  placeholder="Viết mô tả ngắn giúp người nghe hiểu nội dung chính..."
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Phân loại nội dung</h2>
                  <p className={styles.cardDesc}>
                    Chọn category, topic, tag và nhóm tuổi để bài dễ được khám phá hơn.
                  </p>
                </div>
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.field}>
                  <label className={styles.label}>Danh mục</label>
                  <select
                    className={styles.select}
                    value={form.categoryId}
                    onChange={(e) => updateField('categoryId', e.target.value)}
                    disabled={loadingMeta}
                  >
                    <option value="">Không chọn danh mục</option>
                    {categories.map((item) => (
                      <option key={`category-${item.id}`} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Nhóm tuổi</label>
                  <select
                    className={styles.select}
                    value={form.ageGroup}
                    onChange={(e) => updateField('ageGroup', e.target.value)}
                  >
                    <option value="">Chọn nhóm tuổi</option>
                    {AGE_GROUP_OPTIONS.map((item) => (
                      <option key={`age-${item.value}`} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Lĩnh vực học tập</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Ví dụ: Công nghệ, kinh doanh, kỹ năng mềm..."
                  value={form.learningField}
                  onChange={(e) => updateField('learningField', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  Chủ đề <span className={styles.helper}>Tối đa {MAX_TOPICS}</span>
                </label>

                <div className={styles.topicList}>
                  {topics.map((topic) => {
                    const active = form.topicIds.includes(topic.id)

                    return (
                      <button
                        key={`topic-${topic.id}`}
                        type="button"
                        className={`${styles.topicChip} ${
                          active ? styles.topicChipActive : ''
                        }`}
                        onClick={() => toggleTopic(topic.id)}
                      >
                        {topic.name}
                      </button>
                    )
                  })}
                </div>

                <div className={styles.newTopicComposer}>
                  <input
                    className={styles.tagInput}
                    type="text"
                    placeholder="Thêm chủ đề mới"
                    value={newTopicInput}
                    onChange={(e) => setNewTopicInput(e.target.value)}
                    onKeyDown={handleNewTopicKeyDown}
                  />
                  <button
                    type="button"
                    className={styles.tagAddButton}
                    onClick={addNewTopic}
                  >
                    Thêm chủ đề
                  </button>
                </div>

                <div className={styles.tagList}>
                  {newTopics.length === 0 ? (
                    <span className={styles.emptyText}>Chưa có chủ đề mới</span>
                  ) : (
                    newTopics.map((topicName) => (
                      <span key={`new-topic-${topicName}`} className={styles.tagChip}>
                        {topicName}
                        <button
                          type="button"
                          className={styles.tagRemove}
                          onClick={() => removeNewTopic(topicName)}
                          aria-label={`Xóa chủ đề ${topicName}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  Tag <span className={styles.helper}>Tối đa {MAX_TAGS}</span>
                </label>

                <div className={styles.tagComposer}>
                  <input
                    className={styles.tagInput}
                    type="text"
                    placeholder="Nhập tag rồi nhấn Enter"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                  />
                  <button
                    type="button"
                    className={styles.tagAddButton}
                    onClick={addTag}
                  >
                    Thêm
                  </button>
                </div>

                <div className={styles.tagList}>
                  {form.tags.length === 0 ? (
                    <span className={styles.emptyText}>Chưa có tag nào</span>
                  ) : (
                    form.tags.map((tag) => (
                      <span key={`tag-${tag}`} className={styles.tagChip}>
                        #{tag}
                        <button
                          type="button"
                          className={styles.tagRemove}
                          onClick={() => removeTag(tag)}
                          aria-label={`Xóa tag ${tag}`}
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Quyền riêng tư</label>
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
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <aside className={styles.rightColumn}>
            <div className={`${styles.card} ${styles.stickyCard}`}>
              <div className={styles.previewTop}>
                <span className={styles.previewBadge}>Xem trước audio</span>
                <div className={styles.previewTopActions}>
                  
                  {/* <span className={styles.previewDuration}>
                    {formatDuration(form.durationSeconds)}
                  </span> */}

                  <div className={styles.topCornerActions}>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={handleUploadClick}
                      title="Tải audio từ thiết bị"
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
                      title="Chọn từ bản nháp"
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
                      title="Tạo audio mới"
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
                    <h3 style={{ margin: 0, color: '#fff', fontSize: 20 }}>Thoát trang?</h3>
                    <p style={{ margin: '10px 0 0', color: 'rgba(245,240,232,0.72)', lineHeight: 1.6 }}>
                      Bạn đang có audio hoặc nội dung đang làm dở. Bạn có muốn lưu lại nháp trước khi rời đi không?
                    </p>

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
                        Rời đi
                      </button>

                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => setShowLeaveConfirm(false)}
                        disabled={submitting}
                      >
                        Ở lại
                      </button>

                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={saveCurrentDraft}
                        disabled={submitting}
                      >
                        {submitting ? 'Đang lưu...' : 'Lưu nháp'}
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
                      <h3 style={{ margin: 0 }}>Chọn bản nháp</h3>
                      <button
                        onClick={() => setShowDraftModal(false)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      {loadingDrafts ? (
                        <div style={{ color: 'rgba(255,255,255,0.7)' }}>Đang tải bản nháp...</div>
                      ) : drafts.length === 0 ? (
                        <div style={{ color: 'rgba(255,255,255,0.7)' }}>
                          Không có bản nháp nào
                          <div style={{ marginTop: 12 }}>
                            <button
                              className={styles.primaryButton}
                              onClick={() => {
                                setShowDraftModal(false)
                                navigate('/create')
                              }}
                            >
                              + Tạo bản nháp mới
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
                                <div style={{ fontWeight: 700, color: '#fff' }}>{draft.title || 'Không có tiêu đề'}</div>
                                <div style={{ color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>{draft.status || ''}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <h3 className={styles.previewTitle}>{form.title || 'Chưa có tiêu đề'}</h3>

              <p className={styles.previewDescription}>
                {form.description || 'Chưa có mô tả cho bài đăng này.'}
              </p>

              <div className={styles.audioBox}>
                {form.audioUrl ? (
                  <audio controls className={styles.audioPlayer}>
                    <source src={form.audioUrl} type="audio/mpeg" />
                    Trình duyệt không hỗ trợ audio.
                  </audio>
                ) : (
                  <div className={styles.audioEmpty}>Chưa có audio để phát</div>
                )}
              </div>

              <div className={styles.previewMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Danh mục</span>
                  <span className={styles.metaValue}>
                    {categories.find((item) => item.id === form.categoryId)?.name || '—'}
                  </span>
                </div>

                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Nhóm tuổi</span>
                  <span className={styles.metaValue}>
                    {AGE_GROUP_OPTIONS.find((item) => item.value === form.ageGroup)
                      ?.label || '—'}
                  </span>
                </div>

                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Chủ đề</span>
                  <div className={styles.metaTopicWrap}>
                    {form.topicIds.length === 0 && newTopics.length === 0 ? (
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
                        {newTopics.map((topicName) => (
                          <span
                            key={`new-topic-preview-${topicName}`}
                            className={styles.metaTopicTag}
                          >
                            {topicName}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Tag</span>
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
                  {submitting ? 'Đang đăng...' : 'Xuất bản ngay'}
                </button>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={requestLeave}
                  disabled={submitting}
                >
                  Hủy
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </MainLayout>
  )
}