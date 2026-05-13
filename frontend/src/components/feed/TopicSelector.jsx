import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import styles from '../../style/feed/TopicSelector.module.css'
import { useTagFilter } from '../contexts/TagFilterContext'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fetchUserTagPreferences,
  addTagPreference,
  removeTagPreference,
  fetchAvailableTags,
} from '../../utils/tagApi'

export default function TopicSelector() {
  const { t } = useTranslation()
  const [preferences, setPreferences] = useState([])
  const [availableTags, setAvailableTags] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const {
    selectedTagIds: activeFeedTagIds,
    updateSelectedTags,
    clearSelectedTags,
  } = useTagFilter()

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const prefs = await fetchUserTagPreferences()
      
      const tags = await fetchAvailableTags()
      
      setPreferences(prefs)
      setAvailableTags(tags)
    } catch (err) {
      // Fail silently: nếu backend lỗi/timeout thì chỉ hiển thị trạng thái rỗng
      setError(err?.message || t('tags.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddTag = async (tagId) => {
    try {
      setLoading(true)
      const newPref = await addTagPreference(tagId)
      setPreferences((prev) => [...prev, newPref])
      setShowDropdown(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTag = async (tagId) => {
    try {
      await removeTagPreference(tagId)
      setPreferences((prev) => prev.filter((p) => p.tag_id !== tagId))
      updateSelectedTags(
        (activeFeedTagIds || []).filter((id) => String(id) !== String(tagId))
      )
    } catch (err) {
      setError(err.message)
    }
  }

  const handleToggleFeedFilter = (tagId) => {
    const id = String(tagId)
    const current = (activeFeedTagIds || []).map(String)
    if (current.includes(id)) {
      updateSelectedTags(
        (activeFeedTagIds || []).filter((x) => String(x) !== id)
      )
    } else {
      updateSelectedTags([...(activeFeedTagIds || []), tagId])
    }
  }

  const preferenceTagIds = preferences.map((p) => p.tag_id)
  const unusedTags = availableTags.filter((t) => !preferenceTagIds.includes(t.id))

  return (
    <div className={styles.selectorSection}>
      <div className={styles.selectorHeader}>
        <h3 className={styles.selectorTitle}>{t('navigation.tags')}</h3>
        <button
          className={styles.addBtn}
          onClick={() => {
            console.log('🔘 + Button clicked!')
            setShowDropdown((prev) => !prev)
          }}
          type="button"
          disabled={loading}
          title={t('tags.addTag')}
        >
          <Plus size={16} />
        </button>
      </div>

      {(activeFeedTagIds || []).length > 0 && (
        <button
          type="button"
          className={styles.clearFilterBtn}
          onClick={() => clearSelectedTags()}
        >
          {t('tags.showAllPosts')}
        </button>
      )}

      <div className={styles.topicsList}>
        {preferences.length > 0 ? (
          <div>
            {preferences.map((pref) => {
              const active = (activeFeedTagIds || [])
                .map(String)
                .includes(String(pref.tag_id))
              return (
                <div
                  key={pref.tag_id}
                  className={`${styles.topicTag} ${active ? styles.topicTagFilterActive : ''}`}
                >
                  <button
                    type="button"
                    className={styles.topicTagLabelBtn}
                    onClick={() => handleToggleFeedFilter(pref.tag_id)}
                    title={t('tags.filterByOriginalTag')}
                  >
                    {pref.tag_name || pref.tag?.name || t('tags.unknown')}
                  </button>
                  <X
                    size={12}
                    className={styles.removeIcon}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveTag(pref.tag_id)
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          <p className={styles.emptyText}>
            {loading ? t('common.loading') : t('navigation.noTags')}
          </p>
        )}

        {showDropdown && (
          <div className={styles.availableTopicsSection}>
            {unusedTags.length > 0 ? (
              unusedTags.map((tag) => (
                <button
                  key={tag.id}
                  className={styles.availableTopicTag}
                  onClick={() => handleAddTag(tag.id)}
                  type="button"
                  disabled={loading}
                >
                  +{tag.name}
                </button>
              ))
            ) : (
              <p style={{ fontSize: '11px', color: '#aeb8da' }}>
                {t('tags.allSelected')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}