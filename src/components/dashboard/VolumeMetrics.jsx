import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  FileText,
  Loader2,
  MapPin,
} from 'lucide-react'

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

const formatBRL = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

export default function VolumeMetrics() {
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes')
  const [metrics, setMetrics] = useState({ total: 0, valorTotal: 0, ticketMedio: 0 })
  const [byRep, setByRep] = useState([])
  const [byUF, setByUF] = useState([])
  const [activeTab, setActiveTab] = useState('rep')

  useEffect(() => {
    fetchMetrics()
  }, [periodo])

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const { startDate, endDate } = getDateRange(periodo)

      const { data, error } = await supabase
        .from('orcamentos')
        .select('valor_total, payload')
        .neq('status', 'rascunho')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (error) throw error

      const count = data.length
      const valorTotal = data.reduce((sum, row) => sum + (row.valor_total || 0), 0)
      const ticketMedio = count > 0 ? valorTotal / count : 0

      setMetrics({ total: count, valorTotal, ticketMedio })

      // Breakdown por representante
      const repMap = {}
      data.forEach(row => {
        const rep = row.payload?.representante || 'Não identificado'
        if (!repMap[rep]) repMap[rep] = { qtd: 0, valor: 0 }
        repMap[rep].qtd += 1
        repMap[rep].valor += row.valor_total || 0
      })
      setByRep(
        Object.entries(repMap)
          .map(([nome, s]) => ({ nome, ...s }))
          .sort((a, b) => b.valor - a.valor)
      )

      // Breakdown por UF (estado)
      const ufMap = {}
      data.forEach(row => {
        const uf = row.payload?.cliente?.estado || 'N/A'
        if (!ufMap[uf]) ufMap[uf] = { qtd: 0, valor: 0 }
        ufMap[uf].qtd += 1
        ufMap[uf].valor += row.valor_total || 0
      })
      setByUF(
        Object.entries(ufMap)
          .map(([uf, s]) => ({ uf, ...s }))
          .sort((a, b) => b.valor - a.valor)
      )
    } catch (error) {
      console.error('Erro ao buscar métricas de volume:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-[#0071b4]" size={32} />
        </div>
      </div>
    )
  }

  const breakdownData = activeTab === 'rep' ? byRep : byUF
  const maxValor = breakdownData.length > 0 ? Math.max(...breakdownData.map(d => d.valor)) : 1

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#0071b4]">
            <BarChart3 size={20} strokeWidth={1.5} />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900">Volume e Ticket Médio</h3>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODOS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`px-2 sm:px-3 py-1.5 text-xs font-medium rounded-md transition ${
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

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#0071b4]">
            <FileText size={20} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Orçamentos</p>
            <p className="text-2xl font-bold text-gray-900">{metrics.total}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
            <DollarSign size={20} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Valor Total</p>
            <p className="text-xl font-bold text-gray-900">{formatBRL(metrics.valorTotal)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
            <TrendingUp size={20} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Ticket Médio</p>
            <p className="text-xl font-bold text-gray-900">{formatBRL(metrics.ticketMedio)}</p>
          </div>
        </div>
      </div>

      {/* Breakdown Tabs */}
      <div className="flex items-center gap-4 mb-4 border-b border-gray-100">
        <button
          onClick={() => setActiveTab('rep')}
          className={`pb-2 text-sm font-medium border-b-2 transition ${
            activeTab === 'rep'
              ? 'border-[#0071b4] text-[#0071b4]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Por Representante
        </button>
        <button
          onClick={() => setActiveTab('uf')}
          className={`pb-2 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'uf'
              ? 'border-[#0071b4] text-[#0071b4]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <MapPin size={14} /> Por Estado (UF)
        </button>
      </div>

      {/* Breakdown Table */}
      {breakdownData.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Nenhum dado disponível no período.</p>
      ) : (
        <div className="space-y-2">
          {breakdownData.map((item, i) => {
            const label = activeTab === 'rep' ? item.nome : item.uf
            const barWidth = maxValor > 0 ? (item.valor / maxValor) * 100 : 0
            return (
              <div key={label} className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                <span className="text-xs sm:text-sm font-medium text-gray-700 w-20 sm:w-32 truncate flex-shrink-0" title={label}>
                  {label}
                </span>
                <div className="flex-1 h-6 bg-gray-50 rounded-md overflow-hidden relative min-w-0">
                  <div
                    className="h-full bg-[#0071b4]/15 rounded-md transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs text-gray-500">
                    {item.qtd} orç.
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-800 w-20 sm:w-28 text-right flex-shrink-0">
                  {formatBRL(item.valor)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
