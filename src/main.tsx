import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSupabaseSync } from './supabaseSync'

// Start Supabase sync (pulls players + game history from cloud, merges with localStorage)
initSupabaseSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
