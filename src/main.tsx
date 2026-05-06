import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSupabaseSync } from './supabaseSync'
import { startDebugLog } from './debugLog'

// Start Supabase sync (pulls players + game history from cloud, merges with localStorage)
initSupabaseSync();

// Start the in-memory debug logger (always on; UI is opt-in via ?debug=1)
startDebugLog();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
