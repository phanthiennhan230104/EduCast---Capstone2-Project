import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage/HomePage'
import FeedPage from './pages/FeedPage/FeedPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/feed" element={<FeedPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
