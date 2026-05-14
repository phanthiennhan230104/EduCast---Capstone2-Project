/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState } from 'react'

const TagFilterContext = createContext()
const FEED_FILTER_STORAGE_KEY = 'educast:feedFilters'

function normalizeIdList(value) {
  return Array.isArray(value)
    ? value.filter((item) => item != null && item !== '')
    : []
}

function readStoredFeedFilters() {
  if (typeof window === 'undefined') {
    return { tagIds: [], topicIds: [] }
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(FEED_FILTER_STORAGE_KEY) || '{}'
    )
    return {
      tagIds: normalizeIdList(stored.tagIds),
      topicIds: normalizeIdList(stored.topicIds),
    }
  } catch {
    return { tagIds: [], topicIds: [] }
  }
}

function writeStoredFeedFilters(next) {
  if (typeof window === 'undefined') return

  const tagIds = normalizeIdList(next.tagIds)
  const topicIds = normalizeIdList(next.topicIds)

  if (tagIds.length === 0 && topicIds.length === 0) {
    window.localStorage.removeItem(FEED_FILTER_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(
    FEED_FILTER_STORAGE_KEY,
    JSON.stringify({ tagIds, topicIds })
  )
}

export function TagFilterProvider({ children }) {
  const [selectedTagIds, setSelectedTagIds] = useState(
    () => readStoredFeedFilters().tagIds
  )
  const [selectedTopicIds, setSelectedTopicIds] = useState(
    () => readStoredFeedFilters().topicIds
  )

  const updateSelectedTags = useCallback((tagIds) => {
    const nextTagIds = normalizeIdList(tagIds)
    setSelectedTagIds(nextTagIds)
    setSelectedTopicIds((currentTopicIds) => {
      writeStoredFeedFilters({
        tagIds: nextTagIds,
        topicIds: currentTopicIds,
      })
      return currentTopicIds
    })
  }, [])

  const clearSelectedTags = useCallback(() => {
    setSelectedTagIds([])
    setSelectedTopicIds((currentTopicIds) => {
      writeStoredFeedFilters({
        tagIds: [],
        topicIds: currentTopicIds,
      })
      return currentTopicIds
    })
  }, [])

  const updateSelectedTopics = useCallback((topicIds) => {
    const nextTopicIds = normalizeIdList(topicIds)
    setSelectedTopicIds(nextTopicIds)
    setSelectedTagIds((currentTagIds) => {
      writeStoredFeedFilters({
        tagIds: currentTagIds,
        topicIds: nextTopicIds,
      })
      return currentTagIds
    })
  }, [])

  const clearSelectedTopics = useCallback(() => {
    setSelectedTopicIds([])
    setSelectedTagIds((currentTagIds) => {
      writeStoredFeedFilters({
        tagIds: currentTagIds,
        topicIds: [],
      })
      return currentTagIds
    })
  }, [])

  const clearFeedFilters = useCallback(() => {
    setSelectedTagIds([])
    setSelectedTopicIds([])
    writeStoredFeedFilters({ tagIds: [], topicIds: [] })
  }, [])

  return (
    <TagFilterContext.Provider
      value={{
        selectedTagIds,
        selectedTopicIds,
        updateSelectedTags,
        updateSelectedTopics,
        clearSelectedTags,
        clearSelectedTopics,
        clearFeedFilters,
      }}
    >
      {children}
    </TagFilterContext.Provider>
  )
}

export function useTagFilter() {
  const context = useContext(TagFilterContext)
  if (!context) {
    throw new Error('useTagFilter must be used within TagFilterProvider')
  }
  return context
}
