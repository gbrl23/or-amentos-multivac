import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import {
    FileText,
    FilePen,
    Loader2
} from 'lucide-react'
import { StatusFunnel, RetrabalhoRanking, VolumeMetrics } from '../components/dashboard'

export default function AdminDashboard() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        createdThisMonth: 0,
        alteredThisMonth: 0
    })

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

        try {
            // Calculate first and last day of current month
            const date = new Date()
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59).toISOString()

            // Fetch "Gerados" and "Alterados" purely from payload metadata
            const { data: monthData, error: errData } = await supabase
                .from('orcamentos')
                .select('payload')
                .gte('created_at', firstDay)
                .lte('created_at', lastDay)
                .neq('status', 'rascunho')

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

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="animate-spin text-[#0071b4]" size={40} />
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: Gerados */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition">
                    <div className="relative z-10">
                        <p className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Orçamentos Gerados (Mês)</p>
                        <h2 className="text-5xl font-bold text-gray-900">{stats.createdThisMonth}</h2>
                    </div>
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0071b4] group-hover:scale-110 transition-transform duration-300">
                        <FileText size={32} strokeWidth={1.5} />
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-300 pointer-events-none">
                        <FileText size={180} />
                    </div>
                </div>

                {/* Card 2: Alterados */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition">
                    <div className="relative z-10">
                        <p className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-2">Orçamentos Alterados (Mês)</p>
                        <h2 className="text-5xl font-bold text-gray-900">{stats.alteredThisMonth}</h2>
                    </div>
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0071b4] group-hover:scale-110 transition-transform duration-300">
                        <FilePen size={32} strokeWidth={1.5} />
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-300 pointer-events-none">
                        <FilePen size={180} />
                    </div>
                </div>
            </div>

            {/* Bloco 1: Funil de Status */}
            <StatusFunnel />

            {/* Bloco 2 + 3: Retrabalho e Volume lado a lado em telas grandes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <RetrabalhoRanking />
                <VolumeMetrics />
            </div>
        </div>
    )
}
