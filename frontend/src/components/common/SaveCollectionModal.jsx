import { useState, useEffect, useRef } from 'react'
import { X, Plus, Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { getToken } from '../../utils/auth'
import styles from '../../style/common/SaveCollectionModal.module.css'
import { useMemo } from 'react'

export default function SaveCollectionModal({ 
  isOpen, 
  onClose, 
  postId, 
  onSave,
  triggerRef, 
  isPopup = true 
}) {
  const { t } = useTranslation()
  const [collections, setCollections] = useState([])
  const [selectedCollectionId, setSelectedCollectionId] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [loading, setLoading] = useState(false)
  const [creatingCollection, setCreatingCollection] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 })
  const popupRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      fetchCollections()
      if (isPopup) {
        setTimeout(calculatePopupCenter, 0)
        window.addEventListener('resize', calculatePopupCenter)
        return () => window.removeEventListener('resize', calculatePopupCenter)
      }
    }
  }, [isOpen, isPopup])

  useEffect(() => {
    if (isPopup && isOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen, isPopup])

  const calculatePopupCenter = () => {
    if (!popupRef?.current) return

    const popupHeight = popupRef.current.offsetHeight || 400
    const popupWidth = popupRef.current.offsetWidth || 320

    const top = Math.max(
      (window.innerHeight - popupHeight) / 2,
      20
    )
    const left = Math.max(
      (window.innerWidth - popupWidth) / 2,
      20
    )

    setPopupPosition({ top, left })
  }

  const handleClickOutside = (e) => {
    if (popupRef?.current && !popupRef.current.contains(e.target)) {
        return
    }
    onClose()
  }

  const fetchCollections = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const token = getToken()
      
      const response = await fetch('http://127.0.0.1:8000/api/social/collections/', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        throw new Error(`Backend error (${response.status})`)
      }

      const data = await response.json()

      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`)

      if (data.success) {
        setCollections(data.data.collections || [])
        if (data.data.collections?.length > 0) {
          setCollections(data.data.collections || [])
          setSelectedCollectionId(null)
        }
      }
    } catch (err) {
      console.error('❌ Error fetching collections:', err)
      setLoadError(err.message)
      setCollections([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error(t('collection.enterCollectionName'))
      return
    }

    try {
      setCreatingCollection(true)
      const token = getToken()
      const response = await fetch('http://127.0.0.1:8000/api/social/collections/create/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newCollectionName.trim(),
          description: '',
        }),
      })

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        throw new Error(`Backend error (${response.status})`)
      }

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`)

      if (data.success) {
        const newCollection = data.data.collection
        setCollections([newCollection, ...collections])
        setSelectedCollectionId(newCollection.id)
        setNewCollectionName('')
        setShowCreateForm(false)
      }
    } catch (err) {
      console.error('❌ Error creating collection:', err)
      toast.error(t('collection.errorPrefix') + err.message)
    } finally {
      setCreatingCollection(false)
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const token = getToken()
      
      const response = await fetch(`http://127.0.0.1:8000/api/social/posts/${postId}/save/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          collection_id: selectedCollectionId || null,
        }),
      })

      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        throw new Error(`Backend error (${response.status})`)
      }

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`)

      if (data.success) {
        onSave?.(selectedCollectionId)
        onClose()
      }
    } catch (err) {
      console.error('❌ Error saving post:', err)
      toast.error(t('collection.errorPrefix') + err.message)
    } finally {
      setLoading(false)
    }
  }

  const sortedCollections = useMemo(() => {
    return [...collections].sort((a, b) => {
      const countDiff = (b.post_count || 0) - (a.post_count || 0)
      if (countDiff !== 0) return countDiff

      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
    })
  }, [collections])

  if (!isOpen) return null

  const containerClass = isPopup ? styles.popupContainer : styles.modalOverlay
  const contentClass = isPopup ? styles.popupContent : styles.modalContent

  return (
    <div 
      className={containerClass}
      onClick={(e) => e.stopPropagation()}
      ref={popupRef}
      style={isPopup ? { top: `${popupPosition.top}px`, left: `${popupPosition.left}px` } : {}}
    >
      <div 
        className={contentClass}
        onClick={e => !isPopup && e.stopPropagation()}
      >
        {!isPopup && (
          <div className={styles.header}>
            <h3>{t('collection.savePost')}</h3>
            <button className={styles.closeBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        )}

        {isPopup && (
          <div className={styles.popupHeader}>
            <h3>{t('collection.savePost')}</h3>
            <button className={styles.popupCloseBtn} onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        )}

        <div className={styles.body}>
          {loading && !loadError ? (
            <div className={styles.emptyState}>
              <div className={styles.spinner} />
              <p>{t('collection.loadingCollections')}</p>
            </div>
          ) : loadError ? (
            <div className={styles.emptyState}>
              <Folder size={32} />
              <p style={{ color: '#ff6b6b' }}>{t('collection.cannotLoadServer')}</p>
              <p style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>{t('collection.canCreateNew')}</p>
            </div>
          ) : sortedCollections.length > 0 ? (
            <div className={styles.section}>
              <div className={styles.collectionsList}>
                {sortedCollections.map(collection => (
                  <div
                    key={collection.id}
                    className={`${styles.collectionItem} ${selectedCollectionId === collection.id ? styles.selected : ''}`}
                    onClick={() => setSelectedCollectionId(collection.id)}
                  >
                    <Folder size={16} />
                    <div className={styles.collectionInfo}>
                      <div className={styles.collectionName}>{collection.name}</div>
                      <div className={styles.postCount}>{collection.post_count} {t('collection.posts')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Folder size={32} />
              <p>{t('collection.noCollections')}</p>
              <p style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>{t('collection.createToStart')}</p>
            </div>
          )}

          {showCreateForm ? (
            <div className={styles.createForm}>
              <input
                type="text"
                placeholder={t('collection.collectionNamePlaceholder')}
                value={newCollectionName}
                onChange={e => setNewCollectionName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleCreateCollection()}
                className={styles.input}
                autoFocus
              />
              <div className={styles.formActions}>
                <button
                  className={styles.createBtn}
                  onClick={handleCreateCollection}
                  disabled={creatingCollection}
                >
                  {creatingCollection ? '...' : t('collection.create')}
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewCollectionName('')
                  }}
                  disabled={creatingCollection}
                >
                  {t('collection.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              className={styles.newCollectionBtn}
              onClick={() => setShowCreateForm(true)}
              disabled={loadError ? false : false}
            >
              <Plus size={14} />
              {loadError ? t('collection.createToStart') : t('collection.newCollection')}
            </button>
          )}
        </div>

        <div className={styles.footer}>
          {!isPopup && (
            <button className={styles.cancelMainBtn} onClick={onClose}>
              {t('collection.cancel')}
            </button>
          )}
          <button 
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={loading}
            style={isPopup ? { flex: 1 } : {}}
          >
            {loading ? '...' : t('collection.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
