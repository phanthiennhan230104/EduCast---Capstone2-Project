import { useMemo, useState } from 'react'
import { Button, Card, Table, Popconfirm, Tag, Space } from 'antd'
import {
  DownOutlined,
  UpOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { toast } from 'react-toastify'
import styles from '../../style/create-audio/AllDraftsPanel.module.css'
import { formatDurationVi } from '../../utils/formatDuration'
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

  const allDrafts = vm?.recentDrafts || []

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
      dataIndex: 'duration_seconds',
      key: 'duration_seconds',
      width: 100,
      render: (seconds) => {
        const num = Number(seconds || 0)
        return num > 0 ? formatDurationVi(num) : '—'
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
        const isDisabled = vm?.isLoadingDraft || !!archivingId

        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              disabled={isDisabled}
              onClick={() => vm?.loadDraftToForm?.(record.id)}
              style={{ padding: 0 }}
            >
              Chọn
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