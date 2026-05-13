import { ToastContainer } from 'react-toastify'
import 'antd/dist/reset.css'
import 'react-toastify/dist/ReactToastify.css'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'

import MainLayout from '../../components/layout/MainLayout/MainLayout'

import CreateAudioHeader from '../../components/create-audio/CreateAudioHeader'
import SourceCard from '../../components/create-audio/SourceCard'
import VoiceConfigCard from '../../components/create-audio/VoiceConfigCard'
import AllDraftsPanel from '../../components/create-audio/AllDraftsPanel'
import SessionSummaryCard from '../../components/create-audio/SessionSummaryCard'
import GenerateSection from '../../components/create-audio/GenerateSection'
import RecentHistoryCard from '../../components/create-audio/RecentHistoryCard'

import { useCreateAudio } from '../../hooks/useCreateAudio'
import { useBlockNavigation } from '../../hooks/useBlockNavigation'
import styles from '../../style/pages/CreateAudioPage/CreateAudioPage.module.css'

export default function CreateAudioPage() {
  const { t } = useTranslation()
  const baseVm = useCreateAudio()
  const navigate = useNavigate()
  const allDraftsPanelRef = useRef(null)

  useBlockNavigation(baseVm.genState === 'processing', () => {
    baseVm.cancelGenerate?.()
  })

  const handleViewAllDrafts = () => {
    if (allDraftsPanelRef.current) {
      allDraftsPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const goToPublish = () => {
    if (baseVm.genState === 'processing') {
      toast.info(t('createAudio.page.waitGenerating'))
      return
    }

    if (baseVm.activeDraftStatus === 'published') {
      toast.info(t('createAudio.page.alreadyPublishedCannotContinue'))
      return
    }

    if (!baseVm.audioUrl) {
      toast.info(t('createAudio.page.noAudioToPublish'))
      return
    }

    const baseText =
      baseVm.sourceTab === 'upload'
        ? (baseVm.uploadedExtractedText || '').trim()
        : (baseVm.text || '').trim()

    navigate('/publish-post', {
      state: {
        draftData: {
          id: baseVm.activeDraftId || null,

          title: (baseVm.title || '').trim() || baseText.slice(0, 80) || t('createAudio.page.defaultAudioTitle'),
          description: baseVm.description || '',
          script:
            baseVm.processedText ||
            baseVm.uploadedExtractedText ||
            baseVm.text ||
            '',
          audioUrl: baseVm.audioUrl,
          durationSeconds: baseVm.durationSeconds,
          voice: baseVm.voice,
          format: baseVm.format,
          topics: baseVm.topics || [],
        },
      },
    })
  }

  const vm = {
    ...baseVm,
    goToPublish,
    isPublishLocked: baseVm.activeDraftStatus === 'published',
  }

  return (
    <>
      <ToastContainer position="top-right" autoClose={2200} theme="dark" />
      <MainLayout rightPanel={null}>
        <div className={styles.container}>
          <div className={styles.contentWrapper}>
            <div className={styles.createAudioHeaderWrapper}>
              <CreateAudioHeader step={vm.step} />
            </div>

            <div className={styles.contentGrid}>
              <div className={styles.leftCol}>
                <SourceCard vm={vm} />
                <VoiceConfigCard vm={vm} />
                <div ref={allDraftsPanelRef}>
                  <AllDraftsPanel vm={vm} />
                </div>
              </div>

              <div className={styles.rightCol}>
                <SessionSummaryCard vm={vm} />
                <GenerateSection vm={vm} />
                <RecentHistoryCard vm={vm} onViewAll={handleViewAllDrafts} />
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    </>
  )
}