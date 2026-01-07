// src/App.jsx
import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import AuthMultivac from './Auth.jsx'
import Orcamento from './pages/Orcamento.jsx'
import Profile from './pages/Profile.jsx'
import ManageUsers from './pages/ManageUsers.jsx'
import UpdatePasswordModal from './components/UpdatePasswordModal.jsx' // [NEW]

// Rota protegida + controle de sessão + timeout de inatividade
function ProtectedRoute({ children, setPasswordModal }) {
  const [status, setStatus] = useState('checking') // 'checking' | 'in' | 'out'
  const location = useLocation()
  const navigate = useNavigate()

  // 1. Checa sessão atual e escuta mudanças do Supabase
  useEffect(() => {
    let mounted = true

    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setStatus(data?.session ? 'in' : 'out')

      // Check for forced password change on initial load
      if (data?.session?.user?.user_metadata?.force_password_change) {
        setPasswordModal({ open: true, isRecovery: false })
      }
    }
    check()

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      setStatus(session ? 'in' : 'out')

      // [NEW] Handle Password Recovery Event
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordModal({ open: true, isRecovery: true })
      }

      // [NEW] Handle First Login (Force Password Change)
      if (event === 'SIGNED_IN' && session?.user?.user_metadata?.force_password_change) {
        setPasswordModal({ open: true, isRecovery: false })
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [setPasswordModal])

  // 2. Timeout de inatividade (só se o usuário NÃO marcou "Manter conectado")
  useEffect(() => {
    // Só configura o timeout se o usuário estiver logado
    if (status !== 'in') return

    // Verifica se o usuário escolheu manter conectado
    const stored = localStorage.getItem('multivac_keep_logged_in')
    // Se não tiver nada salvo (null), assume TRUE (padrão do Auth.jsx).
    // Se tiver salvo, respeita o valor ('true' ou 'false').
    const keepLogged = stored === null ? true : stored === 'true'

    if (keepLogged) {
      // Se marcou "Manter conectado neste dispositivo", não desloga por inatividade
      return
    }

    // Se NÃO marcou, a gente vai deslogar após 30 minutos sem atividade
    const MAX_IDLE_MINUTES = 30
    const MAX_IDLE_MS = MAX_IDLE_MINUTES * 60 * 1000

    let logoutTimer = null

    const resetTimer = () => {
      if (logoutTimer) clearTimeout(logoutTimer)
      logoutTimer = setTimeout(async () => {
        // Auto-logout
        await supabase.auth.signOut()
        localStorage.removeItem('multivac_keep_logged_in')
        navigate('/', { replace: true })
        alert('Sua sessão foi encerrada por inatividade.')
      }, MAX_IDLE_MS)
    }

    // Eventos que contam como "atividade do usuário"
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

    activityEvents.forEach((ev) => {
      window.addEventListener(ev, resetTimer)
    })

    // Começa o timer agora
    resetTimer()

    // Limpa tudo quando o componente desmontar ou quando status mudar
    return () => {
      if (logoutTimer) clearTimeout(logoutTimer)
      activityEvents.forEach((ev) => {
        window.removeEventListener(ev, resetTimer)
      })
    }
  }, [status, navigate])

  // Enquanto está checando sessão: tela cinza
  if (status === 'checking') {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', color: '#6b7280' }}>
        Verificando sessão…
      </div>
    )
  }

  // Se não está autenticado → manda de volta pro login
  if (status === 'out') {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  // Se está autenticado → renderiza a rota protegida normalmente
  return children
}

// Rotas principais
export default function App() {
  const [passwordModal, setPasswordModal] = useState({ open: false, isRecovery: false })

  return (
    <>
      <Routes>
        {/* Tela de login/cadastro/recuperação */}
        <Route path="/" element={<AuthMultivac />} />

        {/* Tela de orçamento protegida */}
        <Route
          path="/orcamentos"
          element={
            <ProtectedRoute setPasswordModal={setPasswordModal}>
              <Orcamento />
            </ProtectedRoute>
          }
        />

        {/* Tela de perfil protegida */}
        <Route
          path="/perfil"
          element={
            <ProtectedRoute setPasswordModal={setPasswordModal}>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Tela de gestão de usuários (Acesso interno verifica Admin) */}
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute setPasswordModal={setPasswordModal}>
              <ManageUsers />
            </ProtectedRoute>
          }
        />

        {/* fallback: qualquer rota desconhecida volta pro login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <UpdatePasswordModal
        isOpen={passwordModal.open}
        onClose={() => setPasswordModal({ ...passwordModal, open: false })}
        isRecovery={passwordModal.isRecovery}
      />
    </>
  )
}