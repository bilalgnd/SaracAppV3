import './assets/main.css'
import './assets/settings.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { webApi } from './webApi'

if (!(window as any).electron) {
  (window as any).api = webApi;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
