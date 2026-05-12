import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ToastContainer, toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import 'react-toastify/dist/ReactToastify.css'
import MainLayout from '../../components/layout/MainLayout/MainLayout'
import { getDraftDetail, saveDraftWithAudio } from '../../utils/contentApi'
import { getToken } from '../../utils/auth'
import styles from '../../style/pages/EditAudioPage/EditAudioPage.module.css'
import { ArrowLeft, AlertCircle } from 'lucide-react'

export default function EditAudioPage() {
  const { t } = useTranslation()
  const { postId } = useParams()
  const navigate = useNavigate()
  const goBack = () => {
    const returnTo = sessionStorage.getItem('returnToAfterEdit') || '/feed'
    navigate(returnTo)
  }

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [post, setPost] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
  })
  const [originalForm, setOriginalForm] = useState({
    title: '',
    description: '',
  })
  const [errors, setErrors] = useState({})

  // Fetch post data
  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true)
        const response = await getDraftDetail(postId)
        const postData = response.data || response
        setPost(postData)
        const initialForm = {
          title: postData.title || '',
          description: postData.description || '',
        }
        setForm(initialForm)
        setOriginalForm(initialForm)
      } catch (err) {
        console.error('Failed to load post:', err)
        toast.error(t('editAudio.loadPostFailed'))
        navigate(`/feed?focusPostId=${postId}`)
      } finally {
        setLoading(false)
      }
    }

    if (postId) fetchPost()
  }, [postId, navigate])

  const hasChanges = () => {
    return form.title !== originalForm.title || form.description !== originalForm.description
  }

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!form.title.trim()) {
      newErrors.title = t('editAudio.titleRequired')
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    try {
      setSaving(true)

      const token = getToken()

      const res = await fetch(
        `http://localhost:8000/api/content/drafts/${postId}/update/`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description.trim(),
          }),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('editAudio.updateFailed'))
      }

      toast.success(t('editAudio.updateSuccess'))

      setTimeout(() => {
        setSaving(false)
        goBack()
      }, 700)
    } catch (err) {
      console.error('Save failed:', err)
      setSaving(false)
      toast.error(err.message || t('editAudio.updateFailed'))
    }
  }

  const autoResize = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  if (loading) {
    return (
      <MainLayout rightPanel={null} hideGlobalProgress>
        <div className={styles.container}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>{t('editAudio.loadingPost')}</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout rightPanel={null} hideGlobalProgress>
      <ToastContainer position="top-right" autoClose={2200} theme="dark" />
      <div className={styles.container}>
        <div className={styles.header}>
          <button
            className={styles.backBtn}
            onClick={goBack}
            aria-label={t('editAudio.back')}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className={styles.title}>{t('editAudio.pageTitle')}</h1>
        </div>

        <div className={styles.content}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('editAudio.titleLabel')}</label>
            <textarea
              className={`${styles.input} ${styles.autoTextarea} ${errors.title ? styles.error : ''}`}
              value={form.title}
              onChange={(e) => {
                handleChange('title', e.target.value)
                autoResize(e)
              }}
              onInput={autoResize}
              rows={1}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('editAudio.descriptionLabel')}</label>
            <textarea
              className={`${styles.textarea} ${styles.autoTextarea}`}
              value={form.description}
              onChange={(e) => {
                handleChange('description', e.target.value)
                autoResize(e)
              }}
              onInput={autoResize}
              rows={6}
            />
          </div>

          <div className={styles.actions}>
            <button
              className={styles.cancelBtn}
              onClick={goBack}
              disabled={saving}
            >
              {t('editAudio.cancel')}
            </button>

            <button
              className={styles.submitBtn}
              onClick={handleSave}
              disabled={saving || !hasChanges()}
            >
              {saving ? t('editAudio.saving') : t('editAudio.saveChanges')}
            </button>

            <button
              className={styles.backBtn}
              onClick={goBack}
              aria-label="Quay lại"
            >
              <ArrowLeft size={20} />
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
