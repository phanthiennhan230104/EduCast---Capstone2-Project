import { Card, Descriptions, Space, Tag, Typography } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import styles from '../../style/create-audio/SessionSummaryCard.module.css'

const { Text } = Typography

export default function SessionSummaryCard({ vm }) {
  const selectedVoice = vm?.voices?.find((item) => item.id === vm.voice)

  return (
    <Card
      className={styles.card}
      title="Tóm tắt phiên"
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
              label: 'Số từ',
              children: `${(vm?.words || 0).toLocaleString()} từ`,
            },
            {
              key: 'estimate',
              label: 'Ước tính thời gian',
              children: vm?.estLabel || '—',
            },
            {
              key: 'voice',
              label: 'Giọng đọc',
              children: selectedVoice?.name || '—',
            },
            {
              key: 'format',
              label: 'Định dạng',
              children: vm?.format || '—',
            },
            {
              key: 'topics',
              label: 'Chủ đề',
              children: vm?.topics?.length ? vm.topics.join(', ') : '—',
            },
          ]}
        />

        <div>
          <Text className={styles.statusLabel}>Trạng thái AI</Text>
          <div style={{ marginTop: 8 }}>
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Sẵn sàng
            </Tag>
          </div>
        </div>
      </Space>
    </Card>
  )
}