import { useEffect, useState } from 'react'
import { Button, Card, Space, Typography, Skeleton } from 'antd'
import { useTranslation } from 'react-i18next'
import { ClockCircleOutlined, HistoryOutlined } from '@ant-design/icons'
import { toast } from 'react-toastify'
import styles from '../../style/create-audio/RecentHistoryCard.module.css'
import { formatDurationVi, getAudioDuration } from '../../utils/formatDuration'


const { Text, Paragraph } = Typography

function HistoryItemDuration({ audioUrl, fallbackDuration }) {

  const [duration, setDuration] = useState(null)

  useEffect(() => {
    let isMounted = true

    const fetchDuration = async () => {
      if (!audioUrl) {
        isMounted && setDuration(0)
        return
      }

      const actualDuration = await getAudioDuration(audioUrl)
      if (isMounted) {
        setDuration(actualDuration > 0 ? actualDuration : (fallbackDuration || 0))
      }
    }

    fetchDuration()

    return () => {
      isMounted = false
    }
  }, [audioUrl, fallbackDuration])

  if (duration === null) {
    return <Skeleton.Button size="small" />
  }

  return duration > 0 ? formatDurationVi(duration) : '—'
}

export default function RecentHistoryCard({ vm, onViewAll }) {
  const { t } = useTranslation()
  const history = vm?.recentDrafts || []

  return (
    <Card
      className={styles.card}
      title={t('createAudio.recentHistory.title')}
      extra={
        <Button type="link" onClick={onViewAll}>
          {t('createAudio.recentHistory.viewAll')}
        </Button>
      }
      variant="borderless"
      styles={{ header: { color: '#fff' } }}
    >
      {!history.length ? (
        <div className={styles.emptyState}>
          <Text className={styles.meta}>{t('createAudio.recentHistory.empty')}</Text>
        </div>
      ) : (
        <div className={styles.list}>
          {history.map((item) => {
            const isActive = vm.activeDraftId === item.id

            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                onClick={() => {
                  if (vm.genState === 'processing') {
                    toast.info(t('draftsPanel.finishProcessingBeforeLoad'))
                    return
                  }
                  if (!vm.isLoadingDraft) {
                    vm.loadDraftToForm(item.id)
                  }
                }}
                disabled={vm.isLoadingDraft || vm.genState === 'processing'}
              >
                <div className={styles.row}>
                  <div className={styles.left}>
                    <div className={styles.iconWrap}>
                      <HistoryOutlined />
                    </div>

                    <div className={styles.content}>
                      <Text strong className={styles.title}>
                        {item.title || t('createAudio.recentHistory.untitledDraft')}
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
                      <HistoryItemDuration
                        audioUrl={item.audio_url}
                        fallbackDuration={item.duration_seconds}
                      />
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