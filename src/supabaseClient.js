// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// Lê as variáveis de ambiente do Vite (.env.local)
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

// Logs de debug — aparecem só no modo de desenvolvimento
if (import.meta.env.DEV) {
  console.log('🔗 SUPABASE_URL:', JSON.stringify(url))
  console.log('🔑 SUPABASE_KEY:', key ? '✅ chave encontrada' : '⚠️ sem chave')
}

// Cria o cliente Supabase
export const supabase = createClient(url, key)