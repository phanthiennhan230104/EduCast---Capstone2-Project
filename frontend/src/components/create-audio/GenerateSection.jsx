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
import { useTranslation } from 'react-i18next'


const { Text, Title } = Typography
const { TextArea } = Input

export default function GenerateSection({ vm }) {
  const { t } = useTranslation()
  const isPublishLocked = vm.activeDraftStatus === 'published'

  const handlePreview = () => {
    if (vm.genState === 'processing') {
      toast.info(t('createAudio.generate.waitProcessingBeforePreview'))
      return
    }

    if (!vm.audioUrl) {
      toast.info(t('createAudio.generate.noAudioPreview'))
      return
    }

    window.open(vm.audioUrl, '_blank')
  }

  const handleDownload = () => {
    if (vm.genState === 'processing') {
      toast.info(t('createAudio.generate.waitProcessingBeforeDownload'))
      return
    }

    if (!vm.audioUrl) {
      toast.info(t('createAudio.generate.noAudioDownload'))
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
        {vm.genState === 'processing'
  ? t('createAudio.generate.processing')
  : t('createAudio.generate.generateButton')}
      </Button>

      {vm.genState === 'processing' && (
        <Card className={styles.card} variant="borderless">
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={5} className={styles.title} style={{ margin: 0 }}>
                {t('createAudio.generate.aiProcessing')}
              </Title>

              <Button
                type="text"
                danger
                icon={<CloseOutlined />}
                size="small"
                onClick={handleCancelProcess}
                title={t('createAudio.generate.stopAudioTitle')}
              />
            </div>

            <Progress percent={vm.progress} strokeColor="#7f8cff" format={() => `${vm.progress}%`} />
            <Text className={styles.subText}>{vm.procStep}</Text>
          </Space>
        </Card>
      )}

      {vm.genState === 'done' && (
        <Card className={styles.card} variant="borderless">
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Title level={5} className={styles.title}>
                {t('createAudio.generate.doneTitle')}
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
                {t('createAudio.generate.browserNotSupport')}
              </audio>
            )}

            <div>
              <Title level={5} className={styles.title} style={{ marginBottom: 8 }}>
                {t('createAudio.generate.postTitle')}
              </Title>
              <Text className={styles.subText}>
                {t('createAudio.generate.editTitleHint')}
              </Text>

              <Input
                value={vm.title}
                onChange={(e) => vm.setTitle(e.target.value)}
                maxLength={120}
                placeholder={t('createAudio.generate.titlePlaceholder')}
                maxLength={150}
                placeholder="Nhập tiêu đề cho bài audio..."
                style={{ marginTop: 12 }}
              />

              <div style={{ marginTop: 6, textAlign: 'right' }}>
                <Text className={styles.subText}>
                  {(vm.title || '').length}/120 {t('createAudio.generate.characters')}
                </Text>
              </div>
            </div>

            <div>
              <Title level={5} className={styles.title} style={{ marginBottom: 8 }}>
                {t('createAudio.generate.postDescription')}
              </Title>
              <Text className={styles.subText}>
                {t('createAudio.generate.editDescriptionHint')}
              </Text>

              <TextArea
                value={vm.description}
                onChange={(e) => vm.setDescription(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder={t('createAudio.generate.descriptionPlaceholder')}
                style={{ marginTop: 12 }}
              />

              <div style={{ marginTop: 6, textAlign: 'right' }}>
                <Text className={styles.subText}>
                  {(vm.description || '').length}/500 {t('createAudio.generate.characters')}
                </Text>
              </div>
            </div>

            <Space wrap>
              <Button
                icon={<PlayCircleOutlined />}
                onClick={handlePreview}
                disabled={vm.genState === 'processing'}
              >
                {t('createAudio.generate.preview')}
              </Button>

              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                disabled={vm.genState === 'processing'}
              >
                {t('createAudio.generate.download')}
              </Button>

              <Button
                type="primary"
                icon={<RocketOutlined />}
                onClick={vm.goToPublish}
                disabled={vm.genState === 'processing' || !vm.audioUrl || isPublishLocked}
                title={isPublishLocked ? t('createAudio.generate.alreadyPublished') : undefined}
              >
                {t('createAudio.generate.continuePublish')}
              </Button>

              <Button icon={<SaveOutlined />} onClick={vm.saveCurrentDraft}>
                {t('createAudio.generate.saveDraft')}
              </Button>
            </Space>
          </Space>
        </Card>
      )}
    </Space>
  )
}