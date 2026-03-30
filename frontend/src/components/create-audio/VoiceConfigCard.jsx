import { Card, Col, Radio, Row, Select, Space, Typography } from 'antd'
import styles from '../../style/create-audio/VoiceConfigCard.module.css'

const { Text } = Typography

export default function VoiceConfigCard({ vm }) {
  const topicOptions = (vm.topicOptions || vm.topicsMaster || []).map((topic) => ({
    value: topic,
    label: topic,
  }))

  const aiSuggestedOptions = (vm.aiSuggestedTopics || []).map((topic) => ({
    value: topic,
    label: `${topic} (AI đề xuất)`,
  }))

  const mergedTopicOptions = [...topicOptions]

  aiSuggestedOptions.forEach((item) => {
    const exists = mergedTopicOptions.some((opt) => opt.value === item.value)
    if (!exists) {
      mergedTopicOptions.push(item)
    }
  })

  return (
    <Card
      className={styles.card}
      title="Cấu hình giọng đọc"
      variant="borderless"
      styles={{ header: { color: '#fff' } }}
    >
      <Space orientation="vertical" size={20} style={{ width: '100%' }}>
        <div>
          <Text strong className={styles.sectionTitle}>
            Chọn giọng đọc
          </Text>

          <Radio.Group
            value={vm.voice}
            onChange={(e) => vm.setVoice(e.target.value)}
            className={styles.voiceGroup}
          >
            <Row gutter={[12, 12]}>
              {vm.voices.map((item) => (
                <Col xs={24} md={12} key={item.id}>
                  <Radio.Button value={item.id} className={styles.voiceButton}>
                    <Space orientation="vertical" size={2}>
                      <Text strong>{item.name}</Text>
                      <Text type="secondary">{item.tag}</Text>
                    </Space>
                  </Radio.Button>
                </Col>
              ))}
            </Row>
          </Radio.Group>
        </div>

        <div>
          <Text strong className={styles.sectionTitle}>
            Định dạng xuất
          </Text>
          <Select
            value={vm.format}
            onChange={vm.setFormat}
            className={styles.select}
            options={vm.formats.map((item) => ({
              value: item,
              label: item,
            }))}
          />
        </div>

        <div>
          <Text strong className={styles.sectionTitle}>
            Chủ đề
          </Text>

          <Select
            mode="multiple"
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="Chọn chủ đề có sẵn hoặc chủ đề AI đề xuất"
            value={vm.topics}
            onChange={vm.setTopics}
            className={styles.select}
            style={{ width: '100%', marginTop: 12 }}
            options={mergedTopicOptions}
          />
        </div>
      </Space>
    </Card>
  )
}