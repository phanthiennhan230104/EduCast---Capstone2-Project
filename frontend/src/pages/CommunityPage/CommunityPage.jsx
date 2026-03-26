import MainLayout from '../../components/layout/MainLayout/MainLayout'
import Community from '../../components/community/Community'
import CommunityRightPanel from '../../components/community/CommunityRightPanel'

export default function CommunityPage() {
  return (
    <MainLayout rightPanel={<CommunityRightPanel />}>
      <Community />
    </MainLayout>
  )
}