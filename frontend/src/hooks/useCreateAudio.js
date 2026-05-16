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
import { getToken } from '../utils/auth'
import { WS_ORIGIN } from '../config/apiBase'

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

import { useLocation } from 'react-router-dom'

export function useCreateAudio() {
  const { t } = useTranslation()
  const location = useLocation()

  const demoText = t('createAudio.hook.demoText')
  const voices = [
    {
      id: 'vi-hoai-my',
      name: t('createAudio.hook.voices.hoaiMy.name'),
      tag: t('createAudio.hook.voices.hoaiMy.tag'),
    },
    {
      id: 'vi-nam-minh',
      name: t('createAudio.hook.voices.namMinh.name'),
      tag: t('createAudio.hook.voices.namMinh.tag'),
    },
    {
      id: 'en-andrew',
      name: t('createAudio.hook.voices.andrew.name'),
      tag: t('createAudio.hook.voices.andrew.tag'),
    },
    {
      id: 'en-ava',
      name: t('createAudio.hook.voices.ava.name'),
      tag: t('createAudio.hook.voices.ava.tag'),
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

  const initialText = location.state?.initialText || ''

  const [text, setText] = useState(initialText)
  const [file, setFile] = useState(null)
  const [fileReady, setFileReady] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  const [uploadedDocUrl, setUploadedDocUrl] = useState('')
  const [uploadedDocPublicId, setUploadedDocPublicId] = useState('')
  const [uploadedExtractedText, setUploadedExtractedText] = useState('')

  const [voice, setVoice] = useState('vi-hoai-my')
  const [format, setFormat] = useState('MP3')
  const [topics, setTopics] = useState([])

  const [topicOptions, setTopicOptions] = useState([])
  const [aiSuggestedTopics, setAiSuggestedTopics] = useState([])

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

  useEffect(() => {
    if (location.state?.initialText) {
      setText(location.state.initialText)
      setSourceTab('text')
    }
  }, [location.state?.initialText])

  useEffect(() => {
    if (genState !== 'processing') return

    const incrementProgress = () => {
      setProgress((prevProgress) => {
        if (prevProgress >= 90) return prevProgress
        // Giảm % tăng mỗi lần xuống khoảng 1% - 3%
        const increment = Math.floor(Math.random() * 3) + 1
        return Math.min(prevProgress + increment, 90)
      })
    }

    // Tăng thời gian ngẫu nhiên lên 1.2s - 2.0s để thanh tiến độ chạy chậm lại
    const intervalId = window.setInterval(incrementProgress, 1200 + Math.random() * 800)

    return () => window.clearInterval(intervalId)
  }, [genState])

  const selectedVoiceName = useMemo(() => {
    return VOICE_NAME_MAP[voice] || 'vi-VN-HoaiMyNeural'
  }, [voice])

  const currentSourceText = useMemo(() => {
    return sourceTab === 'upload' ? uploadedExtractedText || '' : text || ''
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
    setAiSuggestedTopics([])
    setTitle('')
    setDescription('')
    setDurationSeconds(0)
  }, [])

  const cancelGenerate = useCallback(() => {
    isCancelledRef.current = true

    if (previewAbortRef.current) {
      previewAbortRef.current.abort()
      previewAbortRef.current = null
    }

    setGenState('idle')
    setProgress(0)
    setProcStep('')
    setStep(2)
    setProcessedText('')
    setAudioUrl('')
    setPublicId('')
    setResultDur('')
    setTitle('')
    setDescription('')
    setDurationSeconds(0)

    toast.info(t('createAudio.hook.cancelled', { defaultValue: 'Đã dừng quá trình tạo audio' }))
  }, [t])

  const loadRecentDrafts = useCallback(async () => {
    try {
      const res = await getMyDrafts()
      setRecentDrafts(Array.isArray(res?.data) ? res.data : [])
    } catch (error) {
      console.error(t('createAudio.hook.loadDraftsError'), error)
      setRecentDrafts([])
    }
  }, [t])

  useEffect(() => {
    loadRecentDrafts()
  }, [loadRecentDrafts])

  useEffect(() => {
    let mounted = true

    const loadTopicOptions = async () => {
      try {
        const response = await getTopics()
        const list = response?.data ?? response ?? []

        const rawItems = Array.isArray(list)
          ? list
          : Array.isArray(list?.results)
            ? list.results
            : []

        const options = rawItems
          .map((item) => {
            const id = item?.id || item?.name || item?.topic_name || ''
            const name = item?.name || item?.topic_name || ''

            return {
              id,
              name,
            }
          })
          .filter((item) => item.id && item.name)

        if (!mounted) return

        setTopicOptions(options)
        setTopics((prev) =>
          prev.filter((topic) =>
            options.some((item) => item.id === topic || item.name === topic)
          )
        )
      } catch (error) {
        console.error('Load topics error:', error)

        if (mounted) {
          setTopicOptions([])
        }
      }
    }

    loadTopicOptions()

    return () => {
      mounted = false
    }
  }, [])

  const normalizeTopics = (items) => {
    if (!Array.isArray(items)) return []

    return items
      .map((item) => {
        if (typeof item === 'string') return item
        return item?.id || item?.name || item?.topic_name || ''
      })
      .filter(Boolean)
  }

  const loadDraftToForm = useCallback(async (draftId) => {
    if (!draftId) return

    try {
      setActiveDraftId(draftId)
      setIsLoadingDraft(true)

      const res = await getDraftDetail(draftId)
      const draft = res?.data || {}

      const documents = Array.isArray(draft.documents) ? draft.documents : []
      const defaultAudio = Array.isArray(draft.audio_versions)
        ? draft.audio_versions.find((item) => item.is_default) || draft.audio_versions[0]
        : null

      const hasDocument = draft.source_type === 'uploaded_document'
      const resolvedAudioUrl = draft.audio_url || defaultAudio?.audio_url || ''
      const resolvedDurationSeconds = Number(
        draft.duration_seconds || defaultAudio?.duration_seconds || 0
      )
      const resolvedFormat = String(defaultAudio?.format || 'mp3').toUpperCase()

      setSourceTab(hasDocument ? 'upload' : 'text')

      const originalText = draft.original_text || ''
      setText(hasDocument ? '' : originalText)
      setUploadedExtractedText(hasDocument ? originalText : '')

      setTitle(draft.title || '')
      setDescription(draft.description || '')
      setAudioUrl(resolvedAudioUrl)
      setPublicId(defaultAudio?.public_id || draft.public_id || '')
      setActiveDraftStatus(draft.status || '')
      setFileReady(hasDocument)
      setDurationSeconds(resolvedDurationSeconds)

      setUploadedDocUrl(documents[0]?.document_url || '')
      setUploadedDocPublicId(documents[0]?.storage_path || documents[0]?.public_id || '')

      if (hasDocument && documents[0]) {
        setFile({
          name: documents[0].file_name || 'document',
          size: documents[0].file_size || 0,
          type: documents[0].file_type || '',
        })
      } else {
        setFile(null)
      }

      const detectedMode = draft.summary_text
        ? 'summary'
        : draft.dialogue_script
          ? 'dialogue'
          : draft.transcript_text && draft.is_ai_generated
            ? 'translate'
            : draft.mode || draft.ai_mode || 'original'

      setAiMode(detectedMode)

      const processed =
        draft.summary_text ||
        draft.dialogue_script ||
        draft.transcript_text ||
        draft.processed_text ||
        ''

      setProcessedText(processed)

      if (resolvedDurationSeconds > 0) {
        setResultDur(`${formatDurationVi(resolvedDurationSeconds)} • ${resolvedFormat}`)
      } else {
        setResultDur('')
      }

      setFormat(resolvedFormat)

      const savedVoiceName =
        defaultAudio?.voice_name ||
        draft.voice_name ||
        draft.voice ||
        ''

      setVoice(VOICE_ID_BY_NAME[savedVoiceName] || savedVoiceName || 'vi-hoai-my')

      setTopics(normalizeTopics(draft.topics || draft.topic_ids || []))

      setGenState(resolvedAudioUrl ? 'done' : 'idle')
      setProgress(0)
      setProcStep('')
      setStep(resolvedAudioUrl ? 3 : 2)

      toast.success('Đã tải bản nháp lên giao diện')
    } catch (error) {
      console.error('Load draft detail error:', error)
      toast.error(error?.message || 'Không thể tải lại bản nháp')
    } finally {
      setIsLoadingDraft(false)
    }
  }, [])

  const handleFile = useCallback(async (file) => {
    if (!file) return

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('createAudio.hook.invalidFileType', { defaultValue: 'Chỉ hỗ trợ PDF, DOC, DOCX, TXT' }))
      return
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      toast.error(t('createAudio.hook.fileTooLarge', { defaultValue: 'File quá lớn. Tối đa 10MB' }))
      return
    }

    setFile(file)
    setFileReady(false)
    setIsUploadingFile(true)
    setUploadedExtractedText('')
    setUploadedDocUrl('')
    setUploadedDocPublicId('')
    resetGenerateState()

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await uploadDocument(formData)
      const data = res?.data || res || {}

      const extractedText = data.extracted_text || ''
      const docUrl = data.document_url || ''
      const docPublicId = data.public_id || ''

      setUploadedExtractedText(extractedText)
      setUploadedDocUrl(docUrl)
      setUploadedDocPublicId(docPublicId)
      setFileReady(true)

      toast.success(t('createAudio.hook.fileUploadSuccess', { defaultValue: 'Tải tài liệu thành công' }))
    } catch (error) {
      console.error('Upload document error:', error)
      toast.error(error?.message || t('createAudio.hook.fileUploadFailed', { defaultValue: 'Tải tài liệu thất bại' }))
      setFile(null)
      setFileReady(false)
    } finally {
      setIsUploadingFile(false)
    }
  }, [resetGenerateState, t])

  const removeFile = useCallback(() => {
    setFile(null)
    setFileReady(false)
    setIsUploadingFile(false)
    setUploadedExtractedText('')
    setUploadedDocUrl('')
    setUploadedDocPublicId('')
    resetGenerateState()
  }, [resetGenerateState])

  const clearText = useCallback(() => {
    setText('')
    setUploadedExtractedText('')
    setFile(null)
    setFileReady(false)

    setActiveDraftId('')
    setActiveDraftStatus('')

    resetGenerateState()
  }, [resetGenerateState])

  const fillDemoText = useCallback(() => {
    setSourceTab('text')
    setText(demoText)
    setTextError(false)

    resetGenerateState()

    toast.success(
      t('createAudio.hook.sampleInserted', {
        defaultValue: 'Đã chèn văn bản mẫu',
      })
    )
  }, [demoText, resetGenerateState, t])

  const startGenerate = useCallback(async () => {
    const inputText =
      sourceTab === 'upload'
        ? (uploadedExtractedText || '').trim()
        : (text || '').trim()

    const isValid =
      (sourceTab === 'text' && !!inputText) ||
      (sourceTab === 'upload' && fileReady && !!inputText)

    if (!isValid) {
      if (sourceTab === 'text') {
        setTextError(true)
        window.setTimeout(() => setTextError(false), 1200)
      }

      toast.error(
        sourceTab === 'upload'
          ? t('createAudio.hook.invalidUploadInput')
          : t('createAudio.hook.invalidTextInput')
      )
      return
    }

    if (previewAbortRef.current) {
      previewAbortRef.current.abort()
      previewAbortRef.current = null
    }

    const controller = new AbortController()
    previewAbortRef.current = controller
    isCancelledRef.current = false

    const taskId = crypto.randomUUID()

    try {
      setGenState('processing')
      setStep(3)
      setProgress(0)
      setProcStep(
        sourceTab === 'upload'
          ? t('createAudio.hook.processingDocument')
          : t('createAudio.hook.sendingAudioRequest')
      )

      setProcessedText('')
      setAudioUrl('')
      setPublicId('')
      setResultDur('')
      setAiSuggestedTopics([])
      setDescription('')
      setDurationSeconds(0)

      const token = getToken()
      const wsUrl = `${WS_ORIGIN}/ws/audio-progress/${taskId}/?token=${token}`
      const ws = new WebSocket(wsUrl)
      
      const wsPromise = new Promise((resolve, reject) => {
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.status === 'generating') {
              setProgress(data.progress || 0)
              setProcStep(data.step || '')
            } else if (data.status === 'done') {
              ws.close()
              resolve(data.data) 
            } else if (data.status === 'error') {
              ws.close()
              reject(new Error(data.step || t('createAudio.hook.generateFailed')))
            }
          } catch (e) {
            console.error('WS Parse Error', e)
          }
        }
        ws.onerror = (error) => {
          console.error('WebSocket Error', error)
        }
      })

      // Send the request. Backend now returns immediately.
      await previewAudio(
        {
          original_text: inputText,
          mode: aiMode,
          voice_name: selectedVoiceName,
          task_id: taskId,
        },
        controller.signal
      )

      if (isCancelledRef.current) {
        ws.close()
        return
      }

      // Wait for background task to finish via WebSocket
      const preview = await wsPromise

      if (isCancelledRef.current) return

      const resolvedAudioUrl = preview.audio_url || ''
      const resolvedDurationSeconds = Number(preview.duration_seconds || 0)
      const generatedTitle =
        (preview.generated_title || '').trim() ||
        inputText.slice(0, 80).trim() ||
        t('createAudio.hook.draftTitleFallback')

      setTitle(generatedTitle)
      setProcessedText(preview.processed_text || '')
      setAudioUrl(resolvedAudioUrl)
      setPublicId(preview.public_id || '')
      setDescription(preview.generated_description || '')
      setDurationSeconds(resolvedDurationSeconds)

      if (resolvedDurationSeconds > 0) {
        setResultDur(`${formatDurationVi(resolvedDurationSeconds)} • ${format}`)
      } else {
        setResultDur('')
      }

      if (Array.isArray(preview.suggested_topics)) {
        setAiSuggestedTopics(preview.suggested_topics)
      }

      setProgress(100)
      setProcStep(t('createAudio.hook.completed'))
      setGenState(resolvedAudioUrl ? 'done' : 'idle')

      toast.success(t('createAudio.hook.generateSuccess'))
    } catch (error) {
      if (error?.name === 'AbortError') return

      console.error('Preview audio error:', error)
      setGenState('idle')
      setProgress(0)
      setProcStep('')
      toast.error(error?.message || t('createAudio.hook.generateFailed'))
    } finally {
      if (previewAbortRef.current === controller) {
        previewAbortRef.current = null
      }
    }
  }, [
    aiMode,
    fileReady,
    format,
    selectedVoiceName,
    sourceTab,
    t,
    text,
    uploadedExtractedText,
  ])

  const saveCurrentDraft = useCallback(async () => {
    if (!audioUrl) {
      toast.info(t('createAudio.hook.createAudioBeforeSave'))
      return
    }

    const baseText =
      sourceTab === 'upload'
        ? (uploadedExtractedText || '').trim()
        : (text || '').trim()

    const titleFromFile = file?.name?.replace(/\.[^/.]+$/, '') || ''
    const titleFromText = baseText.slice(0, 60) || t('createAudio.hook.draftTitleFallback')

    try {
      const payload = {
        title:
          title.trim() ||
          (sourceTab === 'upload' ? titleFromFile || titleFromText : titleFromText),
        description: description.trim(),
        original_text: baseText,
        source_type: sourceTab === 'upload' ? 'uploaded_document' : 'manual',
        mode: aiMode,
        processed_text: processedText,
        audio_url: audioUrl,
        public_id: publicId,
        voice_name: selectedVoiceName,
        format: format.toLowerCase(),
        document_url: uploadedDocUrl,
        document_public_id: uploadedDocPublicId,
        file_name: file?.name || '',
        file_type: file?.type || '',
        file_size: file?.size || null,
      }

      const res = await saveDraftWithAudio(payload)

      toast.success(res?.message || t('createAudio.hook.saveDraftSuccess'))
      setActiveDraftId(res?.data?.id || '')
      setActiveDraftStatus(res?.data?.status || 'draft')
      await loadRecentDrafts()
    } catch (error) {
      console.error('Save draft error:', error)
      toast.error(error?.message || t('createAudio.hook.saveDraftFailed'))
    }

  }, [
    aiMode,
    audioUrl,
    description,
    file,
    format,
    loadRecentDrafts,
    processedText,
    publicId,
    selectedVoiceName,
    sourceTab,
    t,
    text,
    title,
    uploadedExtractedText,
    uploadedDocUrl,
    uploadedDocPublicId,
  ])

  return {
    step,
    sourceTab,
    setSourceTab,
    aiMode,
    setAiMode,
    text,
    setText,
    file,
    fileReady,
    isUploadingFile,
    uploadedDocUrl,
    uploadedDocPublicId,
    uploadedExtractedText,
    voice,
    setVoice,
    format,
    setFormat,
    topics,
    setTopics,
    topicOptions,
    setTopicOptions,
    aiSuggestedTopics,
    setAiSuggestedTopics,
    genState,
    progress,
    procStep,
    resultDur,
    durationSeconds,
    audioUrl,
    textError,
    words,
    clearText,
    fillDemoText,
    handleFile,
    removeFile,
    setRecentDrafts,
    loadRecentDrafts,
    estLabel,
    startGenerate,
    cancelGenerate,
    saveCurrentDraft,
    voices,
    formats,
    aiModes,
    sourceTabs,
    recentDrafts,
    title,
    setTitle,
    description,
    setDescription,
    activeDraftId,
    activeDraftStatus,
    isLoadingDraft,
    loadDraftToForm,
    setDurationSeconds,
    setResultDur,
    selectedVoiceName,
    t,
  }
}