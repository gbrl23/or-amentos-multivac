import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Lock, Save, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function UpdatePasswordModal({ isOpen, onClose, isRecovery = false }) {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState({ type: null, text: '' })
    const [showPassword, setShowPassword] = useState(false)

    if (!isOpen) return null

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage({ type: null, text: '' })

        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'As senhas não coincidem.' })
            setLoading(false)
            return
        }

        if (password.length < 6) {
            setMessage({ type: 'error', text: 'A senha deve ter no mínimo 6 caracteres.' })
            setLoading(false)
            return
        }

        try {
            // 1. Atualiza a senha
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error

            // 2. Se for "primeiro acesso" (metadata), remove a flag
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.user_metadata?.force_password_change) {
                await supabase.auth.updateUser({
                    data: { force_password_change: null }
                })
            }

            setMessage({ type: 'success', text: 'Senha atualizada com sucesso!' })

            setTimeout(() => {
                onClose()
            }, 2000)

        } catch (error) {
            console.error(error)
            setMessage({ type: 'error', text: error.message || 'Erro ao atualizar senha.' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-blue-600 p-6 text-white text-center">
                    <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                        <Lock size={32} />
                    </div>
                    <h2 className="text-xl font-bold">
                        {isRecovery ? 'Redefinir Senha' : 'Defina sua Senha'}
                    </h2>
                    <p className="text-blue-100 text-sm mt-1">
                        {isRecovery
                            ? 'Digite sua nova senha para recuperar o acesso.'
                            : 'Para sua segurança, defina uma senha para este primeiro acesso.'}
                    </p>
                </div>

                <div className="p-8">
                    {message.type && (
                        <div className={`p-4 rounded-lg mb-6 flex items-start gap-3 text-sm ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                            }`}>
                            {message.type === 'error' ? <AlertCircle size={16} className="mt-0.5" /> : <CheckCircle size={16} className="mt-0.5" />}
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-600 outline-none pr-12"
                                    placeholder="Mínimo 6 caracteres"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-600 outline-none"
                                placeholder="Repita a senha"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || (message.type === 'success')}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                            {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
