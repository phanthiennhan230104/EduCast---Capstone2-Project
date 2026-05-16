import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider, theme } from 'antd'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import 'antd/dist/reset.css'
import './style/index.css'
import App from './App.jsx'
import './style/theme.css'
import './utils/i18n'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#7f8cff',
          borderRadius: 14,
        },
      }}
    >
      <App />
      <ToastContainer position="top-right" autoClose={2200} />
    </ConfigProvider>
  </StrictMode>,
) 