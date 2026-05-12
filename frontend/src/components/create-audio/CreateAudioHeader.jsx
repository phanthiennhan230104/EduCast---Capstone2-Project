import { Badge, Card, Space, Steps, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import styles from '../../style/create-audio/CreateAudioHeader.module.css'

const { Title, Text } = Typography

export default function CreateAudioHeader({ step }) {
  const { t } = useTranslation()
  const stepItems = [
  { title: t('createAudio.header.stepContent') },
  { title: t('createAudio.header.stepVoice') },
  { title: t('createAudio.header.stepPublish') },
]

  return (
    <Card className={styles.wrapper} variant="borderless">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {/* Header Title & Badge */}
        <div>
          <Space wrap>
            <Title level={3} className={styles.title}>
              {t('createAudio.header.title')}
            </Title>
            <Badge
              className={styles.badge}
              count={
                <Space size={4} style={{ color: '#faad14', fontWeight: 1000 }}>
                  {t('createAudio.header.aiReady')}
                </Space>
              }
            />
          </Space>
          <Text className={styles.desc}>
            {t('createAudio.header.description')}
          </Text>
        </div>

        {/* Steps */}
        <Steps 
          current={Math.max(0, step - 1)} 
          items={stepItems} 
          responsive 
          className={styles.steps}
        />
      </Space>
    </Card>
  )
}