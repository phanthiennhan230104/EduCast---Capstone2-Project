import MainLayout from '../../components/layout/MainLayout/MainLayout'
import FavoritesContent from '../../components/library/FavoritesContent'
import LibraryRightPanel from '../../components/library/FavoritesRightPanel'

export default function FavoritesPage() {
  return (
    <MainLayout rightPanel={<LibraryRightPanel />}>
      <FavoritesContent />
    </MainLayout>
  )
}