import { useState, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import styles from '../../style/feed/TagSelector.module.css'
import { getToken } from '../../utils/auth'
import { useTagFilter } from '../contexts/TagFilterContext'
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
  const { updateSelectedTags } = useTagFilter()

  useEffect(() => {
    console.log('🎯 TagSelector Component Mounted!')
    loadTags()
  }, [])

  // Update context when preferences change
  useEffect(() => {
    const selectedIds = preferences.map((p) => p.tag_id)
    updateSelectedTags(selectedIds)
    console.log('📢 Updated context with selected tag IDs:', selectedIds)
  }, [preferences, updateSelectedTags])

  const loadTags = async () => {
    try {
      console.log('📥 loadTags() called')
      setLoading(true)
      setError(null)
      
      console.log('📡 Fetching user preferences...')
      const prefs = await fetchUserTagPreferences()
      console.log('✅ Preferences fetched:', prefs)
      
      console.log('📡 Fetching available tags...')
      const tags = await fetchAvailableTags()
      console.log('✅ Tags fetched:', tags)
      
      setPreferences(prefs)
      setAvailableTags(tags)
      
      console.log('📌 State updated successful!')
    } catch (err) {
      console.error('❌ Failed to load tags:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTag = async (tagId) => {
    try {
      console.log('➕ Adding tag:', tagId)
      setLoading(true)
      const newPref = await addTagPreference(tagId)
      console.log('✅ Tag added:', newPref)
      setPreferences((prev) => [...prev, newPref])
      setShowDropdown(false)
    } catch (err) {
      console.error('❌ Failed to add tag:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTag = async (tagId) => {
    try {
      console.log('❌ Removing tag:', tagId)
      await removeTagPreference(tagId)
      console.log('✅ Tag removed')
      setPreferences((prev) => prev.filter((p) => p.tag_id !== tagId))
    } catch (err) {
      console.error('❌ Failed to remove tag:', err)
      setError(err.message)
    }
  }

  const selectedTagIds = preferences.map((p) => p.tag_id)
  const unusedTags = availableTags.filter((t) => !selectedTagIds.includes(t.id))

  console.log('🎨 RENDER:', {
    availableTagsCount: availableTags.length,
    preferencesCount: preferences.length,
    unusedTagsCount: unusedTags.length,
    showDropdown: showDropdown,
    loading: loading,
    error: error
  })

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
        {error && (
          <div style={{ color: '#ff6b6b', fontSize: '11px' }}>
            ❌ Lỗi: {error}
          </div>
        )}

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
