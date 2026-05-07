import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import MainLayout from '../../components/layout/MainLayout/MainLayout'
import { getCategories, getTopics, publishPost, uploadAudioFile } from '../../utils/contentApi'
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
      let finalAudioUrl = form.audioUrl

      // Auto-upload if it's a blob URL (from device upload)
      if (form.audioUrl.startsWith('blob:')) {
        toast.info('Đang tải audio lên...')
        try {
          const response = await fetch(form.audioUrl)
          const blob = await response.blob()
          const file = new File([blob], 'audio.mp3', { type: blob.type })
          const result = await uploadAudioFile(file)
          finalAudioUrl = result.audio_url
          toast.success('Tải audio thành công!')
        } catch (error) {
          throw new Error('Không thể tải audio lên: ' + (error?.message || 'Lỗi không xác định'))
        }
      }

      const payload = {
        draft_id: form.draftId || null,
        title: form.title.trim(),
        description: form.description.trim(),
        original_text: form.originalText || form.script || '',
        transcript_text: form.script || '',
        audio_url: finalAudioUrl,
        duration_seconds: form.durationSeconds || null,
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

      const res = await publishPost(payload)

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
      toast.error((error?.message || 'Đăng bài thất bại. Vui lòng thử lại.'))
    } finally {
      setSubmitting(false)
    }
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
              onClick={() => navigate(-1)}
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
                <span className={styles.previewDuration}>
                  {formatDuration(form.durationSeconds)}
                </span>
              </div>

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
                  onClick={() => navigate(-1)}
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