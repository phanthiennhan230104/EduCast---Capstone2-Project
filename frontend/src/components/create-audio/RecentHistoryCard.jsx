import { Button, Card, Space, Typography } from 'antd'
import { ClockCircleOutlined, HistoryOutlined } from '@ant-design/icons'
import styles from '../../style/create-audio/RecentHistoryCard.module.css'
import { formatDurationVi } from '../../utils/formatDuration'

const { Text, Paragraph } = Typography

export default function RecentHistoryCard({ vm }) {
  const history = vm?.recentDrafts || []

  return (
    <Card
      className={styles.card}
      title="Đã tạo gần đây"
      extra={<Button type="link">Xem tất cả</Button>}
      variant="borderless"
      styles={{ header: { color: '#fff' } }}
    >
      {!history.length ? (
        <div className={styles.emptyState}>
          <Text className={styles.meta}>Chưa có bản nháp nào</Text>
        </div>
      ) : (
        <div className={styles.list}>
          {history.map((item) => {
            const isActive = vm.activeDraftId === item.id
            const durationSeconds = Number(item.duration_seconds || 0)

            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                onClick={() => {
                  if (!vm.isLoadingDraft) {
                    vm.loadDraftToForm(item.id)
                  }
                }}
                disabled={vm.isLoadingDraft}
              >
                <div className={styles.row}>
                  <div className={styles.left}>
                    <div className={styles.iconWrap}>
                      <HistoryOutlined />
                    </div>

                    <div className={styles.content}>
                      <Text strong className={styles.title}>
                        {item.title || 'Bản nháp không tên'}
                      </Text>

                      <Text className={styles.meta}>
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString('vi-VN')
                          : '—'}
                      </Text>

                      {!!item.description && (
                        <Paragraph
                          ellipsis={{ rows: 2 }}
                          className={styles.description}
                        >
                          {item.description}
                        </Paragraph>
                      )}
                    </div>
                  </div>

                  <div className={styles.right}>
                    <Text className={styles.duration}>
                      <ClockCircleOutlined />{' '}
                      {durationSeconds > 0 ? formatDurationVi(durationSeconds) : '—'}
                    </Text>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}