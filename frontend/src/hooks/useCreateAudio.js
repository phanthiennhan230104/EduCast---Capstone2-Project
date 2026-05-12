import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'

import {
  getMyDrafts,
  previewAudio,
  saveDraftWithAudio,
  uploadDocument,
  getDraftDetail,
  getTopics,
} from '../utils/contentApi'

import { formatDurationVi } from '../utils/formatDuration'

const VOICE_NAME_MAP = {
  'vi-hoai-my': 'vi-VN-HoaiMyNeural',
  'vi-nam-minh': 'vi-VN-NamMinhNeural',
  'en-andrew': 'en-US-AndrewNeural',
  'en-ava': 'en-US-AvaNeural',
}

const VOICE_ID_BY_NAME = {
  'vi-VN-HoaiMyNeural': 'vi-hoai-my',
  'vi-VN-NamMinhNeural': 'vi-nam-minh',
  'en-US-AndrewNeural': 'en-andrew',
  'en-US-AvaNeural': 'en-ava',
}

export function useCreateAudio() {
  const { t } = useTranslation()

  const demoText = `Kỹ năng mềm là tập hợp những khả năng giúp con người tương tác, làm việc và thích nghi hiệu quả trong môi trường sống và làm việc.`

  const voices = [
    {
      id: 'vi-hoai-my',
      name: 'Hoài My',
      tag: 'Nữ · Việt Nam · Kể chuyện tự nhiên',
    },
    {
      id: 'vi-nam-minh',
      name: 'Nam Minh',
      tag: 'Nam · Việt Nam · Rõ ràng học thuật',
    },
    {
      id: 'en-andrew',
      name: 'Andrew',
      tag: 'Male · English US · Storytelling',
    },
    {
      id: 'en-ava',
      name: 'Ava',
      tag: 'Female · English US · Instructional',
    },
  ]

  const formats = ['MP3', 'WAV', 'OGG', 'AAC']

  const aiModes = [
    { value: 'summary', label: t('createAudio.hook.aiModes.summary') },
    { value: 'dialogue', label: t('createAudio.hook.aiModes.dialogue') },
    { value: 'original', label: t('createAudio.hook.aiModes.original') },
    { value: 'translate', label: t('createAudio.hook.aiModes.translate') },
  ]

  const sourceTabs = [
    { key: 'text', label: t('createAudio.hook.sourceTabs.text') },
    { key: 'upload', label: t('createAudio.hook.sourceTabs.upload') },
  ]

  const [step, setStep] = useState(2)
  const [sourceTab, setSourceTab] = useState('text')
  const [aiMode, setAiMode] = useState('summary')

  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [fileReady, setFileReady] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  const [uploadedDocUrl, setUploadedDocUrl] = useState('')
  const [uploadedDocPublicId, setUploadedDocPublicId] = useState('')
  const [uploadedExtractedText, setUploadedExtractedText] = useState('')

  const [voice, setVoice] = useState('vi-hoai-my')
  const [format, setFormat] = useState('MP3')

  // Topics from DB only
  const [topics, setTopics] = useState([])
  const [topicOptions, setTopicOptions] = useState([])

  const [genState, setGenState] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [procStep, setProcStep] = useState('')
  const [resultDur, setResultDur] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [textError, setTextError] = useState(false)

  const [processedText, setProcessedText] = useState('')
  const [publicId, setPublicId] = useState('')
  const [recentDrafts, setRecentDrafts] = useState([])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [activeDraftId, setActiveDraftId] = useState('')
  const [activeDraftStatus, setActiveDraftStatus] = useState('')
  const [isLoadingDraft, setIsLoadingDraft] = useState(false)

  const [durationSeconds, setDurationSeconds] = useState(0)

  const previewAbortRef = useRef(null)
  const isCancelledRef = useRef(false)

  // Load topics from DB
  useEffect(() => {
    let mounted = true

    const loadTopics = async () => {
      try {
        const response = await getTopics()

        const list = response?.data ?? response ?? []

        const rawItems = Array.isArray(list)
          ? list
          : Array.isArray(list?.results)
            ? list.results
            : []

        const options = rawItems
          .map((item) => ({
            id: item?.id,
            name: item?.name || item?.topic_name || '',
          }))
          .filter((item) => item.id && item.name)

        if (mounted) {
          setTopicOptions(options)
        }
      } catch (error) {
        console.error('Load topics error:', error)

        if (mounted) {
          setTopicOptions([])
        }
      }
    }

    loadTopics()

    return () => {
      mounted = false
    }
  }, [])

  const selectedVoiceName = useMemo(() => {
    return VOICE_NAME_MAP[voice] || 'vi-VN-HoaiMyNeural'
  }, [voice])

  const currentSourceText = useMemo(() => {
    return sourceTab === 'upload'
      ? uploadedExtractedText || ''
      : text || ''
  }, [sourceTab, text, uploadedExtractedText])

  const words = useMemo(() => {
    const baseText = processedText || currentSourceText || ''
    const normalized = baseText.trim()

    if (!normalized) return 0

    return normalized.split(/\s+/).length
  }, [processedText, currentSourceText])

  const estLabel = useMemo(() => {
    if (!words) return '—'

    const estimatedSeconds = Math.round((words / 130) * 60)

    return formatDurationVi(estimatedSeconds)
  }, [words])

  const resetGenerateState = useCallback(() => {
    setProcessedText('')
    setAudioUrl('')
    setPublicId('')
    setResultDur('')
    setGenState('idle')
    setProgress(0)
    setProcStep('')
    setTitle('')
    setDescription('')
    setDurationSeconds(0)
  }, [])

  const loadRecentDrafts = useCallback(async () => {
    try {
      const res = await getMyDrafts()
      setRecentDrafts(Array.isArray(res?.data) ? res.data : [])
    } catch (error) {
      console.error('Load drafts error:', error)
      setRecentDrafts([])
    }
  }, [])

  useEffect(() => {
    loadRecentDrafts()
  }, [loadRecentDrafts])

  return {
    step,
    setStep,

    sourceTab,
    setSourceTab,

    aiMode,
    setAiMode,

    text,
    setText,

    file,
    setFile,

    fileReady,
    setFileReady,

    isUploadingFile,
    setIsUploadingFile,

    uploadedDocUrl,
    setUploadedDocUrl,

    uploadedDocPublicId,
    setUploadedDocPublicId,

    uploadedExtractedText,
    setUploadedExtractedText,

    voice,
    setVoice,

    format,
    setFormat,

    topics,
    setTopics,

    topicOptions,
    setTopicOptions,

    genState,
    setGenState,

    progress,
    setProgress,

    procStep,
    setProcStep,

    resultDur,
    setResultDur,

    durationSeconds,
    setDurationSeconds,

    audioUrl,
    setAudioUrl,

    textError,
    setTextError,

    processedText,
    setProcessedText,

    publicId,
    setPublicId,

    recentDrafts,
    setRecentDrafts,

    title,
    setTitle,

    description,
    setDescription,

    activeDraftId,
    setActiveDraftId,

    activeDraftStatus,
    setActiveDraftStatus,

    isLoadingDraft,
    setIsLoadingDraft,

    words,
    estLabel,

    voices,
    formats,
    aiModes,
    sourceTabs,

    demoText,

    resetGenerateState,
    loadRecentDrafts,

    selectedVoiceName,

    previewAbortRef,
    isCancelledRef,

    // APIs
    previewAudio,
    saveDraftWithAudio,
    uploadDocument,
    getDraftDetail,

    // utils
    toast,
    t,
  }
}