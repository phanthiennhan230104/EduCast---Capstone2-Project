import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { toast } from 'react-toastify'
import styles from '../../style/feed/ShareModal.module.css'
import { getDraftDetail, updateDraft } from '../../utils/contentApi'
import { useTranslation } from 'react-i18next'

const labelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#e5e7eb',
  marginBottom: 6,
}

const errStyle = {
  fontSize: 12,
  color: '#fca5a5',
  margin: '4px 0 0',
}

export default function EditPostModal({
  isOpen,
  postId,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '' })
  const [original, setOriginal] = useState({ title: '', description: '' })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!isOpen || !postId) return

    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setErrors({})
        const response = await getDraftDetail(postId)
        const postData = response?.data ?? response ?? {}
        if (cancelled || !postData) return
        const next = {
          title: postData.title || '',
          description: postData.description || '',
        }
        setForm(next)
        setOriginal(next)
      } catch (err) {
        console.error(err)
        toast.error(t('editAudio.loadPostFailed'))
        onClose?.()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [isOpen, postId, onClose])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  if (!isOpen || !postId) return null

  const hasChanges =
    form.title !== original.title || form.description !== original.description

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validate = () => {
    const next = {}
    if (!form.title.trim()) {
      next.title = t('editAudio.titleRequired')
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!validate()) return

    try {
      setSaving(true)
      await updateDraft(postId, {
        title: form.title.trim(),
        description: form.description.trim(),
      })
      toast.success(t('editAudio.updateSuccess'))
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
      }
      setOriginal(payload)
      onSaved?.(payload)
      onClose?.()
    } catch (err) {
      console.error(err)
      toast.error(err.message || t('editAudio.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(ev) => ev.stopPropagation()}>
        <div className={styles.topBar}>
          <h2 className={styles.modalTitle}>{t('editAudio.pageTitle')}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('library.close')}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className={styles.shareForm}>
            <p
              style={{
                margin: 0,
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 14,
                padding: '8px 0 16px',
              }}
            >
              {t('editAudio.loadingPost')}
            </p>
          </div>
        ) : (
          <form className={styles.shareForm} onSubmit={handleSave}>
            <div style={labelStyle}>{t('editAudio.titleLabel')}</div>
            <div className={styles.textareaWrapper}>
              <div className={styles.textareaContainer}>
                <textarea
                  value={form.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className={styles.textarea}
                  rows={2}
                  style={{
                    minHeight: 48,
                    ...(errors.title
                      ? { borderColor: 'rgba(248, 113, 113, 0.55)' }
                      : {}),
                  }}
                />
              </div>
            </div>
            {errors.title ? <p style={errStyle}>{errors.title}</p> : null}

            <div style={{ ...labelStyle, marginTop: 12 }}>{t('editAudio.descriptionLabel')}</div>
            <div className={styles.textareaWrapper}>
              <div className={styles.textareaContainer}>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className={styles.textarea}
                  rows={6}
                  style={{ resize: 'vertical', maxHeight: 280 }}
                />
              </div>
            </div>

            <div className={styles.primaryActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={saving}
              >
                {t('editAudio.cancel')}
              </button>
              <button
                type="submit"
                className={styles.shareBtn}
                disabled={saving || !hasChanges}
              >
                {saving ? t('editAudio.saving') : t('editAudio.saveChanges')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}
