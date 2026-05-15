import { useEffect, useMemo, useState } from 'react'
import { useTagFilter } from '../contexts/TagFilterContext'
import { fetchAvailableTags } from '../../utils/tagApi'
import { Headphones, StickyNote, Bookmark, Plus, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { API_BASE_URL } from '../../config/apiBase'
import { getToken, getCurrentUser } from '../../utils/auth'
import styles from '../../style/library/FavoritesRightPanel.module.css'

const POST_SYNC_EVENT = 'post-sync-updated'

function TitleWithIcon({ icon, children }) {
  return (
    <h4 className={styles.widgetTitle}>
      <span className={styles.titleIcon}>{icon}</span>
      <span>{children}</span>
    </h4>
  )
}

function formatSeconds(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

function getPostId(post) {
  return post?.post_id || post?.id
}

function getAuthorName(post) {
  if (typeof post?.author === 'object') {
    return post.author?.name || post.author?.username || 'Người dùng'
  }
  return post?.author || post?.author_username || 'Người dùng'
}

function getTopicLabel(post) {
  const tags = Array.isArray(post?.tags) ? post.tags : []
  const first = tags[0]
  if (!first) return post?.learning_field || 'Podcast'
  if (typeof first === 'string') return first.replace(/^#/, '')
  return first.name || first.slug || post?.learning_field || 'Podcast'
}

function truncate(text, limit = 96) {
  const value = String(text || '').trim()
  if (value.length <= limit) return value
  return `${value.slice(0, limit).trim()}...`
}

export default function LibraryRightPanel() {
  const { t } = useTranslation()
  const [savedPosts, setSavedPosts] = useState([])
  const [noteHighlights, setNoteHighlights] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [savingIds, setSavingIds] = useState(new Set())

  useEffect(() => {
    let cancelled = false

    const loadSavedPosts = async () => {
      try {
        const token = getToken()
        const response = await fetch(`${API_BASE_URL}/social/saved-posts/my/`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        const data = await response.json()
        if (cancelled) return

        const posts = Array.isArray(data.data?.saved_posts)
          ? data.data.saved_posts
          : []
        setSavedPosts(posts)

        const notePosts = posts.filter((post) => post.has_note).slice(0, 3)
        const notes = await Promise.all(
          notePosts.map(async (post) => {
            try {
              const noteResponse = await fetch(
                `${API_BASE_URL}/social/posts/${encodeURIComponent(getPostId(post))}/notes/`,
                {
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                }
              )
              const noteData = await noteResponse.json()
              if (!noteResponse.ok || !noteData.success || !noteData.data?.has_note) {
                return null
              }
              return {
                id: getPostId(post),
                tag: getTopicLabel(post),
                text: noteData.data.note_content,
              }
            } catch {
              return null
            }
          })
        )
        if (!cancelled) setNoteHighlights(notes.filter(Boolean))
      } catch (error) {
        if (!cancelled) {
          console.error('Load library right panel failed:', error)
          setSavedPosts([])
          setNoteHighlights([])
        }
      }
    }

    loadSavedPosts()
    const onSync = (event) => {
      if (typeof event.detail?.saved === 'boolean') {
        void loadSavedPosts()
      }
    }
    window.addEventListener(POST_SYNC_EVENT, onSync)

    return () => {
      cancelled = true
      window.removeEventListener(POST_SYNC_EVENT, onSync)
    }
  }, [])

  const { selectedTagIds } = useTagFilter()

  useEffect(() => {
    let cancelled = false

    const loadSuggestions = async () => {
      try {
        const token = getToken()
        const response = await fetch(`${API_BASE_URL}/content/feed/?limit=12&tab=for_you`, {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        const data = await response.json()
        if (cancelled) return

        const savedIds = new Set(savedPosts.map((post) => String(getPostId(post))))
        const items = Array.isArray(data.items) ? data.items : []

        // If feed tag filters are active, resolve tag names for selectedTagIds
        let selectedTagNames = null
        const selectedTagIdSet = new Set()
        if (Array.isArray(selectedTagIds) && selectedTagIds.length > 0) {
          selectedTagIds.forEach((id) => selectedTagIdSet.add(String(id)))
          try {
            const tagResponse = await fetchAvailableTags()
            const allTags = Array.isArray(tagResponse) ? tagResponse : tagResponse || []
            const nameSet = new Set()
            allTags.forEach((t) => {
              if (!t) return
              if (selectedTagIdSet.has(String(t.id))) {
                nameSet.add(String((t.name || '').replace(/^#/, '').toLowerCase()))
              }
            })
            if (nameSet.size > 0) selectedTagNames = nameSet
          } catch (err) {
            console.error('Resolve selected tag names failed:', err)
          }
        }

        const normalizedPostHasTag = (post) => {
          // if no tag filter active, allow
          if (!selectedTagNames && selectedTagIdSet.size === 0) return true

          // 1) direct tag id match
          const postTagIds = Array.isArray(post.tag_ids)
            ? post.tag_ids.map(String)
            : Array.isArray(post.tags) && post.tags.every((x) => x && x.id != null)
            ? post.tags.map((x) => String(x.id))
            : []

          if (postTagIds.length > 0) {
            for (const id of postTagIds) {
              if (selectedTagIdSet.has(String(id))) return true
            }
          }

          // 2) fall back to name-based matching
          if (selectedTagNames && selectedTagNames.size > 0) {
            const rawTags = []
            if (Array.isArray(post.tags)) rawTags.push(...post.tags)
            if (Array.isArray(post.tag_names)) rawTags.push(...post.tag_names)
            if (post.tagName) rawTags.push(post.tagName)
            if (post.tag) rawTags.push(post.tag)

            const normalized = rawTags
              .filter(Boolean)
              .map((v) => String(v).replace(/^#/, '').toLowerCase())
            if (normalized.some((t) => selectedTagNames.has(t))) return true
          }

          return false
        }

        setSuggestions(
          items
            .filter((item) => item.type !== 'shared')
            .filter((item) => !savedIds.has(String(getPostId(item))))
            .filter((item) => normalizedPostHasTag(item))
            .slice(0, 3)
        )
      } catch (error) {
        if (!cancelled) {
          console.error('Load library suggestions failed:', error)
          setSuggestions([])
        }
      }
    }

    loadSuggestions()
    return () => {
      cancelled = true
    }
  }, [savedPosts, selectedTagIds])

  const recentListens = useMemo(() => {
    const withProgress = savedPosts
      .filter((post) => Number(post.playback_history?.progress_seconds || 0) > 0)
      .sort((a, b) => {
        const at = new Date(a.playback_history?.updated_at || a.created_at || 0).getTime()
        const bt = new Date(b.playback_history?.updated_at || b.created_at || 0).getTime()
        return bt - at
      })

    return (withProgress.length ? withProgress : savedPosts).slice(0, 4)
  }, [savedPosts])

  const openPostDetail = (post) => {
    const postId = getPostId(post)
    if (!postId) return
    window.dispatchEvent(
      new CustomEvent('open-post-detail', {
        detail: {
          postId,
          canonicalPostId: postId,
          disableAutoScroll: true,
          podcastPreview: post,
        },
      })
    )
  }

  const addSuggestionToLibrary = async (post) => {
    const postId = getPostId(post)
    if (!postId || savingIds.has(String(postId))) return

    setSavingIds((prev) => new Set(prev).add(String(postId)))
    try {
      const token = getToken()
      const currentUser = getCurrentUser()
      const response = await fetch(
        `${API_BASE_URL}/social/posts/${encodeURIComponent(postId)}/save/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: currentUser?.id }),
        }
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || `HTTP ${response.status}`)
      }

      const saved = Boolean(data.data?.saved)
      const saveCount = Number(data.data?.save_count || 0)
      if (saved) {
        window.dispatchEvent(
          new CustomEvent(POST_SYNC_EVENT, {
            detail: { postId, saved: true, saveCount },
          })
        )
        setSuggestions((prev) =>
          prev.filter((item) => String(getPostId(item)) !== String(postId))
        )
      }
    } catch (error) {
      console.error('Save suggestion failed:', error)
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(String(postId))
        return next
      })
    }
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.widget}>
        <TitleWithIcon icon={<Headphones size={15} />}>
          {t('library.rightPanel.recentListens')}
        </TitleWithIcon>

        <div className={styles.list}>
          {recentListens.map((item) => (
            <button
              key={getPostId(item)}
              type="button"
              className={styles.itemButton}
              onClick={() => openPostDetail(item)}
            >
              <div className={styles.item}>
                <div className={styles.thumb}>
                  <Headphones size={14} />
                </div>

                <div className={styles.info}>
                  <div className={styles.itemTitle}>{item.title}</div>
                  <div className={styles.itemSub}>{getAuthorName(item)}</div>
                </div>

                <span className={styles.time}>
                  {formatSeconds(
                    item.playback_history?.progress_seconds ||
                      item.duration_seconds ||
                      item.audio?.duration_seconds
                  )}
                </span>
              </div>
            </button>
          ))}

          {recentListens.length === 0 && (
            <div className={styles.emptyText}>Chưa có podcast đã lưu</div>
          )}
        </div>
      </div>

      <div className={styles.widget}>
        <TitleWithIcon icon={<StickyNote size={15} />}>
          {t('library.rightPanel.highlightNotes')}
        </TitleWithIcon>

        <div className={styles.noteList}>
          {noteHighlights.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.noteButton}
              onClick={() => openPostDetail(item)}
            >
              <div className={styles.noteCard}>
                <span className={styles.noteTag}>{item.tag}</span>
                <p className={styles.noteText}>{truncate(item.text, 110)}</p>
              </div>
            </button>
          ))}

          {noteHighlights.length === 0 && (
            <div className={styles.emptyText}>Chưa có ghi chú nổi bật</div>
          )}
        </div>
      </div>

      <div className={styles.widget}>
        <TitleWithIcon icon={<Bookmark size={15} />}>
          {t('library.rightPanel.suggestedLibrary')}
        </TitleWithIcon>

        <div className={styles.list}>
          {suggestions.map((item) => {
            const postId = getPostId(item)
            const isSaving = savingIds.has(String(postId))

            return (
              <div key={postId} className={styles.item}>
                <div className={styles.thumbAlt}>
                  <Bookmark size={13} />
                </div>

                <button
                  type="button"
                  className={styles.infoButton}
                  onClick={() => openPostDetail(item)}
                >
                  <div className={styles.itemTitle}>{item.title}</div>
                  <div className={styles.itemSub}>
                    {formatSeconds(item.audio?.duration_seconds || item.duration_seconds)}
                    {' · '}
                    {getTopicLabel(item)}
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => addSuggestionToLibrary(item)}
                  disabled={isSaving}
                  aria-label={t('library.rightPanel.addToLibrary', { title: item.title })}
                >
                  {isSaving ? <Check size={14} /> : <Plus size={14} />}
                </button>
              </div>
            )
          })}

          {suggestions.length === 0 && (
            <div className={styles.emptyText}>Chưa có gợi ý phù hợp</div>
          )}
        </div>
      </div>
    </aside>
  )
}
