import { createContext, useState, useCallback, useEffect, useMemo } from 'react'

export const PodcastContext = createContext()

const HIDDEN_KEY = 'educast.hiddenPostIds'
const DELETED_KEY = 'educast.deletedPostIds'
export const POST_REMOVED_EVENT = 'post-removed'

const loadPersistedIdSet = (storageKey) => {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.map((v) => String(v)))
  } catch {
    return new Set()
  }
}

const persistIdSet = (storageKey, idSet) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(idSet)))
  } catch {}
}

export const PodcastProvider = ({ children }) => {
  console.log('📦 PodcastProvider RENDER')
  // Lưu trữ danh sách podcasts và trạng thái saved của chúng
  const [savedPostIds, setSavedPostIds] = useState(new Set())
  const [hiddenPostIds, setHiddenPostIds] = useState(() =>
    loadPersistedIdSet(HIDDEN_KEY)
  )
  const [deletedPostIds, setDeletedPostIds] = useState(() =>
    loadPersistedIdSet(DELETED_KEY)
  )
  const [deletedPostsVersion, setDeletedPostsVersion] = useState(0)
  const [hiddenPostsVersion, setHiddenPostsVersion] = useState(0)
  const [collections, setCollections] = useState([])
  const [collectionsVersion, setCollectionsVersion] = useState(0)

  useEffect(() => {
    persistIdSet(HIDDEN_KEY, hiddenPostIds)
  }, [hiddenPostIds])

  useEffect(() => {
    persistIdSet(DELETED_KEY, deletedPostIds)
  }, [deletedPostIds])

  // Thêm post vào danh sách saved
  const addSavedPost = useCallback((postId) => {
    setSavedPostIds(prev => new Set(prev).add(postId))
  }, [])

  // Loại bỏ post khỏi danh sách saved
  const removeSavedPost = useCallback((postId) => {
    setSavedPostIds(prev => {
      const newSet = new Set(prev)
      newSet.delete(postId)
      return newSet
    })
  }, [])

  // Ẩn post — đồng bộ liên trang qua sự kiện `post-removed` (reason="hidden").
  const hidePost = useCallback((postId) => {
    const key = String(postId)
    console.log('👁️ hidePost called with id:', postId, 'type:', typeof postId)
    setHiddenPostIds(prev => {
      const newSet = new Set(prev)
      newSet.add(key)
      console.log('✅ hiddenPostIds now has:', newSet.size, 'items, ids:', Array.from(newSet))
      return newSet
    })
    setHiddenPostsVersion(v => v + 1)
    try {
      window.dispatchEvent(
        new CustomEvent(POST_REMOVED_EVENT, {
          detail: { postId: key, reason: 'hidden' },
        })
      )
    } catch {}
  }, [])

  // Xóa post — đồng bộ liên trang qua sự kiện `post-removed` (reason="deleted").
  const deletePost = useCallback((postId) => {
    const key = String(postId)
    console.log('📌 deletePost called with id:', postId, 'type:', typeof postId)
    setDeletedPostIds(prev => {
      const newSet = new Set(prev)
      newSet.add(key)
      console.log('✅ deletedPostIds now has:', newSet.size, 'items, ids:', Array.from(newSet))
      return newSet
    })
    setDeletedPostsVersion(v => v + 1)
    try {
      window.dispatchEvent(
        new CustomEvent(POST_REMOVED_EVENT, {
          detail: { postId: key, reason: 'deleted' },
        })
      )
    } catch {}
  }, [])

  // Kiểm tra post có được save không
  const isPostSaved = useCallback((postId) => {
    return savedPostIds.has(postId)
  }, [savedPostIds])

  // Kiểm tra post có bị ẩn không
  const isPostHidden = useCallback((postId) => {
    return hiddenPostIds.has(String(postId))
  }, [hiddenPostIds])

  // Kiểm tra post có bị xóa không
  const isPostDeleted = useCallback((postId) => {
    return deletedPostIds.has(String(postId))
  }, [deletedPostIds])

  // Cập nhật danh sách saved posts (dùng khi fetch từ API)
  const setSavedPostIds_batch = useCallback((postIds) => {
    setSavedPostIds(new Set(postIds))
  }, [])

  // Cập nhật collections list
  const updateCollections = useCallback((newCollections) => {
    setCollections(newCollections)
    setCollectionsVersion(v => v + 1)
  }, [])

  // Thêm collection mới
  const addCollection = useCallback((collection) => {
    setCollections(prev => [collection, ...prev])
    setCollectionsVersion(v => v + 1)
  }, [])

  // Xóa collection
  const removeCollection = useCallback((collectionId) => {
    setCollections(prev => prev.filter(c => c.id !== collectionId))
    setCollectionsVersion(v => v + 1)
  }, [])

  const value = useMemo(() => ({
    savedPostIds,
    hiddenPostIds,
    deletedPostIds,
    deletedPostsVersion,
    hiddenPostsVersion,
    collections,
    collectionsVersion,
    addSavedPost,
    removeSavedPost,
    isPostSaved,
    isPostHidden,
    isPostDeleted,
    hidePost,
    deletePost,
    setSavedPostIds_batch,
    updateCollections,
    addCollection,
    removeCollection,
  }), [savedPostIds, hiddenPostIds, deletedPostIds, deletedPostsVersion, hiddenPostsVersion, collections, collectionsVersion, addSavedPost, removeSavedPost, isPostSaved, isPostHidden, isPostDeleted, hidePost, deletePost, setSavedPostIds_batch, updateCollections, addCollection, removeCollection])

  return (
    <PodcastContext.Provider value={value}>
      {children}
    </PodcastContext.Provider>
  )
}
