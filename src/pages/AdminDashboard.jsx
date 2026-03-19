import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import {
    Users,
    FileText,
    FilePen,
    UserPlus,
    ArrowRight,
    TrendingUp,
    Activity,
    Loader2,
    CheckCircle,
    AlertCircle,
    Mail,
    Shield,
    LogOut,
    ChevronDown,
    User,
    LifeBuoy,
    Upload,
    Database,
    PackageSearch
} from 'lucide-react'

export default function AdminDashboard() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        createdThisMonth: 0,
        alteredThisMonth: 0
    })

    // Invite Form State
    const [inviteName, setInviteName] = useState('')
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('representative')
    const [inviting, setInviting] = useState(false)
    const [inviteMessage, setInviteMessage] = useState({ type: null, text: '' })
    const [userName, setUserName] = useState('')
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => {
        checkAdminAndFetchStats()
    }, [])

    const checkAdminAndFetchStats = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return navigate('/')

        // Check admin role
        if (user.user_metadata?.role !== 'admin') {
            return navigate('/orcamentos')
        }

        setUserName(user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || '')

        try {
            // Calculate first and last day of current month
            const date = new Date()
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString()

            // Fetch "Gerados" (Version 1)
            const { count: countCreated, error: errCreated } = await supabase
                .from('orcamentos')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', firstDay)
                .lte('created_at', lastDay)
                // We assume 'version' is in payload. reliably.
                // If we can't filter JSON in HEAD request easily without indexing, we might need to fetch data.
                // However, for optimization, let's try fetching just payload first if count doesn't support json filter well or just fetch all for this month.
                // Actually, fetching all metadata for the month is safer and likely not too heavy yet.
                .select('payload')

            // Let's actually fetch the data to filter in JS for accuracy regarding versioning
            const { data: monthData, error: errData } = await supabase
                .from('orcamentos')
                .select('payload')
                .gte('created_at', firstDay)
                .lte('created_at', lastDay)
                .neq('status', 'erro')

            if (errData) throw errData

            let created = 0
            let altered = 0

            monthData.forEach(row => {
                const ver = row.payload?.version || 1
                if (ver === 1) created++
                else altered++
            })

            setStats({
                createdThisMonth: created,
                alteredThisMonth: altered
            })

        } catch (error) {
            console.error('Error fetching stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        if (!inviteName || !inviteEmail) return

        setInviting(true)
        setInviteMessage({ type: null, text: '' })

        try {
            const { data, error } = await supabase.functions.invoke('invite-user', {
                body: { name: inviteName, email: inviteEmail, role: inviteRole }
            })

            if (data?.error) throw new Error(data.error)
            if (error) throw error

            setInviteMessage({ type: 'success', text: `Convite enviado para ${inviteEmail}` })
            setInviteName('')
            setInviteEmail('')
            setInviteRole('representative')

            // Auto clear success message after 5s
            setTimeout(() => setInviteMessage({ type: null, text: '' }), 5000)

        } catch (err) {
            console.error(err)
            setInviteMessage({ type: 'error', text: `Erro: ${err.message}` })
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
        <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">



                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            {/* Multivac Logo */}
                            <img src="/multivac-logo.png" alt="MULTIVAC" className="h-8 md:h-10 w-auto object-contain" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrativo</h1>
                        <p className="text-gray-500 mt-1">Visão geral e controle do sistema</p>
                        <p className="text-lg font-medium text-[#0071b4] mt-2">
                            {(() => {
                                const hour = new Date().getHours()
                                let greeting = 'Boa noite'
                                if (hour >= 5 && hour < 12) greeting = 'Bom dia'
                                else if (hour >= 12 && hour < 18) greeting = 'Boa tarde'
                                return `${greeting}, ${userName}`
                            })()}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/orcamentos')}
                            className="group flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-medium hover:border-[#0071b4] hover:text-[#0071b4] transition shadow-sm"
                        >
                            Ir para Orçamentos
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        {/* User Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:border-[#0071b4] hover:text-[#0071b4] transition shadow-sm"
                            >
                                <User size={20} />
                                <span className="max-w-[100px] truncate hidden sm:inline">{userName || 'Admin'}</span>
                                <ChevronDown size={16} className={`transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {menuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20 text-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <button
                                            onClick={() => navigate('/perfil')}
                                            className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 font-medium"
                                        >
                                            <User size={18} className="text-[#0071b4]" />
                                            Meu Perfil
                                        </button>
                                        <div className="h-px bg-gray-100 my-1" />
                                        <button
                                            onClick={async () => {
                                                await supabase.auth.signOut()
                                                navigate('/')
                                            }}
                                            className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 flex items-center gap-2 font-medium"
                                        >
                                            <LogOut size={18} />
                                            Sair
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card 1: Gerados */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition">
                        <div className="relative z-10">
                            <p className="text-sm font-medium text-gray-500 mb-1">Orçamentos Gerados (Mês)</p>
                            <h2 className="text-4xl font-bold text-gray-900">{stats.createdThisMonth}</h2>
                        </div>
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-[#0071b4] group-hover:scale-110 transition">
                            <FileText size={24} />
                        </div>
                        <div className="absolute right-0 bottom-0 opacity-5">
                            <FileText size={120} />
                        </div>
                    </div>

                    {/* Card 2: Alterados */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition">
                        <div className="relative z-10">
                            <p className="text-sm font-medium text-gray-500 mb-1">Orçamentos Alterados (Mês)</p>
                            <h2 className="text-4xl font-bold text-gray-900">{stats.alteredThisMonth}</h2>
                        </div>
                        <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-[#0071b4] group-hover:scale-110 transition">
                            <FilePen size={24} />
                        </div>
                        <div className="absolute right-0 bottom-0 opacity-5">
                            <FilePen size={120} />
                        </div>
                    </div>
                </div>

                {/* Main Content Area: Invite + Links? */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Invite Widget (Larger) */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-100 text-[#0071b4] rounded-lg">
                                <UserPlus size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Convidar Novo Usuário</h3>
                        </div>

                        {inviteMessage.text && (
                            <div className={`p-4 rounded-xl mb-6 flex items-start gap-3 ${inviteMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                {inviteMessage.type === 'error' ? <AlertCircle className="mt-0.5" size={20} /> : <CheckCircle className="mt-0.5" size={20} />}
                                <span className="font-medium">{inviteMessage.text}</span>
                            </div>
                        )}

                        <form onSubmit={handleInvite} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome Completo</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: João Silva"
                                        value={inviteName}
                                        onChange={e => setInviteName(e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0071b4] outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Corporativo</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                                        <input
                                            type="email"
                                            required
                                            placeholder="joao@multivac.com.br"
                                            value={inviteEmail}
                                            onChange={e => setInviteEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0071b4] outline-none transition"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Nível de Acesso</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 border rounded-xl p-3 cursor-pointer transition flex items-center gap-3 ${inviteRole === 'representative' ? 'border-[#0071b4] bg-blue-50/50 ring-1 ring-[#0071b4]' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <input type="radio" name="role" value="representative" checked={inviteRole === 'representative'} onChange={() => setInviteRole('representative')} className="w-4 h-4 text-[#0071b4]" />
                                        <span className="text-sm font-medium text-gray-700">Representante</span>
                                    </label>
                                    <label className={`flex-1 border rounded-xl p-3 cursor-pointer transition flex items-center gap-3 ${inviteRole === 'admin' ? 'border-[#0071b4] bg-blue-50/50 ring-1 ring-[#0071b4]' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <input type="radio" name="role" value="admin" checked={inviteRole === 'admin'} onChange={() => setInviteRole('admin')} className="w-4 h-4 text-[#0071b4]" />
                                        <span className="text-sm font-medium text-gray-700 flex items-center gap-1">Admin <Shield size={12} /></span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={inviting}
                                    className="bg-[#0071b4] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#005f9e] transition flex items-center gap-2 disabled:opacity-70 shadow-lg shadow-blue-900/10"
                                >
                                    {inviting ? <Loader2 className="animate-spin" /> : <UserPlus size={20} />}
                                    {inviting ? 'Enviando...' : 'Enviar Convite'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Right Column: Quick Links / Info */}
                    <div className="space-y-6">
                        {/* Shortcuts */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Acesso Rápido</h3>
                            <nav className="space-y-2">
                                <button onClick={() => navigate('/orcamentos')} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 text-gray-700 transition group text-left">
                                    <span className="font-medium">Novo Orçamento</span>
                                    <ArrowRight size={16} className="text-gray-400 group-hover:text-[#0071b4]" />
                                </button>
                                <button onClick={() => navigate('/perfil')} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 text-gray-700 transition group text-left">
                                    <span className="font-medium">Ver Histórico Completo</span>
                                    <ArrowRight size={16} className="text-gray-400 group-hover:text-[#0071b4]" />
                                </button>
                                <button onClick={() => navigate('/dashboard/catalogo/upload')} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 text-gray-700 transition group text-left">
                                    <span className="font-medium flex items-center gap-2">
                                        <Upload size={16} className="text-[#0071b4]" />
                                        Importar via CSV
                                    </span>
                                    <ArrowRight size={16} className="text-gray-400 group-hover:text-[#0071b4]" />
                                </button>
                                <button onClick={() => navigate('/dashboard/catalogo')} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 text-gray-700 transition group text-left">
                                    <span className="font-medium flex items-center gap-2">
                                        <PackageSearch size={16} className="text-[#0071b4]" />
                                        Gestão do Catálogo
                                    </span>
                                    <ArrowRight size={16} className="text-gray-400 group-hover:text-[#0071b4]" />
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>

            {/* Support Floating Button */}
            <div className="fixed bottom-6 right-6 z-50">
                <a
                    href="mailto:suporte@kakua.co?subject=Suporte Multivac Dashboard"
                    className="flex items-center justify-center w-14 h-14 bg-[#0071b4] text-white rounded-full shadow-lg hover:bg-[#005f9e] hover:scale-105 transition-all duration-300 group"
                    title="Contatar Suporte"
                >
                    <LifeBuoy size={28} className="group-hover:rotate-12 transition-transform" />
                </a>
            </div>
        </div>
    )
}
