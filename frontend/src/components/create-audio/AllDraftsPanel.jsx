import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Table, Popconfirm, Tag, Space, Skeleton } from 'antd'
import {
  DownOutlined,
  UpOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { toast } from 'react-toastify'
import styles from '../../style/create-audio/AllDraftsPanel.module.css'
import { formatDurationVi, getAudioDuration } from '../../utils/formatDuration'
import { archiveDraft } from '../../utils/contentApi'

const STATUS_META = {
  draft: { labelKey: 'draftsPanel.status.draft', color: 'orange' },
  processing: { labelKey: 'draftsPanel.status.processing', color: 'blue' },
  published: { labelKey: 'draftsPanel.status.published', color: 'green' },
  failed: { labelKey: 'draftsPanel.status.failed', color: 'red' },
  archived: { labelKey: 'draftsPanel.status.archived', color: 'default' },
  hidden: { labelKey: 'draftsPanel.status.hidden', color: 'default' },
}

export default function AllDraftsPanel({ vm }) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [archivingId, setArchivingId] = useState('')
  const [durationCache, setDurationCache] = useState({})

  const allDrafts = (vm?.recentDrafts || []).filter(
    (draft) => draft.status !== 'archived'
  )

  // Load actual durations from audio files for all drafts
  useEffect(() => {
    let isMounted = true
    let activeRequests = 0

    const loadDurations = async () => {
      for (const draft of allDrafts) {
        if (!draft.id || !draft.audio_url) continue
        if (durationCache[draft.id] !== undefined) continue

        activeRequests++

        try {
          const duration = await getAudioDuration(draft.audio_url)
          if (isMounted && duration > 0) {
            setDurationCache((prev) => ({
              ...prev,
              [draft.id]: duration,
            }))
          }
        } catch (error) {
          console.error(`Failed to load duration for draft ${draft.id}:`, error)
        }
      }
    }

    loadDurations()

    return () => {
      isMounted = false
    }
  }, [allDrafts, durationCache])

  const getStatusMeta = (status) => {
    return STATUS_META[status] || {
      labelKey: null,
      label: status || t('draftsPanel.status.unknown'),
      color: 'default',
    }
  }

  const handleArchive = async (draftId, draftTitle) => {
    if (!draftId) return

    try {
      setArchivingId(draftId)
      await archiveDraft(draftId)

      vm?.setRecentDrafts?.((prev) =>
        prev.filter((draft) => draft.id !== draftId)
      )

      toast.success(t('draftsPanel.archiveSuccess', { title: draftTitle }))

      await vm?.loadRecentDrafts?.()
    } catch (error) {
      console.error('Archive draft error:', error)
      toast.error(error?.message || t('draftsPanel.archiveError'))
    } finally {
      setArchivingId('')
    }
  }

  const columns = [
    {
      title: t('draftsPanel.titleColumn'),
      dataIndex: 'title',
      key: 'title',
      width: 150,
      render: (text) => text || t('draftsPanel.untitledDraft'),
    },
    {
      title: t('draftsPanel.descriptionColumn'),
      dataIndex: 'description',
      key: 'description',
      width: 250,
      render: (text) => (
        <span
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
            lineHeight: '1.5',
          }}
        >
          {text || '—'}
        </span>
      ),
    },
    {
      title: t('draftsPanel.durationColumn'),
      dataIndex: 'id',
      key: 'duration',
      width: 100,
      render: (draftId, record) => {
        const cachedDuration = durationCache[draftId]

        if (cachedDuration !== undefined) {
          return cachedDuration > 0 ? formatDurationVi(cachedDuration) : '—'
        }

        // Show fallback from database or skeleton
        const num = Number(record.duration_seconds || 0)
        if (num > 0) {
          return formatDurationVi(num)
        }

        return '—'
      },
    },
    {
      title: t('draftsPanel.statusColumn'),
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const meta = getStatusMeta(status)
        return <Tag color={meta.color}>{meta.labelKey ? t(meta.labelKey) : meta.label}</Tag>
      },
    },
    {
      title: t('draftsPanel.createdAtColumn'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) =>
        date ? new Date(date).toLocaleString('vi-VN') : '—',
    },
    {
      title: t('draftsPanel.actionsColumn'),
      key: 'actions',
      width: 120,
      render: (_, record) => {
        const isArchiving = archivingId === record.id
        const isDisabled = vm?.isLoadingDraft || !!archivingId || vm.genState === 'processing'
        const isPublished = record.status === 'published'

        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              disabled={isDisabled || isPublished}
              onClick={async () => {
                if (isPublished) {
                  toast.info('Bài này đã được đăng rồi, không thể đăng lại')
                  return
                }

                if (vm.genState === 'processing') {
                  toast.info('Vui lòng hoàn tất tạo audio trước khi load draft khác')
                  return
                }

                try {
                  await vm?.loadDraftToForm?.(record.id)

                  toast.success('Đã tải bản nháp')

                  // nếu muốn tự chuyển publish
                  // thì delay chút cho React render xong
                  setTimeout(() => {
                    vm?.goToPublish?.()
                  }, 100)
                } catch (error) {
                  toast.error('Không thể tải draft')
                }
              }}
              style={{ padding: 0 }}
            >
              {t('draftsPanel.select')}
            </Button>
            <Popconfirm
              title={t('draftsPanel.archiveDraft')}
              description={t('draftsPanel.archiveConfirm', {
                title: record.title || t('draftsPanel.fallbackDraft'),
              })}
              onConfirm={() =>
                handleArchive(record.id, record.title || t('draftsPanel.defaultDraftTitle'))
              }
              okText={t('draftsPanel.archive')}
              cancelText={t('draftsPanel.cancel')}
              disabled={isArchiving}
            >

              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
                loading={isArchiving}
                disabled={isArchiving}
              />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  if (!allDrafts.length) {
    return null
  }

  return (
    <Card
      className={styles.card}
      title={t('draftsPanel.allDrafts')}
      extra={
        <Button
          type="text"
          icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
          onClick={() => setIsExpanded((prev) => !prev)}
          className={styles.toggleBtn}
        />
      }
      variant="borderless"
      styles={{ header: { color: '#fff' } }}
    >
      {!isExpanded ? (
        <div className={styles.collapsedInfo}>
          <span className={styles.collapsedText}>
            {t('draftsPanel.collapsedInfo', { count: allDrafts.length })}
          </span>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <Table
            columns={columns}
            dataSource={allDrafts.map((draft) => ({
              ...draft,
              key: draft.id,
            }))}
            pagination={false}
            size="small"
            scroll={{ x: 800 }}
            style={{ color: '#f5f0e8' }}
          />
        </div>
      )}
    </Card>
  )
}