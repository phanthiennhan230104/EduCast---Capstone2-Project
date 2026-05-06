import { useMemo, useState, useEffect } from 'react'
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
  draft: { label: 'Bản nháp', color: 'orange' },
  processing: { label: 'Đang xử lý', color: 'blue' },
  published: { label: 'Đã xuất bản', color: 'green' },
  failed: { label: 'Lỗi', color: 'red' },
  archived: { label: 'Đã lưu trữ', color: 'default' },
  hidden: { label: 'Ẩn', color: 'default' },
}

export default function AllDraftsPanel({ vm }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [archivingId, setArchivingId] = useState('')
  const [durationCache, setDurationCache] = useState({})

  const allDrafts = vm?.recentDrafts || []

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
    return STATUS_META[status] || { label: status || 'Không xác định', color: 'default' }
  }

  const handleArchive = async (draftId, draftTitle) => {
    if (!draftId) return

    try {
      setArchivingId(draftId)
      await archiveDraft(draftId)
      toast.success(`"${draftTitle}" đã được lưu trữ`)

      if (typeof vm?.loadRecentDrafts === 'function') {
        await vm.loadRecentDrafts()
      }
    } catch (error) {
      console.error('Archive draft error:', error)
      toast.error(error?.message || 'Lỗi khi lưu trữ bản nháp')
    } finally {
      setArchivingId('')
    }
  }

  const columns = [
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      width: 150,
      render: (text) => text || 'Bản nháp không tên',
    },
    {
      title: 'Mô tả',
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
      title: 'Thời lượng',
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
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const meta = getStatusMeta(status)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) =>
        date ? new Date(date).toLocaleString('vi-VN') : '—',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_, record) => {
        const isArchiving = archivingId === record.id
        const isDisabled = vm?.isLoadingDraft || !!archivingId || vm.genState === 'processing'

        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              disabled={isDisabled}
              onClick={async () => {
                if (vm.genState === 'processing') {
                  toast.info('Vui lòng hoàn tất tạo audio trước khi load draft khác')
                  return
                }

                await vm?.loadDraftToForm?.(record.id)

                setTimeout(() => {
                  if (!vm?.audioUrl) {
                    toast.info('Draft chưa có audio để đăng bài')
                    return
                  }

                  vm?.goToPublish?.()
                }, 300)
              }}
              style={{ padding: 0 }}
            >
              Đăng bài
            </Button>
            <Popconfirm
              title="Lưu trữ bản nháp"
              description={`Bạn có chắc muốn lưu trữ "${record.title || 'bản nháp này'}"?`}
              onConfirm={() => handleArchive(record.id, record.title || 'Bản nháp')}
              okText="Lưu trữ"
              cancelText="Hủy"
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
      title="Tất cả bản nháp"
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
            {allDrafts.length} bản nháp - Nhấn để xem tất cả
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