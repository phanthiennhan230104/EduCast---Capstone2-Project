import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from '../../style/create-audio/SourceCard.module.css'
import { showCancelConfirm } from './CancelAudioConfirmModal'

// ─── Inline icons ─────────────────────────────────────────────────────────────
const IconDelete = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)
const IconFileAdd = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
)
const IconUpload = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
)
const IconClose = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)
const IconFile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)


export default function SourceCard({ vm }) {
  const { t } = useTranslation()
  const fileInputRef = useRef(null)
  const isProcessing = vm.genState === 'processing'

  const handleTabChange = (nextTab) => {
    if (nextTab === vm.sourceTab) return
    if (isProcessing) {
      showCancelConfirm(() => {
        vm.cancelGenerate?.()
        vm.setSourceTab(nextTab)
      })
      return
    }
    vm.setSourceTab(nextTab)
  }

  const handleFileDrop = (e) => {
    e.preventDefault()
    e.currentTarget.classList.remove(styles.draggerOver)
    if (isProcessing) return
    const file = e.dataTransfer.files?.[0]
    if (file) vm.handleFile(file)
  }

  const handleFileDragOver = (e) => {
    e.preventDefault()
    e.currentTarget.classList.add(styles.draggerOver)
  }

  const handleFileDragLeave = (e) => {
    e.currentTarget.classList.remove(styles.draggerOver)
  }

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) vm.handleFile(file)
    e.target.value = ''
  }

  return (
    <div className={styles.card}>
      {/* ── Card header ── */}
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{t('createAudio.source.title')}</h2>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        {vm.sourceTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.tabBtn} ${vm.sourceTab === tab.key ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ TEXT TAB ══ */}
      {vm.sourceTab === 'text' && (
        <div className={styles.block}>
          {/* AI mode segmented */}
          <div className={styles.segmented}>
            {vm.aiModes.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={isProcessing}
                className={`${styles.segBtn} ${vm.aiMode === item.value ? styles.segBtnActive : ''}`}
                onClick={() => { if (!isProcessing) vm.setAiMode(item.value) }}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Text area */}
          <textarea
            className={`${styles.textarea} ${vm.textError ? styles.textareaError : ''}`}
            rows={10}
            disabled={isProcessing}
            placeholder={t('createAudio.source.textPlaceholder')}
            value={vm.text}
            onChange={(e) => { if (!isProcessing) vm.setText(e.target.value) }}
          />

          {/* Counter row */}
          <div className={styles.counterRow}>
            <div className={styles.counterActions}>
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={isProcessing}
                onClick={vm.clearText}
              >
                <IconDelete />
                {t('createAudio.source.clear')}
              </button>
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={isProcessing}
                onClick={vm.fillDemoText}
              >
                <IconFileAdd />
                {t('createAudio.source.pasteDemo')}
              </button>
            </div>
            <span className={styles.helperText}>
              {(vm.text || '').length.toLocaleString()} {t('createAudio.source.characters')} ·{' '}
              {t('createAudio.source.estimate')}: {vm.estLabel}
            </span>
          </div>
        </div>
      )}

      {/* ══ UPLOAD TAB ══ */}
      {vm.sourceTab === 'upload' && (
        <div className={styles.block}>
          {/* Drop zone */}
          <div
            className={`${styles.dragger} ${isProcessing ? styles.draggerDisabled : ''}`}
            onDrop={handleFileDrop}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onClick={() => { if (!isProcessing) fileInputRef.current?.click() }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
          >
            <div className={styles.draggerIcon}><IconUpload /></div>
            <p className={styles.draggerText}>{t('createAudio.source.uploadText')}</p>
            <p className={styles.draggerHint}>{t('createAudio.source.uploadHint')}</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />

          {/* File preview */}
          {vm.file && (
            <div className={styles.filePreview}>
              <div className={styles.fileInfo}>
                <span className={styles.fileIcon}><IconFile /></span>
                <div className={styles.fileMeta}>
                  <span className={styles.fileName}>{vm.file.name}</span>
                  <span className={vm.fileReady ? styles.fileMetaReady : styles.fileMetaLoading}>
                    {(vm.file.size / 1024 / 1024).toFixed(2)} MB ·{' '}
                    {vm.isUploadingFile
                      ? t('createAudio.source.uploading')
                      : vm.fileReady
                        ? t('createAudio.source.analyzed')
                        : t('createAudio.source.notReady')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={styles.removeFileBtn}
                disabled={isProcessing}
                onClick={vm.removeFile}
                aria-label={t('createAudio.source.clear')}
              >
                <IconClose />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}