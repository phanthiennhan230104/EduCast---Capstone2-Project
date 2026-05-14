import { ConfigProvider, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import styles from '../../style/create-audio/VoiceConfigCard.module.css'

// ── Same Ant Design theme as PublishPostPage ──────────────────────────────────
const COLOR_SCHEMA = {
  primary: '#f4a227',
  primaryHover: '#ffb84d',
  primaryActive: '#ff9d1d',
  chipText: '#ffca72',
  chipBg: 'rgba(244, 162, 39, 0.16)',
  chipBorder: 'rgba(244, 162, 39, 0.24)',
  chipBgHover: 'rgba(244, 162, 39, 0.22)',
  textPrimary: '#f5f0e8',
  textSecondary: 'rgba(245, 240, 232, 0.66)',
  textMuted: 'rgba(245, 240, 232, 0.38)',
  borderPrimary: 'rgba(245, 240, 232, 0.11)',
  borderSecondary: 'rgba(245, 240, 232, 0.08)',
  bgInput: 'rgba(8, 12, 27, 0.74)',
  bgElevated: '#1a2442',
  hoverOverlay: 'rgba(255, 255, 255, 0.06)',
  shadowSecondary: '0 0 0 3px rgba(244, 162, 39, 0.1)',
}

const ANT_SELECT_THEME = {
  token: {
    colorBgContainer: COLOR_SCHEMA.bgInput,
    colorBgElevated: COLOR_SCHEMA.bgElevated,
    colorBgElevatedSecondary: 'rgba(15, 18, 40, 0.92)',
    colorBorder: COLOR_SCHEMA.borderPrimary,
    colorBorderSecondary: COLOR_SCHEMA.borderSecondary,
    colorText: COLOR_SCHEMA.textPrimary,
    colorTextPlaceholder: COLOR_SCHEMA.textMuted,
    colorTextSecondary: COLOR_SCHEMA.textSecondary,
    colorPrimary: COLOR_SCHEMA.primary,
    colorPrimaryHover: COLOR_SCHEMA.primaryHover,
    colorPrimaryActive: COLOR_SCHEMA.primaryActive,
    colorPrimaryBorder: COLOR_SCHEMA.chipBorder,
    borderRadius: 14,
    borderRadiusLG: 16,
    controlHeight: 44,
    controlPaddingHorizontal: 14,
    fontSize: 14,
    fontWeightStrong: 700,
    lineHeight: 1.4,
    lineHeightLG: 1.5,
    boxShadowSecondary: COLOR_SCHEMA.shadowSecondary,
  },
  components: {
    Select: {
      selectorBg: COLOR_SCHEMA.bgInput,
      controlHeight: 44,
      multipleItemBg: COLOR_SCHEMA.chipBg,
      multipleItemBorderColor: COLOR_SCHEMA.chipBorder,
      multipleItemHeight: 28,
      multipleItemHeightSm: 28,
      multipleItemColorBgEllipsis: 'rgba(244, 162, 39, 0.12)',
      multipleItemColorTextEllipsis: COLOR_SCHEMA.chipText,
      optionSelectedBg: 'rgba(244, 162, 39, 0.18)',
      optionSelectedFontWeight: 700,
      optionActiveBg: COLOR_SCHEMA.hoverOverlay,
      optionPadding: '8px 12px',
      optionFontSize: 14,
      optionLineHeight: 1.5,
      optionBorderRadius: 8,
      controlItemBgHover: COLOR_SCHEMA.chipBgHover,
      colorTextPlaceholder: COLOR_SCHEMA.textMuted,
    },
  },
}
// ─────────────────────────────────────────────────────────────────────────────

export default function VoiceConfigCard({ vm }) {
  const { t } = useTranslation()
  const isProcessing = vm.genState === 'processing'

  const topicOptions = (vm.topicOptions || vm.topicsMaster || [])
    .map((topic) => {
      if (typeof topic === 'string') return { value: topic, label: topic }
      return {
        value: topic.id || topic.name || topic.topic_name,
        label: topic.name || topic.topic_name || 'Chủ đề',
      }
    })
    .filter((item) => item.value && item.label)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{t('createAudio.voiceConfig.title')}</h2>
      </div>

      {/* ── Chọn giọng ── */}
      <div className={styles.section}>
        <label className={styles.label}>{t('createAudio.voiceConfig.chooseVoice')}</label>
        <div className={styles.voiceGrid}>
          {vm.voices.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={isProcessing}
              className={`${styles.voiceBtn} ${vm.voice === item.id ? styles.voiceBtnActive : ''}`}
              onClick={() => { if (!isProcessing) vm.setVoice(item.id) }}
            >
              <span className={styles.voiceName}>{item.name}</span>
              <span className={styles.voiceTag}>{item.tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Định dạng đầu ra ── */}
      <div className={styles.section}>
        <label className={styles.label}>{t('createAudio.voiceConfig.outputFormat')}</label>
        <select
          disabled={isProcessing}
          value={vm.format}
          onChange={(e) => { if (!isProcessing) vm.setFormat(e.target.value) }}
          className={styles.select}
        >
          {(vm.formats || []).map((fmt) => (
            <option key={fmt} value={fmt}>{fmt}</option>
          ))}
        </select>
      </div>

      {/* ── Chủ đề — Ant Design Select giống PublishPostPage ── */}
      <div className={styles.section}>
        <label className={styles.label}>{t('createAudio.voiceConfig.topics')}</label>
        <ConfigProvider theme={ANT_SELECT_THEME}>
          <Select
            className={styles.topicSelect}
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('createAudio.voiceConfig.selectTopics')}
            value={vm.topics || []}
            onChange={(value) => { if (!isProcessing) vm.setTopics(value) }}
            disabled={isProcessing}
            style={{ width: '100%' }}
            options={topicOptions}
          />
        </ConfigProvider>
      </div>
    </div>
  )
}