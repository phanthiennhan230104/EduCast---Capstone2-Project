import { Card, Descriptions, Space, Tag, Typography } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import styles from '../../style/create-audio/SessionSummaryCard.module.css'
import { formatDurationVi } from '../../utils/formatDuration'

const { Text } = Typography

export default function SessionSummaryCard({ vm }) {
  const { t } = useTranslation()
  const selectedVoice = vm?.voices?.find((item) => item.id === vm.voice)

  return (
    <Card
      className={styles.card}
      title={t('createAudio.sessionSummary.title')}
      variant="borderless"
      styles={{ header: { color: '#fff' } }}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions
          column={1}
          size="small"
          styles={{
            label: { color: 'rgba(255,255,255,0.55)', width: 150 },
            content: { color: '#fff' },
          }}
          items={[
            {
              key: 'words',
              label: t('createAudio.sessionSummary.words'),
              children: `${(vm?.words || 0).toLocaleString()} ${t('createAudio.sessionSummary.wordUnit')}`,
            },
            {
              key: 'duration',
              label: t('createAudio.sessionSummary.duration'),
              children: vm?.durationSeconds > 0 ? formatDurationVi(vm.durationSeconds) : '—',
            },
            {
              key: 'voice',
              label: t('createAudio.sessionSummary.voice'),
              children: selectedVoice?.name || '—',
            },
            {
              key: 'format',
              label: t('createAudio.sessionSummary.format'),
              children: vm?.format || '—',
            },
            {
              key: 'topics',
              label: t('createAudio.sessionSummary.topics'),
              children: vm?.topics?.length ? vm.topics.join(', ') : '—',
            },
          ]}
        />

        <div>
          <Text className={styles.statusLabel}>{t('createAudio.sessionSummary.aiStatus')}</Text>
          <div style={{ marginTop: 8 }}>
            <Tag color="success" icon={<CheckCircleOutlined />}>
              {t('createAudio.sessionSummary.ready')}
            </Tag>
          </div>
        </div>
      </Space>
    </Card>
  )
}