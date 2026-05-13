import { useState, useCallback, useRef, useEffect } from 'react'
import { searchContent } from '../../utils/searchApi'
import styles from '../../style/common/Search.module.css'
import { useTranslation } from 'react-i18next'

export default function Search() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState('all')
  const [results, setResults] = useState({
    posts: [],
    authors: [],
    tags: [],
  })
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef(null)
  const debounceTimer = useRef(null)

  // Handle search with debounce
  const handleSearch = useCallback(async (searchQuery, type) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    if (!searchQuery || searchQuery.length < 2) {
      setResults({ posts: [], authors: [], tags: [] })
      setShowResults(false)
      return
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        setLoading(true)
        const data = await searchContent(searchQuery, type, 10, 0)
        setResults(data)
        setShowResults(true)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  // Handle input change
  const handleQueryChange = (e) => {
    const value = e.target.value
    setQuery(value)
    handleSearch(value, searchType)
  }

  // Handle search type change
  const handleTypeChange = (e) => {
    const value = e.target.value
    setSearchType(value)
    handleSearch(query, value)
  }

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={styles.searchContainer} ref={searchRef}>
      <div className={styles.searchBoxWrapper}>
        <div className={styles.searchInputGroup}>
          <input
            type="text"
            placeholder={t('search.searchPlaceholder')}
            className={styles.searchInput}
            value={query}
            onChange={handleQueryChange}
            onFocus={() => query && query.length >= 2 && setShowResults(true)}
          />
          <select
            className={styles.searchTypeSelect}
            value={searchType}
            onChange={handleTypeChange}
          >
            <option value="all">{t('search.types.all')}</option>
<option value="posts">{t('search.types.posts')}</option>
<option value="authors">{t('search.types.authors')}</option>
<option value="tags">{t('search.types.tags')}</option>
          </select>
        </div>

        {showResults && (
          <div className={styles.resultsDropdown}>
            {loading && <div className={styles.loading}>{t('search.searching')}</div>}

            {!loading && (results.posts.length === 0 && results.authors.length === 0 && results.tags.length === 0) && (
              <div className={styles.noResults}>{t('search.noResults')}</div>
            )}

            {/* Posts Results */}
            {results.posts.length > 0 && (
              <div className={styles.resultSection}>
                <h4 className={styles.sectionTitle}>Podcast</h4>
                <div className={styles.resultsList}>
                  {results.posts.map((post) => (
                    <div key={post.id} className={styles.resultItem}>
                      <div className={styles.resultThumbnail}>
                        <img
                          src={post.thumbnail_url || 'https://via.placeholder.com/60'}
                          alt={post.title}
                        />
                      </div>
                      <div className={styles.resultContent}>
                        <h5 className={styles.resultTitle}>{post.title}</h5>
                        <p className={styles.resultAuthor}>{post.author}</p>
                        <span className={styles.resultMeta}>
                          {t('search.listenCount', { count: post.listen_count || 0 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Authors Results */}
            {results.authors.length > 0 && (
              <div className={styles.resultSection}>
                <h4 className={styles.sectionTitle}>{t('search.sections.authors')}</h4>
                <div className={styles.resultsList}>
                  {results.authors.map((author) => (
                    <div key={author.id} className={styles.resultItem}>
                      <div className={styles.resultAvatar}>
                        <img
                          src={author.avatar_url || 'https://i.pravatar.cc/60'}
                          alt={author.display_name || author.username}
                        />
                      </div>
                      <div className={styles.resultContent}>
                        <h5 className={styles.resultTitle}>
                          {author.display_name || author.username}
                        </h5>
                        <p className={styles.resultAuthor}>@{author.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags Results */}
            {results.tags.length > 0 && (
              <div className={styles.resultSection}>
                <h4 className={styles.sectionTitle}>{t('search.sections.tags')}</h4>
                <div className={styles.tagsList}>
                  {results.tags.map((tag) => (
                    <a
                      key={tag.id}
                      href={`/?filter=tag&slug=${tag.slug}`}
                      className={styles.tagBadge}
                    >
                      #{tag.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
