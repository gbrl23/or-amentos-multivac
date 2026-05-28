import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { Loader2, Eye, FileText, Pencil, Filter, X, RotateCcw, Trash2, ClipboardList } from 'lucide-react'

const PdfIcon = ({ size = 20, className = '' }) => (
    <svg className={className} width={size} height={size} clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
        <path d="m24 25h2c.552 0 1-.448 1-1s-.448-1-1-1h-2v-1h2.5c.552 0 1-.448 1-1s-.448-1-1-1h-3.5c-.552 0-1 .448-1 1v6c0 .552.448 1 1 1s1-.448 1-1z"/>
        <path d="m14 20c-.552 0-1 .448-1 1v6c0 .552.448 1 1 1h2c2.209 0 4-1.791 4-4 0-.001 0-.001 0-.002 0-2.208-1.79-3.998-3.998-3.998-1.064 0-2.002 0-2.002 0zm1 2h1.002c1.103 0 1.998.895 1.998 1.998v.002c0 1.105-.895 2-2 2h-1z"/>
        <path d="m7 26h1.002c1.656 0 2.998-1.342 2.998-2.998v-.004c0-1.656-1.342-2.998-2.998-2.998h-2.002c-.552 0-1 .448-1 1v6c0 .552.448 1 1 1s1-.448 1-1zm0-2h1.002c.551 0 .998-.447.998-.998v-.004c0-.551-.447-.998-.998-.998h-1.002z"/>
        <path d="m17 5v5c0 1.657 1.343 3 3 3h5v4c0 .552.448 1 1 1s1-.448 1-1v-5c0-.265-.105-.52-.293-.707l-8-8c-.187-.188-.442-.293-.707-.293 0 0-6.586 0-10 0-1.657 0-3 1.343-3 3v11c0 .552.448 1 1 1s1-.448 1-1c0 0 0-7.354 0-11 0-.552.448-1 1-1zm2 1.414v3.586c0 .552.448 1 1 1h3.586z"/>
    </svg>
)
import DatePicker, { registerLocale } from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { ptBR } from 'date-fns/locale'

registerLocale('pt-BR', ptBR)

export default function AllBudgets() {
    const navigate = useNavigate()

    const [isAdmin, setIsAdmin] = useState(false)
    const [userId, setUserId] = useState(null)
    const [loading, setLoading] = useState(true)

    const [budgets, setBudgets] = useState([])
    const [loadingBudgets, setLoadingBudgets] = useState(true)
    const [selectedBudget, setSelectedBudget] = useState(null)

    // Filtros
    const [filterStartDate, setFilterStartDate] = useState('')
    const [filterEndDate, setFilterEndDate] = useState('')
    const [isSingleDate, setIsSingleDate] = useState(false)
    const [filterClient, setFilterClient] = useState('')
    const [filterRep, setFilterRep] = useState('')
    const [filterCnpj, setFilterCnpj] = useState('')
    const [filterId, setFilterId] = useState('')

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { navigate('/'); return }
            const admin = user.user_metadata?.role === 'admin'
            setIsAdmin(admin)
            setUserId(user.id)
            setLoading(false)
        }
        init()
    }, [navigate])

    useEffect(() => {
        if (!loading && userId) fetchBudgets()
    }, [loading, userId])

    const buildQuery = (applyFilters = true) => {
        let query = supabase
            .from('orcamentos')
            .select('*')
            .order('created_at', { ascending: false })

        if (!isAdmin) {
            query = query.eq('user_id', userId)
        }

        if (applyFilters) {
            if (isSingleDate && filterStartDate) {
                query = query.gte('created_at', `${filterStartDate}T00:00:00`)
                query = query.lte('created_at', `${filterStartDate}T23:59:59`)
            } else {
                if (filterStartDate) query = query.gte('created_at', `${filterStartDate}T00:00:00`)
                if (filterEndDate) query = query.lte('created_at', `${filterEndDate}T23:59:59`)
            }
            if (filterClient) query = query.ilike('cliente_empresa', `%${filterClient}%`)
            if (filterRep) query = query.ilike('payload->>representante', `%${filterRep}%`)
            if (filterCnpj) query = query.ilike('cliente_cnpj', `%${filterCnpj}%`)
            if (filterId) query = query.eq('id', filterId)
        }

        return query
    }

    const fetchBudgets = async () => {
        setLoadingBudgets(true)
        try {
            const { data, error } = await buildQuery()
            if (error) throw error
            setBudgets(data || [])
        } catch (e) {
            console.error('Erro ao carregar orçamentos:', e)
        } finally {
            setLoadingBudgets(false)
        }
    }

    const clearFilters = async () => {
        setFilterStartDate('')
        setFilterEndDate('')
        setFilterClient('')
        setFilterRep('')
        setFilterCnpj('')
        setFilterId('')
        setIsSingleDate(false)
        setLoadingBudgets(true)
        try {
            const { data, error } = await buildQuery(false)
            if (error) throw error
            setBudgets(data || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingBudgets(false)
        }
    }

    const handleEditBudget = (budget) => {
        navigate('/orcamentos', { state: { editMode: true, budgetData: budget } })
    }

    const handleDeleteBudget = async (budget) => {
        if (!window.confirm('Tem certeza que deseja excluir este rascunho?')) return
        try {
            setLoadingBudgets(true)
            const { error } = await supabase
                .from('orcamentos')
                .delete()
                .eq('id', budget.id)
                .eq('status', 'rascunho')
            if (error) throw error
            fetchBudgets()
        } catch (e) {
            console.error('Erro ao excluir:', e)
        } finally {
            setLoadingBudgets(false)
        }
    }

    const handleDownloadPdf = async (url, clientName) => {
        try {
            const response = await fetch(url)
            const blob = await response.blob()
            const blobUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = blobUrl
            link.download = `Proposta_${clientName || 'Multivac'}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(blobUrl)
        } catch (e) {
            console.error('Erro ao baixar PDF:', e)
        }
    }

    const formatDate = (dateString) =>
        new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })

    const formatCurrency = (val) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-[#0071b4]" size={32} />
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#0071b4]">
                        <ClipboardList size={22} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">
                            {isAdmin ? 'Todos os Orçamentos' : 'Meus Orçamentos'}
                        </h1>
                        <p className="text-sm text-gray-500">
                            {isAdmin ? 'Visualize e gerencie propostas de toda a equipe' : 'Acompanhe suas propostas enviadas'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchBudgets}
                    className="text-sm text-[#0071b4] hover:underline font-medium"
                >
                    Atualizar
                </button>
            </div>

            {/* Filtros + Tabela */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Filters Bar */}
                <div className="p-4 bg-gray-50/50 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="flex items-center gap-2 mb-2 sm:mb-0 lg:col-span-5">
                        <input
                            type="checkbox"
                            id="singleDate"
                            checked={isSingleDate}
                            onChange={(e) => setIsSingleDate(e.target.checked)}
                            className="rounded border-gray-300 text-[#0071b4] focus:ring-[#0071b4]"
                        />
                        <label htmlFor="singleDate" className="text-sm text-gray-700 select-none">
                            Data Única
                        </label>
                    </div>

                    {isSingleDate ? (
                        <div className="lg:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
                            <DatePicker
                                selected={filterStartDate ? new Date(filterStartDate + 'T12:00:00') : null}
                                onChange={(date) => {
                                    if (!date) { setFilterStartDate(''); return }
                                    const y = date.getFullYear()
                                    const m = String(date.getMonth() + 1).padStart(2, '0')
                                    const d = String(date.getDate()).padStart(2, '0')
                                    setFilterStartDate(`${y}-${m}-${d}`)
                                }}
                                dateFormat="dd/MM/yyyy"
                                locale="pt-BR"
                                showMonthDropdown
                                showYearDropdown
                                dropdownMode="select"
                                placeholderText="Selecione..."
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#0071b4] outline-none"
                            />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">De</label>
                                <DatePicker
                                    selected={filterStartDate ? new Date(filterStartDate + 'T12:00:00') : null}
                                    onChange={(date) => {
                                        if (!date) { setFilterStartDate(''); return }
                                        const y = date.getFullYear()
                                        const m = String(date.getMonth() + 1).padStart(2, '0')
                                        const d = String(date.getDate()).padStart(2, '0')
                                        setFilterStartDate(`${y}-${m}-${d}`)
                                    }}
                                    dateFormat="dd/MM/yyyy"
                                    locale="pt-BR"
                                    showMonthDropdown
                                    showYearDropdown
                                    dropdownMode="select"
                                    placeholderText="Início"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#0071b4] outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Até</label>
                                <DatePicker
                                    selected={filterEndDate ? new Date(filterEndDate + 'T12:00:00') : null}
                                    onChange={(date) => {
                                        if (!date) { setFilterEndDate(''); return }
                                        const y = date.getFullYear()
                                        const m = String(date.getMonth() + 1).padStart(2, '0')
                                        const d = String(date.getDate()).padStart(2, '0')
                                        setFilterEndDate(`${y}-${m}-${d}`)
                                    }}
                                    dateFormat="dd/MM/yyyy"
                                    locale="pt-BR"
                                    showMonthDropdown
                                    showYearDropdown
                                    dropdownMode="select"
                                    placeholderText="Fim"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#0071b4] outline-none"
                                />
                            </div>
                        </>
                    )}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Cliente</label>
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={filterClient}
                            onChange={(e) => setFilterClient(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#0071b4] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">CNPJ / CPF</label>
                        <input
                            type="text"
                            placeholder="Buscar documento..."
                            value={filterCnpj}
                            onChange={(e) => setFilterCnpj(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#0071b4] outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">N° Orçamento</label>
                        <input
                            type="text"
                            placeholder="ID do orçamento..."
                            value={filterId}
                            onChange={(e) => setFilterId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#0071b4] outline-none"
                        />
                    </div>
                    {isAdmin && (
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Representante</label>
                            <input
                                type="text"
                                placeholder="Buscar representante..."
                                value={filterRep}
                                onChange={(e) => setFilterRep(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#0071b4] outline-none"
                            />
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={fetchBudgets}
                            className="flex-1 bg-[#0071b4] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#005a91] transition flex items-center justify-center gap-2"
                        >
                            <Filter size={16} />
                            Filtrar
                        </button>
                        <button
                            onClick={clearFilters}
                            className="px-3 bg-white border border-gray-300 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                            title="Limpar filtros"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Tabela */}
                <div className="overflow-x-auto">
                    {loadingBudgets ? (
                        <div className="p-8 text-center text-gray-500">
                            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                            Carregando orçamentos...
                        </div>
                    ) : budgets.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            Nenhum orçamento encontrado.
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-600 font-medium">
                                <tr>
                                    <th className="p-4">Data</th>
                                    {isAdmin && <th className="p-4">Representante</th>}
                                    <th className="p-4">Cliente</th>
                                    <th className="p-4">Valor Total</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {budgets.map((b) => (
                                    <tr key={b.id} className="hover:bg-gray-50 transition">
                                        <td className="p-4 text-gray-600">{formatDate(b.created_at)}</td>
                                        {isAdmin && (
                                            <td className="p-4 text-gray-600 text-sm">
                                                {b.payload?.representante || '—'}
                                            </td>
                                        )}
                                        <td className="p-4">
                                            <div className="font-medium text-gray-800">{b.cliente_empresa || '—'}</div>
                                            <div className="text-xs text-gray-500">{b.cliente_nome}</div>
                                        </td>
                                        <td className="p-4 font-medium text-gray-800">
                                            {formatCurrency(b.valor_total)}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                                                b.status === 'rascunho' ? 'bg-yellow-100 text-yellow-700' :
                                                b.status === 'aprovado' ? 'bg-green-100 text-green-700' :
                                                b.status === 'perdido' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                                {b.status || 'Enviado'}
                                            </span>
                                            {b.payload?.version > 1 && (
                                                <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700" title="Proposta editada">
                                                    V{b.payload.version}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setSelectedBudget(b)}
                                                className="p-2 text-gray-500 hover:text-[#0071b4] hover:bg-blue-50 rounded-full transition"
                                                title="Ver Detalhes"
                                            >
                                                <Eye size={20} />
                                            </button>
                                            {b.pdf_url && (
                                                <button
                                                    onClick={() => handleDownloadPdf(b.pdf_url, b.cliente_empresa)}
                                                    className="inline-flex p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition ml-1"
                                                    title="Baixar PDF"
                                                >
                                                    <PdfIcon size={20} />
                                                </button>
                                            )}
                                            {b.status === 'rascunho' ? (
                                                <>
                                                    <button
                                                        onClick={() => handleEditBudget(b)}
                                                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition ml-1"
                                                        title="Tentar Novamente"
                                                    >
                                                        <RotateCcw size={20} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteBudget(b)}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition ml-1"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleEditBudget(b)}
                                                    className="p-2 text-gray-500 hover:text-[#0071b4] hover:bg-blue-50 rounded-full transition ml-1"
                                                    title="Editar Orçamento"
                                                >
                                                    <Pencil size={20} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal de Detalhes */}
            {selectedBudget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-start gap-3 bg-gray-50">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="bg-blue-100 p-2 rounded-lg text-[#0071b4] shrink-0">
                                    <FileText size={24} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-base sm:text-lg font-semibold text-gray-800">Detalhes do Orçamento</h3>
                                    <p className="text-sm text-gray-500 truncate">
                                        {formatDate(selectedBudget.created_at)} • {selectedBudget.cliente_empresa}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedBudget(null)}
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Cliente</p>
                                    <p className="font-medium text-gray-800">{selectedBudget.cliente_empresa}</p>
                                    <p className="text-sm text-gray-600">{selectedBudget.cliente_nome}</p>
                                    <p className="text-sm text-gray-600">{selectedBudget.cliente_cnpj}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Valores</p>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Subtotal:</span>
                                        <span>{formatCurrency(selectedBudget.payload?.valores?.subtotal || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Impostos:</span>
                                        <span>{formatCurrency((selectedBudget.payload?.valores?.icms || 0) + (selectedBudget.payload?.valores?.ipi || 0))}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-gray-800 pt-2 border-t border-gray-200 mt-2">
                                        <span>Total:</span>
                                        <span className="text-[#0071b4]">{formatCurrency(selectedBudget.valor_total)}</span>
                                    </div>
                                </div>
                            </div>

                            <h4 className="font-semibold text-gray-800 mb-3">Itens do Orçamento</h4>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-medium">
                                        <tr>
                                            <th className="p-3">Código</th>
                                            <th className="p-3">Produto</th>
                                            <th className="p-3 text-center">Qtd</th>
                                            <th className="p-3 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(selectedBudget.payload?.itens || []).map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="p-3 text-gray-600">{item.codigo}</td>
                                                <td className="p-3 font-medium text-gray-800">{item.nome}</td>
                                                <td className="p-3 text-center">{item.quantidade} {item.unidade}</td>
                                                <td className="p-3 text-right font-medium">
                                                    {formatCurrency(item.subtotal)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row justify-between gap-2">
                            <div className="flex flex-col-reverse sm:flex-row gap-2">
                                <button
                                    onClick={() => { setSelectedBudget(null); handleEditBudget(selectedBudget) }}
                                    className="px-4 py-2.5 bg-[#0071b4] text-white rounded-lg hover:bg-[#005a91] font-medium transition flex items-center justify-center gap-2"
                                >
                                    <Pencil size={16} />
                                    Editar Orçamento
                                </button>
                                {selectedBudget.pdf_url && (
                                    <button
                                        onClick={() => handleDownloadPdf(selectedBudget.pdf_url, selectedBudget.cliente_empresa)}
                                        className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition flex items-center justify-center gap-2"
                                    >
                                        <PdfIcon size={16} />
                                        Baixar PDF
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedBudget(null)}
                                className="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
