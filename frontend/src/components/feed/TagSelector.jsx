import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import styles from '../../style/feed/TagSelector.module.css'
import { getToken } from '../../utils/auth'
import {
  fetchUserTagPreferences,
  addTagPreference,
  removeTagPreference,
  fetchAvailableTags,
} from '../../utils/tagApi'

export default function TagSelector() {
  const [preferences, setPreferences] = useState([])
  const [availableTags, setAvailableTags] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
      setError(err?.message || 'Failed to load tags')
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
    } catch (err) {
      setError(err.message)
    }
  }

  const selectedTagIds = preferences.map((p) => p.tag_id)
  const unusedTags = availableTags.filter((t) => !selectedTagIds.includes(t.id))

  return (
    <div className={styles.selectorSection}>
      <div className={styles.selectorHeader}>
        <h3 className={styles.selectorTitle}>Tags Yêu Thích</h3>
        <button
          className={styles.addBtn}
          onClick={() => {
            console.log('🔘 + Button clicked!')
            setShowDropdown((prev) => !prev)
          }}
          type="button"
          disabled={loading}
          title="Thêm tag"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className={styles.tagsList}>
        {preferences.length > 0 ? (
          <div>
            {preferences.map((pref) => (
              <div key={pref.tag_id} className={styles.tag}>
                {pref.tag_name || pref.tag?.name || 'N/A'}
                <X
                  size={12}
                  className={styles.removeIcon}
                  onClick={() => handleRemoveTag(pref.tag_id)}
                  style={{ cursor: 'pointer' }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>
            {loading ? 'Đang tải...' : 'Chưa có tag yêu thích'}
          </p>
        )}

        {showDropdown && (
          <div className={styles.availableTagsSection}>
            {unusedTags.length > 0 ? (
              unusedTags.map((tag) => (
                <button
                  key={tag.id}
                  className={styles.availableTag}
                  onClick={() => handleAddTag(tag.id)}
                  type="button"
                  disabled={loading}
                >
                  +{tag.name}
                </button>
              ))
            ) : (
              <p style={{ fontSize: '11px', color: '#aeb8da' }}>
                Tất cả tags đã được chọn
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
