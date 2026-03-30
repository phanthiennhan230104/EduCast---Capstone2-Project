import { Button, Card, Input, Progress, Space, Typography } from 'antd'
import {
  DownloadOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { toast } from 'react-toastify'
import styles from '../../style/create-audio/GenerateSection.module.css'
import { formatDurationVi } from '../../utils/formatDuration'

const { Text, Title } = Typography
const { TextArea } = Input

export default function GenerateSection({ vm }) {
  const handlePreview = () => {
    if (!vm.audioUrl) {
      toast.info('Chưa có audio để nghe thử')
      return
    }

    window.open(vm.audioUrl, '_blank')
  }

  const handleDownload = () => {
    if (!vm.audioUrl) {
      toast.info('Chưa có audio để tải')
      return
    }

    window.open(vm.audioUrl, '_blank')
  }

  const handleAudioLoadedMetadata = (e) => {
    const actualSeconds = Math.floor(e.currentTarget.duration || 0)

    if (actualSeconds > 0 && actualSeconds !== vm.durationSeconds) {
      vm.setDurationSeconds(actualSeconds)
      vm.setResultDur(`${formatDurationVi(actualSeconds)} • ${vm.format}`)
    }
  }

  return (
    <Space orientation="vertical" size={16} className={styles.wrapper}>
      <Button
        type="primary"
        icon={<RocketOutlined />}
        size="large"
        block
        loading={vm.genState === 'processing'}
        onClick={vm.startGenerate}
        className={styles.generateBtn}
      >
        {vm.genState === 'processing' ? 'Đang xử lý...' : 'Tạo Podcast bằng AI'}
      </Button>

      {vm.genState === 'processing' && (
        <Card className={styles.card} variant="borderless">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Title level={5} className={styles.title}>
              AI đang xử lý...
            </Title>
            <Text className={styles.subText}>{vm.procStep}</Text>
            <Progress percent={vm.progress} status="active" />
          </Space>
        </Card>
      )}

      {vm.genState === 'done' && (
        <Card className={styles.card} variant="borderless">
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Title level={5} className={styles.title}>
                Podcast đã tạo xong
              </Title>
              <Text className={styles.successText}>{vm.resultDur}</Text>
            </div>

            {vm.audioUrl && (
              <audio
                key={vm.audioUrl}
                controls
                className={styles.audio}
                onLoadedMetadata={handleAudioLoadedMetadata}
              >
                <source src={vm.audioUrl} type="audio/mpeg" />
                Trình duyệt không hỗ trợ phát audio.
              </audio>
            )}

            <div>
              <Title level={5} className={styles.title} style={{ marginBottom: 8 }}>
                Mô tả bài viết
              </Title>
              <Text className={styles.subText}>
                Bạn có thể chỉnh lại mô tả trước khi lưu nháp
              </Text>

              <TextArea
                value={vm.description}
                onChange={(e) => vm.setDescription(e.target.value)}
                rows={4}
                maxLength={300}
                placeholder="Mô tả ngắn cho podcast..."
                style={{ marginTop: 12 }}
              />

              <div style={{ marginTop: 6, textAlign: 'right' }}>
                <Text className={styles.subText}>
                  {(vm.description || '').length}/300 ký tự
                </Text>
              </div>
            </div>

            <Space wrap>
              <Button icon={<PlayCircleOutlined />} onClick={handlePreview}>
                Nghe thử
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                Tải xuống
              </Button>
              <Button icon={<RocketOutlined />} disabled>
                Đăng lên Feed
              </Button>
              <Button icon={<SaveOutlined />} onClick={vm.saveCurrentDraft}>
                Lưu nháp
              </Button>
            </Space>
          </Space>
        </Card>
      )}
    </Space>
  )
}