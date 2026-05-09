import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import {
  getMyDrafts,
  previewAudio,
  saveDraftWithAudio,
  uploadDocument,
  getDraftDetail,
} from '../utils/contentApi'
import { formatDurationVi } from '../utils/formatDuration'

const VOICE_NAME_MAP = {
  'minh-tuan': 'Minh Tuấn',
  'lan-anh': 'Lan Anh',
  hung: 'Hùng',
  'thu-ha': 'Thu Hà',
}

const VOICE_ID_BY_NAME = {
  'Minh Tuấn': 'minh-tuan',
  'Lan Anh': 'lan-anh',
  'Hùng': 'hung',
  'Thu Hà': 'thu-ha',
}

const DEFAULT_TOPICS = [
  'Lập trình',
  'AI',
  'Tâm lý học',
  'Kinh doanh',
  'Tiếng Anh',
  'Khoa học',
]

export function useCreateAudio() {
  const demoText = `Kỹ năng mềm là tập hợp những khả năng giúp con người tương tác, làm việc và thích nghi hiệu quả trong môi trường sống và làm việc. Một trong những kỹ năng quan trọng nhất là kỹ năng giao tiếp, bởi nó giúp bạn truyền đạt ý tưởng rõ ràng, lắng nghe người khác và xây dựng mối quan hệ tích cực. Bên cạnh đó, kỹ năng quản lý thời gian giúp bạn sắp xếp công việc hợp lý, tránh căng thẳng và nâng cao hiệu suất. Ngoài ra, kỹ năng làm việc nhóm cũng rất cần thiết, vì trong hầu hết các môi trường, thành công thường đến từ sự hợp tác. Việc rèn luyện kỹ năng mềm không chỉ giúp bạn phát triển bản thân mà còn mở ra nhiều cơ hội trong học tập và sự nghiệp.`

  const voices = [
    { id: 'minh-tuan', name: 'Minh Tuấn', tag: 'Nam · Ấm · Miền Nam' },
    { id: 'lan-anh', name: 'Lan Anh', tag: 'Nữ · Sáng · Miền Bắc' },
    { id: 'hung', name: 'Hùng', tag: 'Nam · Trầm · Miền Bắc' },
    { id: 'thu-ha', name: 'Thu Hà', tag: 'Nữ · Dịu · Miền Trung' },
  ]

  const formats = ['MP3', 'WAV', 'OGG', 'AAC']

  const aiModes = [
    { value: 'summary', label: 'Tóm tắt AI' },
    { value: 'dialogue', label: 'Đổi sang hội thoại' },
    { value: 'original', label: 'Giữ nguyên văn' },
    { value: 'translate', label: 'Dịch sang Anh' },
  ]

  const sourceTabs = [
    { key: 'text', label: 'Nhập văn bản' },
    { key: 'upload', label: 'Tải tài liệu' },
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

  const [voice, setVoice] = useState('minh-tuan')
  const [format, setFormat] = useState('MP3')
  const [topics, setTopics] = useState(['Lập trình', 'AI'])

  const [topicOptions, setTopicOptions] = useState(DEFAULT_TOPICS)
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

  // Refs to manage preview audio request
  const previewAbortRef = useRef(null)
  const isCancelledRef = useRef(false)

  // Auto-increment progress when generating
  useEffect(() => {
    if (genState !== 'processing') return

    let intervalId = null

    const incrementProgress = () => {
      setProgress((prevProgress) => {
        if (prevProgress >= 90) return prevProgress

        // Random increment between 2-6%
        const increment = Math.floor(Math.random() * 5) + 2
        const newProgress = Math.min(prevProgress + increment, 90)
        return newProgress
      })
    }

    // Start incrementing after 500ms, then every 800-1200ms
    intervalId = window.setInterval(incrementProgress, 800 + Math.random() * 400)

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [genState])

  const selectedVoiceName = useMemo(() => {
    return VOICE_NAME_MAP[voice] || 'Minh Tuấn'
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

    toast.info('Đã dừng quá trình tạo audio')
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

  const clearText = useCallback(() => {
    setText('')
    setActiveDraftId('')
    setActiveDraftStatus('')
    setDurationSeconds(0)
    resetGenerateState()
  }, [resetGenerateState])

  const fillDemoText = useCallback(() => {
    setSourceTab('text')
    setActiveDraftId('')
    setActiveDraftStatus('')
    setText(demoText)
    setDurationSeconds(0)
    resetGenerateState()
    toast.success('Đã chèn văn bản mẫu')
  }, [demoText, resetGenerateState])

  const removeFile = useCallback(() => {
    setFile(null)
    setFileReady(false)
    setIsUploadingFile(false)
    setUploadedDocUrl('')
    setUploadedDocPublicId('')
    setUploadedExtractedText('')
    setActiveDraftId('')
    setActiveDraftStatus('')
    setDurationSeconds(0)
    resetGenerateState()
  }, [resetGenerateState])

  const handleFile = useCallback(
    async (selectedFile) => {
      if (!selectedFile) return

      try {
        setActiveDraftId('')
        setActiveDraftStatus('')
        setFile(selectedFile)
        setFileReady(false)
        setIsUploadingFile(true)
        setUploadedDocUrl('')
        setUploadedDocPublicId('')
        setUploadedExtractedText('')
        resetGenerateState()

        const formData = new FormData()
        formData.append('file', selectedFile)

        const res = await uploadDocument(formData)
        const payload = res?.data || {}
        const extractedText = (payload.extracted_text || '').trim()

        if (!extractedText) {
          throw new Error('Không thể trích xuất nội dung từ file')
        }

        setUploadedDocUrl(payload.document_url || '')
        setUploadedDocPublicId(payload.public_id || '')
        setUploadedExtractedText(extractedText)
        setFileReady(true)

        toast.success(`Đã tải và phân tích file: ${selectedFile.name}`)
      } catch (error) {
        console.error('Upload document error:', error)
        setFile(null)
        setFileReady(false)
        setUploadedDocUrl('')
        setUploadedDocPublicId('')
        setUploadedExtractedText('')
        toast.error(error?.message || 'Upload file thất bại')
      } finally {
        setIsUploadingFile(false)
      }
    },
    [resetGenerateState]
  )

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
      setPublicId('')
      setActiveDraftStatus(draft.status || '')
      setFileReady(hasDocument)
      setDurationSeconds(resolvedDurationSeconds)

      setUploadedDocUrl(documents[0]?.document_url || '')
      setUploadedDocPublicId(documents[0]?.storage_path || '')

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
            : 'original'

      setAiMode(detectedMode)

      const processed =
        draft.summary_text ||
        draft.dialogue_script ||
        draft.transcript_text ||
        ''

      setProcessedText(processed)

      if (resolvedDurationSeconds > 0) {
        setResultDur(`${formatDurationVi(resolvedDurationSeconds)} • ${resolvedFormat}`)
      } else {
        setResultDur('')
      }

      setFormat(resolvedFormat)
      setVoice(VOICE_ID_BY_NAME[defaultAudio?.voice_name] || 'minh-tuan')

      setGenState(resolvedAudioUrl ? 'done' : 'idle')
      setProgress(0)
      setProcStep('')
      setStep(resolvedAudioUrl ? 3 : 2)

      // Show different message based on whether audio is available
      if (resolvedAudioUrl) {
        toast.success('Đã tải draft + audio có sẵn')
      } else {
        toast.info('Đã tải draft (chưa có audio)')
      }
    } catch (error) {
      console.error('Load draft detail error:', error)
      toast.error(error?.message || 'Không thể tải lại bản nháp')
    } finally {
      setIsLoadingDraft(false)
    }
  }, [])

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
          ? 'Vui lòng tải file hợp lệ và đợi phân tích xong'
          : 'Vui lòng nhập đủ nội dung đầu vào'
      )
      return
    }

    // Abort any existing request
    if (previewAbortRef.current) {
      previewAbortRef.current.abort()
      previewAbortRef.current = null
    }

    const controller = new AbortController()
    previewAbortRef.current = controller
    isCancelledRef.current = false

    try {
      setGenState('processing')
      setStep(3)
      setProgress(0)
      setProcStep(
        sourceTab === 'upload'
          ? 'Đang xử lý nội dung từ tài liệu...'
          : 'Đang gửi yêu cầu tạo audio...'
      )

      setProcessedText('')
      setAudioUrl('')
      setPublicId('')
      setResultDur('')
      setAiSuggestedTopics([])
      setDescription('')
      setDurationSeconds(0)

      const res = await previewAudio(
        {
          original_text: inputText,
          mode: aiMode,
          voice_name: voice,
        },
        controller.signal
      )

      // Ignore response if request was cancelled
      if (isCancelledRef.current) return

      const preview = res?.data || {}
      const resolvedAudioUrl = preview.audio_url || ''
      const resolvedDurationSeconds = Number(preview.duration_seconds || 0)
      const generatedTitle =
        (preview.title || '').trim() ||
        inputText.slice(0, 80).trim() ||
        'Bài audio'

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
      setProcStep('Hoàn tất')
      setGenState(resolvedAudioUrl ? 'done' : 'idle')

      toast.success('Tạo podcast thành công')
    } catch (error) {
      if (error?.name === 'AbortError') {
        return
      }

      console.error('Preview audio error:', error)
      setGenState('idle')
      setProgress(0)
      setProcStep('')
      toast.error(error?.message || 'Tạo podcast thất bại')
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
    text,
    uploadedExtractedText,
  ])

  const saveCurrentDraft = useCallback(async () => {
    if (!audioUrl) {
      toast.info('Hãy tạo audio trước khi lưu nháp')
      return
    }

    const baseText =
      sourceTab === 'upload'
        ? (uploadedExtractedText || '').trim()
        : (text || '').trim()

    const titleFromFile = file?.name?.replace(/\.[^/.]+$/, '') || ''
    const titleFromText = baseText.slice(0, 60) || 'Bản nháp audio'

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
        voice_name: voice,
        format: format.toLowerCase(),
        document_url: uploadedDocUrl,
        document_public_id: uploadedDocPublicId,
        file_name: file?.name || '',
        file_type: file?.type || '',
        file_size: file?.size || null,
      }

      const res = await saveDraftWithAudio(payload)

      toast.success(res?.message || 'Lưu nháp thành công')
      setActiveDraftId(res?.data?.id || '')
      setActiveDraftStatus(res?.data?.status || 'draft')
      await loadRecentDrafts()
    } catch (error) {
      console.error('Save draft error:', error)
      toast.error(error?.message || 'Lưu nháp thất bại')
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
    estLabel,
    clearText,
    fillDemoText,
    handleFile,
    removeFile,
    startGenerate,
    cancelGenerate,
    saveCurrentDraft,
    voices,
    topicsMaster: DEFAULT_TOPICS,
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
    loadRecentDrafts,
    setDurationSeconds,
    setResultDur, 
  }
}