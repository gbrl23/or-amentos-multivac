import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import {
  FileEdit,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  CalendarDays,
} from 'lucide-react'

const STATUS_CONFIG = [
  { key: 'rascunho', label: 'Rascunho', color: 'text-yellow-600', bg: 'bg-yellow-50', badgeBg: 'bg-yellow-100', badgeText: 'text-yellow-700', Icon: FileEdit },
  { key: 'enviado',  label: 'Enviado',  color: 'text-[#0071b4]', bg: 'bg-blue-50',   badgeBg: 'bg-blue-100',   badgeText: 'text-blue-700',   Icon: Send },
  { key: 'aprovado', label: 'Aprovado', color: 'text-green-600',  bg: 'bg-green-50',  badgeBg: 'bg-green-100',  badgeText: 'text-green-700',  Icon: CheckCircle2 },
  { key: 'perdido',  label: 'Perdido',  color: 'text-red-600',    bg: 'bg-red-50',    badgeBg: 'bg-red-100',    badgeText: 'text-red-700',    Icon: XCircle },
]

const PERIODOS = [
  { key: 'mes', label: 'Mês atual' },
  { key: '3meses', label: 'Últimos 3 meses' },
  { key: 'ano', label: 'Este ano' },
]

function getDateRange(periodoKey) {
  const now = new Date()
  let start
  if (periodoKey === '3meses') {
    start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  } else if (periodoKey === 'ano') {
    start = new Date(now.getFullYear(), 0, 1)
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  }
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { startDate: start.toISOString(), endDate: end.toISOString() }
}

export default function StatusFunnel() {
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes')
  const [counts, setCounts] = useState({ rascunho: 0, enviado: 0, aprovado: 0, perdido: 0 })

  useEffect(() => {
    fetchCounts()
  }, [periodo])

  const fetchCounts = async () => {
    setLoading(true)
    try {
      const { startDate, endDate } = getDateRange(periodo)

      const queries = STATUS_CONFIG.map(({ key }) =>
        supabase
          .from('orcamentos')
          .select('*', { count: 'exact', head: true })
          .eq('status', key)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
      )

      const results = await Promise.all(queries)

      const newCounts = {}
      STATUS_CONFIG.forEach(({ key }, i) => {
        newCounts[key] = results[i].count || 0
      })
      setCounts(newCounts)
    } catch (error) {
      console.error('Erro ao buscar contagem de status:', error)
    } finally {
      setLoading(false)
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  const convEnviadoAprovado = counts.enviado > 0
    ? ((counts.aprovado / counts.enviado) * 100).toFixed(1)
    : '0.0'

  const convRascunhoEnviado = (counts.rascunho + counts.enviado + counts.aprovado + counts.perdido) > 0
    ? (((counts.enviado + counts.aprovado + counts.perdido) / total) * 100).toFixed(1)
    : '0.0'

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-[#0071b4]" size={32} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Funil de Status</h3>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODOS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                periodo === p.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {STATUS_CONFIG.map(({ key, label, color, bg, Icon }) => (
          <div key={key} className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:shadow-sm transition">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={20} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-bold text-gray-900">{counts[key]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Conversion Funnel Bar */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Taxa de Conversão</p>

        {/* Funnel steps */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Rascunho → Enviado</span>
              <span className="text-xs font-bold text-gray-700">{convRascunhoEnviado}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0071b4] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(parseFloat(convRascunhoEnviado), 100)}%` }}
              />
            </div>
          </div>

          <ArrowRight size={16} className="text-gray-300 flex-shrink-0 mt-3" />

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Enviado → Aprovado</span>
              <span className="text-xs font-bold text-gray-700">{convEnviadoAprovado}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(parseFloat(convEnviadoAprovado), 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Total */}
        <p className="text-xs text-gray-400 text-right">
          Total no período: <span className="font-bold text-gray-600">{total}</span> orçamentos
        </p>
      </div>
    </div>
  )
}
