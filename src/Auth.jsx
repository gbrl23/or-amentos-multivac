// src/Auth.jsx
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { Mail, Lock, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'

/**
 * =============== CONFIGS ===============
 * Timeout de inatividade (minutos)
 */
const IDLE_TIMEOUT_MIN = 30

// chave do "remember me"
const REMEMBER_KEY = 'multivac_keep_logged_in'

export default function AuthMultivac() {
  const navigate = useNavigate()

  const [tela, setTela] = useState('login') // 'login' | 'recovery'
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState({ tipo: null, texto: '' })

  const [loginData, setLoginData] = useState({ email: '', senha: '' })
  const [recoveryEmail, setRecoveryEmail] = useState('')

  // checkbox "permanecer conectado"
  const [remember, setRemember] = useState(() => {
    const stored = localStorage.getItem(REMEMBER_KEY)
    return stored === null ? true : stored === 'true'
  })

  // sessão + navegação
  useEffect(() => {
    const boot = async () => {
      const { data } = await supabase.auth.getSession()
      if (data?.session) {
        navigate('/orcamentos', { replace: true })
      }
    }
    boot()

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        navigate('/orcamentos', { replace: true })
      }
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [navigate])

  const mostrarMensagem = (tipo, texto) => {
    setMensagem({ tipo, texto })
    setTimeout(() => setMensagem({ tipo: null, texto: '' }), 5000)
  }

  // LOGIN
  const handleLogin = async (e) => {
    if (e) e.preventDefault()

    setLoading(true)
    setMensagem({ tipo: null, texto: '' })

    if (!loginData.email || !loginData.senha) {
      mostrarMensagem('erro', 'Preencha todos os campos')
      setLoading(false)
      return
    }

    try {
      // salva preferência (por enquanto só visual/para futuro)
      localStorage.setItem(REMEMBER_KEY, String(remember))

      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email.trim(),
        password: loginData.senha,
      })
      if (error) throw error

      if (error) throw error
      mostrarMensagem('sucesso', 'Login realizado com sucesso!')
      navigate('/orcamentos', { replace: true })
    } catch (err) {
      console.error('[login]', err)
      mostrarMensagem('erro', err.message || 'Falha ao entrar')
    } finally {
      setLoading(false)
    }
  }

  // RECUPERAÇÃO
  const handleRecovery = async () => {
    if (!recoveryEmail) {
      mostrarMensagem('erro', 'Digite seu email')
      return
    }

    setLoading(true)
    setMensagem({ tipo: null, texto: '' })
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      mostrarMensagem('sucesso', 'Email de recuperação enviado!')
      setTimeout(() => setTela('login'), 2000)
    } catch (err) {
      console.error('[recovery]', err)
      mostrarMensagem('erro', err.message || 'Falha ao enviar recuperação')
    } finally {
      setLoading(false)
    }
  }


  const Mensagem = () => {
    if (!mensagem.tipo) return null
    const isErro = mensagem.tipo === 'erro'
    return (
      <div
        className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${isErro ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
          }`}
      >
        {isErro ? <AlertCircle className="text-red-500" size={20} /> : <CheckCircle className="text-green-500" size={20} />}
        <p className={isErro ? 'text-red-700' : 'text-green-700'}>{mensagem.texto}</p>
      </div>
    )
  }

  // === TELAS ===
  if (tela === 'login') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(to bottom right, #29a3da, #0071b4)' }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <img
              src="https://i.imgur.com/8AtT4EC.png"
              alt="Logo-Multivac"
              className="h-20 mx-auto mb-4 object-contain"
            />
            <p className="text-gray-600 mt-2">Sistema de Orçamentos</p>
          </div>

          <Mensagem />

          {/* FORM DE LOGIN */}
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071b4]"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginData.senha}
                  onChange={(e) => setLoginData({ ...loginData, senha: e.target.value })}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071b4]"
                />
              </div>
            </div>

            {/* === PERMANECER CONECTADO === */}
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#0071b4] focus:ring-[#0071b4]"
                />
                <span className="text-sm text-gray-700">Permanecer conectado</span>
              </label>

              <button
                onClick={() => setTela('recovery')}
                className="hover:underline text-sm"
                style={{ color: '#0071b4' }}
                type="button"
              >
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
              style={{ backgroundColor: '#0071b4' }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (tela === 'recovery') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'linear-gradient(to bottom right, #29a3da, #0071b4)' }}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <button
            onClick={() => setTela('login')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6"
          >
            <ArrowLeft size={20} />
            Voltar
          </button>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Recuperar Senha</h1>
            <p className="text-gray-600 mt-2">Digite seu email para receber as instruções</p>
          </div>

          <Mensagem />

          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0071b4]"
                />
              </div>
            </div>

            <button
              onClick={handleRecovery}
              disabled={loading}
              className="w-full text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
              style={{ backgroundColor: '#0071b4' }}
            >
              {loading ? 'Enviando...' : 'Enviar Email de Recuperação'}
            </button>
          </div>

          <div className="text-center mt-6">
            <p className="text-gray-600 text-sm">
              Lembrou a senha?{' '}
              <button
                onClick={() => setTela('login')}
                className="font-semibold hover:underline"
                style={{ color: '#0071b4' }}
              >
                Fazer login
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}