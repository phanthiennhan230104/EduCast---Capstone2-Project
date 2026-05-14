import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import styles from '../../../style/layout/Sidebar.module.css'
import { useTagFilter } from '../../contexts/TagFilterContext'
import { getTopics } from '../../../utils/contentApi'
import { fetchAvailableTags } from '../../../utils/tagApi'
import { writeFeedScrollSessionKeys } from '../../../utils/feedScrollSession'

function normalizeOptions(items) {
  return [...(items || [])].sort((a, b) => {
    const countDiff = Number(b.usage_count || 0) - Number(a.usage_count || 0)
    if (countDiff !== 0) return countDiff
    return String(a.name || '').localeCompare(String(b.name || ''))
  })
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function toggleId(ids, id) {
  const target = String(id)
  const current = (ids || []).map(String)
  if (current.includes(target)) {
    return (ids || []).filter((value) => String(value) !== target)
  }
  return [...(ids || []), id]
}

function FilterBlock({
  title,
  options,
  selectedIds,
  search,
  onSearch,
  onToggle,
  prefix = '',
}) {
  const selected = (selectedIds || []).map(String)
  const selectedOptions = useMemo(
    () => options.filter((item) => selected.includes(String(item.id))),
    [options, selected]
  )
  const visibleOptions = useMemo(() => {
    const selectedSet = new Set(selected)
    if (selectedOptions.length >= 5) return selectedOptions

    return [
      ...selectedOptions,
      ...options
        .filter((item) => !selectedSet.has(String(item.id)))
        .slice(0, 5 - selectedOptions.length),
    ]
  }, [options, selected, selectedOptions])
  const normalizedSearch = normalizeSearchText(search.trim())
  const searchedOptions = useMemo(() => {
    if (!normalizedSearch) return []
    const selectedSet = new Set(selected)
    return options
      .filter(
        (item) =>
          !selectedSet.has(String(item.id)) &&
          normalizeSearchText(item.name).includes(normalizedSearch)
      )
      .slice(0, 8)
  }, [normalizedSearch, options, selected])

  const renderChip = (item) => {
    const active = selected.includes(String(item.id))
    return (
      <button
        key={item.id}
        type="button"
        className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
        onClick={() => onToggle(item.id)}
        title={`${item.name}${item.usage_count ? ` (${item.usage_count})` : ''}`}
      >
        <span>{prefix}{item.name}</span>
      </button>
    )
  }

  return (
    <section className={styles.filterSection}>
      <div className={styles.filterTitle}>{title}</div>
      <div className={styles.filterChipList}>
        {visibleOptions.map(renderChip)}
      </div>
      <label className={styles.filterSearch}>
        <Search size={14} />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Tìm mục khác..."
        />
      </label>
      {normalizedSearch && (
        <div className={styles.filterSearchResults}>
          {searchedOptions.length > 0 ? (
            searchedOptions.map(renderChip)
          ) : (
            <span className={styles.filterEmpty}>Không tìm thấy</span>
          )}
        </div>
      )}
    </section>
  )
}

export default function FeedFilterSidebar() {
  const {
    selectedTagIds,
    selectedTopicIds,
    updateSelectedTags,
    updateSelectedTopics,
    clearFeedFilters,
  } = useTagFilter()
  const [topics, setTopics] = useState([])
  const [tags, setTags] = useState([])
  const [topicSearch, setTopicSearch] = useState('')
  const [tagSearch, setTagSearch] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadFilters = async () => {
      try {
        const [topicsResponse, tagResponse] = await Promise.all([
          getTopics(),
          fetchAvailableTags(),
        ])
        if (cancelled) return

        const topicItems = Array.isArray(topicsResponse?.data)
          ? topicsResponse.data
          : topicsResponse
        setTopics(normalizeOptions(Array.isArray(topicItems) ? topicItems : []))
        setTags(normalizeOptions(Array.isArray(tagResponse) ? tagResponse : []))
      } catch (err) {
        console.error('Load sidebar feed filters failed:', err)
      }
    }

    loadFilters()

    return () => {
      cancelled = true
    }
  }, [])

  const resetScrollForFilterChange = () => {
    writeFeedScrollSessionKeys(0)
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }

  const handleToggleTopic = (topicId) => {
    resetScrollForFilterChange()
    updateSelectedTopics(toggleId(selectedTopicIds, topicId))
  }

  const handleToggleTag = (tagId) => {
    resetScrollForFilterChange()
    updateSelectedTags(toggleId(selectedTagIds, tagId))
  }

  const hasActiveFilters =
    (selectedTopicIds || []).length > 0 || (selectedTagIds || []).length > 0

  return (
    <div className={styles.feedFilterPanel}>
      <div className={styles.feedFilterHeader}>
        <span>Lọc Feed</span>
        {hasActiveFilters && (
          <button
            type="button"
            className={styles.clearFilterBtn}
            onClick={() => {
              resetScrollForFilterChange()
              clearFeedFilters()
            }}
          >
            Bỏ lọc
          </button>
        )}
      </div>

      <FilterBlock
        title="Topic"
        options={topics}
        selectedIds={selectedTopicIds}
        search={topicSearch}
        onSearch={setTopicSearch}
        onToggle={handleToggleTopic}
      />

      <FilterBlock
        title="Tag"
        options={tags}
        selectedIds={selectedTagIds}
        search={tagSearch}
        onSearch={setTagSearch}
        onToggle={handleToggleTag}
        prefix="#"
      />
    </div>
  )
}
