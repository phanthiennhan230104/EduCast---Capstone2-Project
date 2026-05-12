import { Card, Col, Radio, Row, Select, Space, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import styles from '../../style/create-audio/VoiceConfigCard.module.css'

const { Text } = Typography

export default function VoiceConfigCard({ vm }) {
  const { t } = useTranslation()
  const topicOptions = (vm.topicOptions || vm.topicsMaster || []).map((topic) => ({
    value: topic,
    label: topic,
  }))

  const aiSuggestedOptions = (vm.aiSuggestedTopics || []).map((topic) => ({
    value: topic,
    label: `${topic} (${t('createAudio.voiceConfig.aiSuggested')})`,
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
      title={t('createAudio.voiceConfig.title')}
      variant="borderless"
      styles={{ header: { color: '#fff' } }}
    >
      <Space orientation="vertical" size={20} style={{ width: '100%' }}>
        <div>
          <Text strong className={styles.sectionTitle}>
            {t('createAudio.voiceConfig.chooseVoice')}
          </Text>

          <Radio.Group
            value={vm.voice}
            onChange={(e) => {
              if (vm.genState === 'processing') {
                return
              }
              vm.setVoice(e.target.value)
            }}
            disabled={vm.genState === 'processing'}
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
            {t('createAudio.voiceConfig.outputFormat')}
          </Text>
          <Select
            value={vm.format}
            onChange={(value) => {
              if (vm.genState === 'processing') {
                return
              }
              vm.setFormat(value)
            }}
            disabled={vm.genState === 'processing'}
            className={styles.select}
            options={vm.formats.map((item) => ({
              value: item,
              label: item,
            }))}
          />
        </div>

        <div>
          <Text strong className={styles.sectionTitle}>
            {t('createAudio.voiceConfig.topics')}
          </Text>

          <Select
            mode="multiple"
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            placeholder={t('createAudio.voiceConfig.topicPlaceholder')}
            value={vm.topics}
            onChange={(value) => {
              if (vm.genState === 'processing') {
                return
              }
              vm.setTopics(value)
            }}
            disabled={vm.genState === 'processing'}
            className={styles.select}
            style={{ width: '100%', marginTop: 12 }}
            options={mergedTopicOptions}
          />
        </div>
      </Space>
    </Card>
  )
}