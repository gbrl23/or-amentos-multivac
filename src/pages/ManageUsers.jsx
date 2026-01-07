import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { ArrowLeft, UserPlus, Mail, Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export default function ManageUsers() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [inviting, setInviting] = useState(false)

    // Form data
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [role, setRole] = useState('representative') // 'representative' or 'admin'

    const [message, setMessage] = useState({ type: null, text: '' })

    const N8N_GATEWAY_URL = (import.meta.env.VITE_N8N_GATEWAY_URL || '').trim()

    useEffect(() => {
        checkAdmin()
    }, [])

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            navigate('/')
            return
        }

        // Check if role is admin in user_metadata
        const role = user.user_metadata?.role
        if (role !== 'admin') {
            navigate('/orcamentos') // Redirect non-admins
            return
        }

        setIsAdmin(true)
        setLoading(false)
    }

    const showMessage = (type, text) => {
        setMessage({ type, text })
        setTimeout(() => setMessage({ type: null, text: '' }), 5000)
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        if (!name || !email) {
            showMessage('error', 'Preencha nome e email.')
            return
        }

        setInviting(true)
        setMessage({ type: null, text: '' })

        try {
            const { data, error } = await supabase.functions.invoke('invite-user', {
                body: { name, email, role }
            })

            if (data?.error) throw new Error(data.error) // Handle custom error returns if any

            if (error) throw error

            showMessage('success', `Convite enviado com sucesso para ${email}!`)

            // Reset form
            setName('')
            setEmail('')
            setRole('representative')

        } catch (error) {
            console.error(error)
            showMessage('error', `Erro ao convidar: ${error.message}`)
        } finally {
            setInviting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="animate-spin text-[#0071b4]" size={40} />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => navigate('/orcamentos')}
                    className="flex items-center gap-2 text-gray-600 hover:text-[#0071b4] mb-6 transition"
                >
                    <ArrowLeft size={20} />
                    Voltar para Orçamentos
                </button>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-6">
                        <div className="bg-blue-100 p-3 rounded-full text-[#0071b4]">
                            <UserPlus size={32} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Convidar Usuário</h1>
                            <p className="text-gray-500">Envie um convite para criar um novo acesso ao sistema.</p>
                        </div>
                    </div>

                    {message.type && (
                        <div className={`p-4 rounded-lg mb-6 flex items-start gap-3 ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                            }`}>
                            {message.type === 'error' ? <AlertCircle className="mt-0.5" /> : <CheckCircle className="mt-0.5" />}
                            <div>{message.text}</div>
                        </div>
                    )}

                    <form onSubmit={handleInvite} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0071b4] outline-none"
                                    placeholder="Ex: João Silva"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0071b4] outline-none"
                                        placeholder="email@multivac.com.br"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Nível de Acesso</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className={`border rounded-lg p-4 cursor-pointer transition flex items-start gap-3 ${role === 'representative' ? 'border-[#0071b4] bg-blue-50 ring-1 ring-[#0071b4]' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <input
                                        type="radio"
                                        name="role"
                                        value="representative"
                                        checked={role === 'representative'}
                                        onChange={() => setRole('representative')}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="font-semibold text-gray-800">Representante</div>
                                        <div className="text-sm text-gray-500">Acesso padrão. Pode criar orçamentos e ver seu próprio histórico.</div>
                                    </div>
                                </label>

                                <label className={`border rounded-lg p-4 cursor-pointer transition flex items-start gap-3 ${role === 'admin' ? 'border-[#0071b4] bg-blue-50 ring-1 ring-[#0071b4]' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <input
                                        type="radio"
                                        name="role"
                                        value="admin"
                                        checked={role === 'admin'}
                                        onChange={() => setRole('admin')}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="font-semibold text-gray-800 flex items-center gap-2">
                                            Administrador
                                            <Shield size={14} className="text-[#0071b4]" />
                                        </div>
                                        <div className="text-sm text-gray-500">Acesso total. Pode ver todos os orçamentos e convidar usuários.</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex justify-end">
                            <button
                                type="submit"
                                disabled={inviting}
                                className="bg-[#0071b4] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#005f9e] transition flex items-center gap-2 disabled:opacity-70"
                            >
                                {inviting ? <Loader2 className="animate-spin" /> : <UserPlus size={20} />}
                                {inviting ? 'Enviando Convite...' : 'Enviar Convite'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
