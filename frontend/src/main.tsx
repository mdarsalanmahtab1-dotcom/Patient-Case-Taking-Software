import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ToastContainer } from './components/Toast'
import { MotionConfig } from 'framer-motion'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* reducedMotion="user": framer animations follow the OS "reduce motion" setting */}
      <MotionConfig reducedMotion="user">
        <App />
        <ToastContainer />
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
)
