import { Badge, Card, Space, Steps, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import styles from '../../style/create-audio/CreateAudioHeader.module.css'

const { Title, Text } = Typography

export default function CreateAudioHeader({ step }) {
  const stepItems = [
    { title: 'Nhập nội dung' },
    { title: 'Cấu hình giọng' },
    { title: 'Tạo & xuất bản' },
  ]

  return (
    <Card className={styles.wrapper} variant="borderless">
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {/* Header Title & Badge */}
        <div>
          <Space wrap>
            <Title level={3} className={styles.title}>
              Studio Tạo Audio AI
            </Title>
            <Badge
              className={styles.badge}
              count={
                <Space size={4} style={{ color: '#faad14', fontWeight: 1000 }}>
                  AI sẵn sàng
                </Space>
              }
            />
          </Space>
          <Text className={styles.desc}>
            Chuyển văn bản hoặc tài liệu thành podcast trong vài giây
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