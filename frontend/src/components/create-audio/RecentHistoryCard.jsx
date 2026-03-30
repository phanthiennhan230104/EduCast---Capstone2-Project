import { Button, Card, Space, Typography } from 'antd'
import { ClockCircleOutlined, HistoryOutlined } from '@ant-design/icons'
import styles from '../../style/create-audio/RecentHistoryCard.module.css'

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
        <Text className={styles.meta}>Chưa có bản nháp nào</Text>
      ) : (
        <div>
          {history.map((item) => {
            const isActive = vm.activeDraftId === item.id

            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                onClick={() => vm.loadDraftToForm(item.id)}
                disabled={vm.isLoadingDraft}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <div className={styles.row}>
                  <Space align="start">
                    <div className={styles.iconWrap}>
                      <HistoryOutlined />
                    </div>

                    <Space orientation="vertical" size={2}>
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
                          className={styles.meta}
                          style={{ marginBottom: 0 }}
                        >
                          {item.description}
                        </Paragraph>
                      )}
                    </Space>
                  </Space>

                  <Text className={styles.duration}>
                    <ClockCircleOutlined />{' '}
                    {item.duration_seconds ? `${item.duration_seconds}s` : '—'}
                  </Text>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}