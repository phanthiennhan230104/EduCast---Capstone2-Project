import { createContext, useContext, useState, useCallback } from 'react'

const TagFilterContext = createContext()

export function TagFilterProvider({ children }) {
  const [selectedTagIds, setSelectedTagIds] = useState([])

  const updateSelectedTags = useCallback((tagIds) => {
    setSelectedTagIds(tagIds)
    console.log('📌 TagFilterContext - Updated selected tags:', tagIds)
  }, [])

  const clearSelectedTags = useCallback(() => {
    setSelectedTagIds([])
    console.log('📌 TagFilterContext - Cleared selected tags')
  }, [])

  return (
    <TagFilterContext.Provider value={{ selectedTagIds, updateSelectedTags, clearSelectedTags }}>
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
