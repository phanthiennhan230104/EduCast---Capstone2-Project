import { useRef, useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import styles from '../../style/create-audio/GenerateSection.module.css'
import { formatDurationVi } from '../../utils/formatDuration'
import { showCancelConfirm } from './CancelAudioConfirmModal'

// ─── Tiny inline icons (no dep) ──────────────────────────────────────────────
const IconRocket = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.5-2 4-2 4s2.5-.5 4-2l9-9-2-2z"/>
    <path d="M20 4s-4.5 1-9 6l3 3c5-4.5 6-9 6-9z"/>
    <circle cx="11.5" cy="12.5" r="1"/>
  </svg>
)
const IconSave = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
)
const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21"/>
  </svg>
)
const IconPause = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1"/>
    <rect x="14" y="4" width="4" height="16" rx="1"/>
  </svg>
)
const IconVolume = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
)
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconPreview = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/>
  </svg>
)
// ─────────────────────────────────────────────────────────────────────────────

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function MiniAudioPlayer({ src }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const [volume, setVolume] = useState(80)

  useEffect(() => {
    setPlaying(false)
    setProgress(0)
    setCurrentTime('0:00')
    setDuration('0:00')
  }, [src])

  const toggle = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    el.paused ? el.play() : el.pause()
  }, [])

  const seek = useCallback((e) => {
    const el = audioRef.current
    if (!el || !el.duration) return
    el.currentTime = (Number(e.target.value) / 100) * el.duration
  }, [])

  const changeVolume = useCallback((e) => {
    const val = Number(e.target.value)
    setVolume(val)
    if (audioRef.current) audioRef.current.volume = val / 100
  }, [])

  return (
    <div className={styles.audioBox}>
      <audio
        ref={audioRef}
        src={src}
        style={{ display: 'none' }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
        onTimeUpdate={() => {
          const el = audioRef.current
          if (!el) return
          setCurrentTime(fmtTime(el.currentTime))
          setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0)
        }}
        onLoadedMetadata={() => {
          const el = audioRef.current
          if (!el) return
          setDuration(fmtTime(el.duration))
          el.volume = volume / 100
        }}
      />

      <div className={styles.customPlayer}>
        <button
          type="button"
          className={styles.playerPlayBtn}
          onClick={toggle}
          aria-label={playing ? 'Tạm dừng' : 'Phát'}
        >
          {playing ? <IconPause /> : <IconPlay />}
        </button>

        <div className={styles.playerCenter}>
          <div className={styles.playerProgressRow}>
            <span className={styles.playerTime}>{currentTime}</span>
            <div className={styles.playerProgressBar}>
              <div className={styles.playerProgressFill} style={{ width: `${progress}%` }} />
              <input
                type="range" min={0} max={100} step={0.1}
                value={progress} onChange={seek}
                className={styles.playerRange} aria-label="Seek"
              />
            </div>
            <span className={styles.playerTime}>{duration}</span>
          </div>
        </div>

        <div className={styles.playerVolumeRow}>
          <IconVolume />
          <div className={styles.playerVolumeBar}>
            <div className={styles.playerProgressFill} style={{ width: `${volume}%` }} />
            <input
              type="range" min={0} max={100}
              value={volume} onChange={changeVolume}
              className={styles.playerRange} aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GenerateSection({ vm }) {
  const { t } = useTranslation()
  const isPublishLocked = vm.activeDraftStatus === 'published'
  const isProcessing = vm.genState === 'processing'
  const isDone = vm.genState === 'done'

  const handlePreview = () => {
    if (isProcessing) { toast.info(t('createAudio.generate.waitProcessingBeforePreview')); return }
    if (!vm.audioUrl) { toast.info(t('createAudio.generate.noAudioPreview')); return }
    window.open(vm.audioUrl, '_blank')
  }

  const handleDownload = () => {
    if (isProcessing) { toast.info(t('createAudio.generate.waitProcessingBeforeDownload')); return }
    if (!vm.audioUrl) { toast.info(t('createAudio.generate.noAudioDownload')); return }
    window.open(vm.audioUrl, '_blank')
  }

  const handleCancel = () => {
    if (isProcessing) showCancelConfirm(() => vm.cancelGenerate?.())
  }

  const handleAudioMetadata = (e) => {
    const secs = Math.floor(e.currentTarget.duration || 0)
    if (secs > 0 && secs !== vm.durationSeconds) {
      vm.setDurationSeconds(secs)
      vm.setResultDur(`${formatDurationVi(secs)} • ${vm.format}`)
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* ── Generate button ── */}
      <button
        type="button"
        className={styles.generateBtn}
        disabled={isProcessing}
        onClick={vm.startGenerate}
      >
        <span className={styles.generateBtnIcon}><IconRocket /></span>
        {isProcessing
          ? t('createAudio.generate.processing')
          : t('createAudio.generate.generateButton')}
      </button>

      {/* ── Processing card ── */}
      {isProcessing && (
        <div className={styles.card}>
          <div className={styles.cardRow}>
            <span className={styles.cardTitle}>{t('createAudio.generate.aiProcessing')}</span>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
              title={t('createAudio.generate.stopAudioTitle')}
            >
              <IconClose />
            </button>
          </div>

          <div className={styles.progressWrap}>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${vm.progress || 0}%` }}
              />
            </div>
            <span className={styles.progressLabel}>{vm.progress || 0}%</span>
          </div>

          <p className={styles.subText}>{vm.procStep}</p>
        </div>
      )}

      {/* ── Done card ── */}
      {isDone && (
        <div className={styles.card}>
          {/* Header */}
          <div className={styles.doneHeader}>
            <span className={styles.cardTitle}>{t('createAudio.generate.doneTitle')}</span>
            {vm.resultDur && <span className={styles.successBadge}>{vm.resultDur}</span>}
          </div>

          {/* Audio player */}
          {vm.audioUrl && <MiniAudioPlayer key={vm.audioUrl} src={vm.audioUrl} />}

          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label}>{t('createAudio.generate.postTitle')}</label>
            <p className={styles.hint}>{t('createAudio.generate.editTitleHint')}</p>
            <input
              type="text"
              className={styles.input}
              placeholder={t('createAudio.generate.titlePlaceholder')}
              value={vm.title}
              maxLength={150}
              onChange={(e) => vm.setTitle(e.target.value)}
            />
            <div className={styles.charCount}>
              {(vm.title || '').length}/150 {t('createAudio.generate.characters')}
            </div>
          </div>

          {/* Description */}
          <div className={styles.field}>
            <label className={styles.label}>{t('createAudio.generate.postDescription')}</label>
            <p className={styles.hint}>{t('createAudio.generate.editDescriptionHint')}</p>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              rows={4}
              placeholder={t('createAudio.generate.descriptionPlaceholder')}
              value={vm.description}
              maxLength={500}
              onChange={(e) => vm.setDescription(e.target.value)}
            />
            <div className={styles.charCount}>
              {(vm.description || '').length}/500 {t('createAudio.generate.characters')}
            </div>
          </div>

          {/* Action buttons */}
          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handlePreview}
              disabled={isProcessing}
            >
              <IconPreview />
              {t('createAudio.generate.preview')}
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleDownload}
              disabled={isProcessing}
            >
              <IconDownload />
              {t('createAudio.generate.download')}
            </button>

            <button
              type="button"
              className={styles.primaryButton}
              onClick={vm.goToPublish}
              disabled={isProcessing || !vm.audioUrl || isPublishLocked}
              title={isPublishLocked ? t('createAudio.generate.alreadyPublished') : undefined}
            >
              <IconRocket />
              {t('createAudio.generate.continuePublish')}
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={vm.saveCurrentDraft}
            >
              <IconSave />
              {t('createAudio.generate.saveDraft')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}