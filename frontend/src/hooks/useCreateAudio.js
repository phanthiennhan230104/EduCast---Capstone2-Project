import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import {
  getMyDrafts,
  previewAudio,
  saveDraftWithAudio,
  uploadDocument,
  getDraftDetail, 
} from '../utils/contentApi'

const VOICE_NAME_MAP = {
  'minh-tuan': 'Minh Tuấn',
  'lan-anh': 'Lan Anh',
  'hung': 'Hùng',
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
  const demoText = `Backpropagation là thuật toán cốt lõi để huấn luyện mạng nơ-ron...`

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
  const [description, setDescription] = useState('')

  // THÊM
  const [activeDraftId, setActiveDraftId] = useState('')
  const [isLoadingDraft, setIsLoadingDraft] = useState(false)

  const selectedVoiceName = useMemo(() => {
    return VOICE_NAME_MAP[voice] || 'Minh Tuấn'
  }, [voice])

  const currentSourceText = useMemo(() => {
    if (sourceTab === 'upload') {
      return uploadedExtractedText || ''
    }
    return text || ''
  }, [sourceTab, text, uploadedExtractedText])

  const words = useMemo(() => {
    const baseText = processedText || currentSourceText || ''
    const normalized = baseText.trim()
    if (!normalized) return 0
    return normalized.split(/\s+/).length
  }, [processedText, currentSourceText])

  const estLabel = useMemo(() => {
    if (!words) return '— phút'
    const mins = words / 130
    if (mins < 1) return '< 1 phút'
    return `${mins.toFixed(1)} phút`
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
    setDescription('')
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
    resetGenerateState()
  }, [resetGenerateState])

  const fillDemoText = useCallback(() => {
    setSourceTab('text')
    setActiveDraftId('')
    setText(demoText)
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
    resetGenerateState()
  }, [resetGenerateState])

  const handleFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return

    try {
      setActiveDraftId('')
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
  }, [resetGenerateState])

  const loadDraftToForm = useCallback(async (draftId) => {
    if (!draftId) return

    try {
      setIsLoadingDraft(true)

      const res = await getDraftDetail(draftId)
      const draft = res?.data || {}

      const documents = Array.isArray(draft.documents) ? draft.documents : []
      const defaultAudio = Array.isArray(draft.audio_versions)
        ? draft.audio_versions.find((item) => item.is_default) || draft.audio_versions[0]
        : null

      const hasDocument = draft.source_type === 'uploaded_document'

      setActiveDraftId(draft.id || draftId)
      setSourceTab(hasDocument ? 'upload' : 'text')

      const originalText = draft.original_text || ''
      setText(hasDocument ? '' : originalText)
      setUploadedExtractedText(hasDocument ? originalText : '')

      setDescription(draft.description || '')
      setAudioUrl(draft.audio_url || defaultAudio?.audio_url || '')
      setPublicId('')
      setFileReady(hasDocument)

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

      const durationSeconds = Number(
        draft.duration_seconds || defaultAudio?.duration_seconds || 0
      )

      if (durationSeconds > 0) {
        const mins = Math.floor(durationSeconds / 60)
        const secs = String(durationSeconds % 60).padStart(2, '0')
        setResultDur(`${mins}:${secs} phút • ${String(
          defaultAudio?.format || 'mp3'
        ).toUpperCase()}`)
      } else {
        setResultDur('')
      }

      setFormat(String(defaultAudio?.format || 'mp3').toUpperCase())
      setVoice(VOICE_ID_BY_NAME[defaultAudio?.voice_name] || 'minh-tuan')

      setGenState(draft.audio_url ? 'done' : 'idle')
      setProgress(0)
      setProcStep('')
      setStep(draft.audio_url ? 3 : 2)

      toast.success('Đã tải lại bản nháp lên giao diện')
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

    try {
      setGenState('processing')
      setStep(3)
      setProgress(20)
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

      const res = await previewAudio({
        original_text: inputText,
        mode: aiMode,
        voice_name: selectedVoiceName,
      })

      const preview = res?.data || {}

      setProcessedText(preview.processed_text || '')
      setAudioUrl(preview.audio_url || '')
      setPublicId(preview.public_id || '')
      setDescription(preview.generated_description || '')

      const durationSeconds = Number(preview.duration_seconds || 0)
      const mins = Math.floor(durationSeconds / 60)
      const secs = String(durationSeconds % 60).padStart(2, '0')
      setResultDur(`${mins}:${secs} phút • ${format}`)

      if (Array.isArray(preview.suggested_topics)) {
        setAiSuggestedTopics(preview.suggested_topics)
      }

      setProgress(100)
      setProcStep('Hoàn tất')
      setGenState('done')

      toast.success('Tạo podcast thành công')
    } catch (error) {
      console.error('Preview audio error:', error)
      setGenState('idle')
      setProgress(0)
      setProcStep('')
      toast.error(error?.message || 'Tạo podcast thất bại')
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
        title: sourceTab === 'upload' ? titleFromFile || titleFromText : titleFromText,
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

      toast.success(res?.message || 'Lưu nháp thành công')
      setActiveDraftId(res?.data?.id || '')
      loadRecentDrafts()
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
    audioUrl,
    textError,
    words,
    estLabel,
    clearText,
    fillDemoText,
    handleFile,
    removeFile,
    startGenerate,
    saveCurrentDraft,
    voices,
    topicsMaster: DEFAULT_TOPICS,
    formats,
    aiModes,
    sourceTabs,
    recentDrafts,
    description,
    setDescription,
    activeDraftId,
    isLoadingDraft,
    loadDraftToForm,
  }
}