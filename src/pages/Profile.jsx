import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { User, Mail, Lock, ArrowLeft, History, Loader2, CheckCircle, AlertCircle, Save, Edit2, X, Eye, FileText, Pencil, Filter, Search } from 'lucide-react'

export default function Profile() {
    const navigate = useNavigate()
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    // Form states
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    // Feedback
    const [message, setMessage] = useState({ type: null, text: '' })
    const [updating, setUpdating] = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    // History
    const [budgets, setBudgets] = useState([])
    const [selectedBudget, setSelectedBudget] = useState(null)
    const [loadingHistory, setLoadingHistory] = useState(true)

    // Filters
    const [filterStartDate, setFilterStartDate] = useState('')
    const [filterEndDate, setFilterEndDate] = useState('')
    const [filterClient, setFilterClient] = useState('')
    const [filterRep, setFilterRep] = useState('')

    useEffect(() => {
        fetchUser()
        fetchHistory()
    }, [])

    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            setUser(user)
            setName(user.user_metadata?.full_name || user.user_metadata?.name || '')
            setEmail(user.email)
        }
        setLoading(false)
    }

    const fetchHistory = async () => {
        try {
            setLoadingHistory(true)
            let query = supabase
                .from('orcamentos')
                .select('*')
                .order('created_at', { ascending: false })

            if (filterStartDate) query = query.gte('created_at', `${filterStartDate}T00:00:00`)
            if (filterEndDate) query = query.lte('created_at', `${filterEndDate}T23:59:59`)
            if (filterClient) query = query.ilike('cliente_empresa', `%${filterClient}%`)
            if (filterRep) query = query.ilike('payload->>representante', `%${filterRep}%`)

            const { data, error } = await query

            if (error) throw error
            setBudgets(data || [])
        } catch (error) {
            console.error('Erro ao carregar histórico:', error)
        } finally {
            setLoadingHistory(false)
        }
    }

    const clearFilters = () => {
        setFilterStartDate('')
        setFilterEndDate('')
        setFilterClient('')
        setFilterRep('')
        // Precisamos chamar o fetch depois que limpar, mas como set é async, 
        // melhor chamar direto passando vazio ou usar useEffect. 
        // Simplificando: recarregar página ou forçar busca sem filtro manualmente
        // Vou forçar a busca manual "limpa"
        fetchHistoryWithoutFilters()
    }

    const fetchHistoryWithoutFilters = async () => {
        // Versão auxiliar para limpar e buscar imediato (contornando closure state antigo)
        try {
            setLoadingHistory(true)
            const { data, error } = await supabase
                .from('orcamentos')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            setBudgets(data || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingHistory(false)
        }
    }

    const showMessage = (type, text) => {
        setMessage({ type, text })
        setTimeout(() => setMessage({ type: null, text: '' }), 5000)
    }

    const handleUpdateProfile = async (e) => {
        e.preventDefault()
        setUpdating(true)
        setMessage({ type: null, text: '' })

        try {
            const updates = { data: {} }
            if (name !== (user.user_metadata?.full_name || user.user_metadata?.name)) updates.data.full_name = name
            if (email !== user.email) updates.email = email
            if (password) {
                // eslint-disable-next-line security/detect-possible-timing-attacks
                if (password !== confirmPassword) throw new Error('As senhas não coincidem')
                if (password.length < 6) throw new Error('A senha deve ter no mínimo 6 caracteres')
                updates.password = password
            }

            if (Object.keys(updates).length === 1 && Object.keys(updates.data).length === 0) {
                setUpdating(false)
                return
            }

            const { error } = await supabase.auth.updateUser(updates)
            if (error) throw error

            showMessage('success', 'Perfil atualizado com sucesso! Se alterou o email, verifique sua caixa de entrada.')
            setPassword('')
            setConfirmPassword('')
            fetchUser()
        } catch (error) {
            showMessage('error', error.message)
        } finally {
            setUpdating(false)
            setIsEditing(false)
        }
    }




    const handleEditBudget = (budget) => {
        navigate('/orcamentos', { state: { editMode: true, budgetData: budget } })
    }
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
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
            <div className="max-w-7xl mx-auto">
                <button
                    onClick={() => navigate('/orcamentos')}
                    className="flex items-center gap-2 text-gray-600 hover:text-[#0071b4] mb-6 transition"
                >
                    <ArrowLeft size={20} />
                    Voltar para Orçamentos
                </button>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Profile Card */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex flex-col items-center mb-6">
                                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-[#0071b4] mb-3">
                                    <User size={40} />
                                </div>
                                <h2 className="text-xl font-semibold text-gray-800">Meu Perfil</h2>
                                <p className="text-sm text-gray-500">Representante</p>
                            </div>

                            {message.type && (
                                <div className={`p-3 rounded-lg mb-4 text-sm flex items-start gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                                    }`}>
                                    {message.type === 'error' ? <AlertCircle size={16} className="mt-0.5" /> : <CheckCircle size={16} className="mt-0.5" />}
                                    {message.text}
                                </div>
                            )}

                            <form onSubmit={handleUpdateProfile} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            disabled={!isEditing}
                                            className={`w-full pl-10 pr-3 py-2 border rounded-lg outline-none text-sm ${!isEditing ? 'bg-gray-100 border-gray-200 text-gray-500' : 'border-gray-300 focus:ring-2 focus:ring-[#0071b4]'}`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={!isEditing}
                                            className={`w-full pl-10 pr-3 py-2 border rounded-lg outline-none text-sm ${!isEditing ? 'bg-gray-100 border-gray-200 text-gray-500' : 'border-gray-300 focus:ring-2 focus:ring-[#0071b4]'}`}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                        <input
                                            type="password"
                                            placeholder="Deixe em branco para manter"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            disabled={!isEditing}
                                            className={`w-full pl-10 pr-3 py-2 border rounded-lg outline-none text-sm ${!isEditing ? 'bg-gray-100 border-gray-200 text-gray-500' : 'border-gray-300 focus:ring-2 focus:ring-[#0071b4]'}`}
                                        />
                                    </div>
                                </div>

                                {password && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                            <input
                                                type="password"
                                                placeholder="Repita a nova senha"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                disabled={!isEditing}
                                                className={`w-full pl-10 pr-3 py-2 border rounded-lg outline-none text-sm ${!isEditing ? 'bg-gray-100 border-gray-200 text-gray-500' : 'border-gray-300 focus:ring-2 focus:ring-[#0071b4]'}`}
                                            />
                                        </div>
                                    </div>
                                )}

                                {!isEditing ? (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="w-full bg-white border border-[#0071b4] text-[#0071b4] py-2 rounded-lg font-medium hover:bg-blue-50 transition flex items-center justify-center gap-2"
                                    >
                                        <Edit2 size={18} />
                                        Editar Dados
                                    </button>
                                ) : (
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditing(false);
                                                setEmail(user.email);
                                                setName(user.user_metadata?.full_name || user.user_metadata?.name || '');
                                                setPassword('');
                                                setConfirmPassword('')
                                            }}
                                            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={updating}
                                            className="flex-1 bg-[#0071b4] text-white py-2 rounded-lg font-medium hover:bg-[#005f9e] transition disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {updating ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                            Salvar
                                        </button>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>

                    {/* History Section */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <History className="text-[#0071b4]" size={24} />
                                    <h2 className="text-xl font-semibold text-gray-800">Histórico de Orçamentos</h2>
                                </div>
                                <button
                                    onClick={fetchHistory}
                                    className="text-sm text-[#0071b4] hover:underline"
                                >
                                    Atualizar Lista
                                </button>
                            </div>

                            {/* Filters Bar */}
                            <div className="p-4 bg-gray-50/50 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">De</label>
                                    <input
                                        type="date"
                                        value={filterStartDate}
                                        onChange={(e) => setFilterStartDate(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#0071b4] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Até</label>
                                    <input
                                        type="date"
                                        value={filterEndDate}
                                        onChange={(e) => setFilterEndDate(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#0071b4] outline-none"
                                    />
                                </div>
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
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Representante</label>
                                    <input
                                        type="text"
                                        placeholder="Buscar representante..."
                                        value={filterRep}
                                        onChange={(e) => setFilterRep(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#0071b4] outline-none"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={fetchHistory}
                                        className="flex-1 bg-[#0071b4] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#005f9e] transition flex items-center justify-center gap-2"
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

                            <div className="overflow-x-auto">
                                {loadingHistory ? (
                                    <div className="p-8 text-center text-gray-500">
                                        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                                        Carregando histórico...
                                    </div>
                                ) : budgets.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        Nenhum orçamento gerado ainda.
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 text-gray-600 font-medium">
                                            <tr>
                                                <th className="p-4">Data</th>
                                                <th className="p-4">Representante</th>
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
                                                    <td className="p-4 text-gray-600 text-sm">
                                                        {b.payload?.representante || '—'}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-medium text-gray-800">{b.cliente_empresa || '—'}</div>
                                                        <div className="text-xs text-gray-500">{b.cliente_nome}</div>
                                                    </td>
                                                    <td className="p-4 font-medium text-gray-800">
                                                        {formatCurrency(b.valor_total)}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                                                            {b.status || 'Gerado'}
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
                                                        <button
                                                            onClick={() => handleEditBudget(b)}
                                                            className="p-2 text-gray-500 hover:text-[#0071b4] hover:bg-blue-50 rounded-full transition ml-1"
                                                            title="Editar Orçamento"
                                                        >
                                                            <Pencil size={20} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Detalhes */}
            {selectedBudget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 p-2 rounded-lg text-[#0071b4]">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800">Detalhes do Orçamento</h3>
                                    <p className="text-sm text-gray-500">
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

                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4 mb-6">
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

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setSelectedBudget(null)}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
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
