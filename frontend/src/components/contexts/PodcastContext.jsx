import { createContext, useState, useCallback, useMemo } from 'react'

export const PodcastContext = createContext()

export const PodcastProvider = ({ children }) => {
  console.log('📦 PodcastProvider RENDER')
  // Lưu trữ danh sách podcasts và trạng thái saved của chúng
  const [savedPostIds, setSavedPostIds] = useState(new Set())
  const [hiddenPostIds, setHiddenPostIds] = useState(new Set())
  const [deletedPostIds, setDeletedPostIds] = useState(new Set())

  const [deletedPostsVersion, setDeletedPostsVersion] = useState(0)
  const [hiddenPostsVersion, setHiddenPostsVersion] = useState(0)
  
  const [collections, setCollections] = useState([])
  const [collectionsVersion, setCollectionsVersion] = useState(0)

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

  // Ẩn post
  const hidePost = useCallback((postId) => {
    setHiddenPostIds(prev => new Set(prev).add(postId))
    setHiddenPostsVersion(v => v + 1)
  }, [])

  // Xóa post
  const deletePost = useCallback((postId) => {
    console.log('📌 deletePost called with id:', postId, 'type:', typeof postId)
    setDeletedPostIds(prev => {
      const newSet = new Set(prev)
      newSet.add(postId)
      console.log('✅ deletedPostIds now has:', newSet.size, 'items, ids:', Array.from(newSet))
      return newSet
    })
    setDeletedPostsVersion(v => v + 1)
  }, [])

  // Kiểm tra post có được save không
  const isPostSaved = useCallback((postId) => {
    return savedPostIds.has(postId)
  }, [savedPostIds])

  // Kiểm tra post có bị ẩn không
  const isPostHidden = useCallback((postId) => {
    return hiddenPostIds.has(postId)
  }, [hiddenPostIds])

  // Kiểm tra post có bị xóa không
  const isPostDeleted = useCallback((postId) => {
    return deletedPostIds.has(postId)
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
