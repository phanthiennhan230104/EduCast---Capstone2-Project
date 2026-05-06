import { createPortal } from 'react-dom'
import { Button, Card, Input, Progress, Space, Typography } from 'antd'
import {
  DownloadOutlined,
  PlayCircleOutlined,
  RocketOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { toast } from 'react-toastify'
import styles from '../../style/create-audio/GenerateSection.module.css'
import { formatDurationVi } from '../../utils/formatDuration'
import { showCancelConfirm } from './CancelAudioConfirmModal'

const { Text, Title } = Typography
const { TextArea } = Input

export default function GenerateSection({ vm }) {
  const handlePreview = () => {
    if (vm.genState === 'processing') {
      toast.info('Vui lòng đợi tạo audio xong trước khi nghe thử')
      return
    }

    if (!vm.audioUrl) {
      toast.info('Chưa có audio để nghe thử')
      return
    }

    window.open(vm.audioUrl, '_blank')
  }

  const handleDownload = () => {
    if (vm.genState === 'processing') {
      toast.info('Vui lòng đợi tạo audio xong trước khi tải xuống')
      return
    }

    if (!vm.audioUrl) {
      toast.info('Chưa có audio để tải')
      return
    }

    window.open(vm.audioUrl, '_blank')
  }

  const handleCancelProcess = () => {
    if (vm.genState === 'processing') {
      showCancelConfirm(() => {
        vm.cancelGenerate?.()
      })
    }
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={5} className={styles.title} style={{ margin: 0 }}>
                AI đang xử lý...
              </Title>

              <Button
                type="text"
                danger
                icon={<CloseOutlined />}
                size="small"
                onClick={handleCancelProcess}
                title="Dừng quá trình tạo audio"
              />
            </div>

            <Text className={styles.subText}>{vm.procStep}</Text>
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
                Tiêu đề bài viết
              </Title>
              <Text className={styles.subText}>
                Bạn có thể xem và chỉnh sửa tiêu đề trước khi lưu nháp hoặc đăng bài
              </Text>

              <Input
                value={vm.title}
                onChange={(e) => vm.setTitle(e.target.value)}
                maxLength={120}
                placeholder="Nhập tiêu đề cho bài audio..."
                style={{ marginTop: 12 }}
              />

              <div style={{ marginTop: 6, textAlign: 'right' }}>
                <Text className={styles.subText}>
                  {(vm.title || '').length}/120 ký tự
                </Text>
              </div>
            </div>

            <div>
              <Title level={5} className={styles.title} style={{ marginBottom: 8 }}>
                Mô tả bài viết
              </Title>
              <Text className={styles.subText}>
                Bạn có thể xem và chỉnh sửa mô tả trước khi lưu nháp hoặc đăng bài
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
              <Button
                icon={<PlayCircleOutlined />}
                onClick={handlePreview}
                disabled={vm.genState === 'processing'}
              >
                Nghe thử
              </Button>

              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                disabled={vm.genState === 'processing'}
              >
                Tải xuống
              </Button>

              <Button
                type="primary"
                icon={<RocketOutlined />}
                onClick={vm.goToPublish}
                disabled={vm.genState === 'processing' || !vm.audioUrl}
              >
                Tiếp tục đăng bài
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