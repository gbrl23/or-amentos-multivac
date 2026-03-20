import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import {
  Trophy,
  Loader2,
  Users,
} from 'lucide-react'

export default function RetrabalhoRanking() {
  const [loading, setLoading] = useState(true)
  const [ranking, setRanking] = useState([])

  useEffect(() => {
    fetchRanking()
  }, [])

  const fetchRanking = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('payload')
        .neq('status', 'rascunho')

      if (error) throw error

      // Agrupar por representante
      const repMap = {}
      data.forEach(row => {
        const rep = row.payload?.representante
        if (!rep) return

        if (!repMap[rep]) {
          repMap[rep] = { total: 0, edicoes: 0 }
        }
        repMap[rep].total += 1
        const ver = row.payload?.version || 1
        if (ver > 1) {
          repMap[rep].edicoes += 1
        }
      })

      // Converter para array e calcular média
      const rankingArr = Object.entries(repMap)
        .map(([nome, stats]) => ({
          nome,
          total: stats.total,
          edicoes: stats.edicoes,
          media: stats.total > 0 ? stats.edicoes / stats.total : 0,
        }))
        .sort((a, b) => a.media - b.media) // Menor retrabalho no topo

      setRanking(rankingArr)
    } catch (error) {
      console.error('Erro ao buscar ranking de retrabalho:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMediaBadge = (media) => {
    if (media <= 0.15) return { bg: 'bg-green-100', text: 'text-green-700' }
    if (media <= 0.35) return { bg: 'bg-yellow-100', text: 'text-yellow-700' }
    return { bg: 'bg-red-100', text: 'text-red-700' }
  }

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
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#0071b4]">
          <Trophy size={20} strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Ranking de Retrabalho</h3>
          <p className="text-xs text-gray-400">Ordenado por menor taxa de edição (melhor desempenho no topo)</p>
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
          <Users size={24} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Nenhum dado de representante encontrado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-bold uppercase tracking-wider text-gray-400 pb-3 pl-3">#</th>
                <th className="text-left text-xs font-bold uppercase tracking-wider text-gray-400 pb-3">Representante</th>
                <th className="text-center text-xs font-bold uppercase tracking-wider text-gray-400 pb-3">Orçamentos</th>
                <th className="text-center text-xs font-bold uppercase tracking-wider text-gray-400 pb-3">Edições</th>
                <th className="text-center text-xs font-bold uppercase tracking-wider text-gray-400 pb-3">Média</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((rep, i) => {
                const badge = getMediaBadge(rep.media)
                return (
                  <tr key={rep.nome} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="py-3 pl-3">
                      {i < 3 ? (
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700' :
                          i === 1 ? 'bg-gray-200 text-gray-600' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {i + 1}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 pl-1.5">{i + 1}</span>
                      )}
                    </td>
                    <td className="py-3 text-sm font-medium text-gray-800">{rep.nome}</td>
                    <td className="py-3 text-center text-sm text-gray-600">{rep.total}</td>
                    <td className="py-3 text-center text-sm text-gray-600">{rep.edicoes}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {(rep.media * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
