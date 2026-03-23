import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { UserPlus, Mail, Shield, Loader2, CheckCircle, AlertCircle, Users, Eye, FileText, Pencil, X } from 'lucide-react'

export default function ManageUsers() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [isAdmin, setIsAdmin] = useState(false)
    const [inviting, setInviting] = useState(false)

    // Form de convite
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [role, setRole] = useState('representative')
    const [message, setMessage] = useState({ type: null, text: '' })

    // Lista de usuários
    const [users, setUsers] = useState([])
    const [loadingUsers, setLoadingUsers] = useState(true)

    // Propostas do rep selecionado
    const [selectedUser, setSelectedUser] = useState(null)
    const [userBudgets, setUserBudgets] = useState([])
    const [loadingBudgets, setLoadingBudgets] = useState(false)

    // Modal de detalhe do orçamento
    const [selectedBudget, setSelectedBudget] = useState(null)

    useEffect(() => { checkAdmin() }, [])

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { navigate('/'); return }
        if (user.user_metadata?.role !== 'admin') { navigate('/orcamentos'); return }
        setIsAdmin(true)
        setLoading(false)
        fetchUsers()
    }

    const fetchUsers = async () => {
        setLoadingUsers(true)
        try {
            const { data, error } = await supabase.functions.invoke('bright-task')
            console.log('[fetchUsers] raw response:', { data, error, type: typeof data })
            if (error) throw error
            if (data?.error) throw new Error(data.error)
            const parsed = typeof data === 'string' ? JSON.parse(data) : data
            setUsers(Array.isArray(parsed) ? parsed : [])
        } catch (e) {
            console.error('Erro ao buscar usuários:', e)
        } finally {
            setLoadingUsers(false)
        }
    }

    const fetchUserBudgets = async (userId) => {
        setLoadingBudgets(true)
        try {
            const { data, error } = await supabase
                .from('orcamentos')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
            if (error) throw error
            setUserBudgets(data || [])
        } catch (e) {
            console.error('Erro ao buscar propostas:', e)
        } finally {
            setLoadingBudgets(false)
        }
    }

    const handleSelectUser = (user) => {
        if (selectedUser?.id === user.id) {
            setSelectedUser(null)
            setUserBudgets([])
            return
        }
        setSelectedUser(user)
        fetchUserBudgets(user.id)
    }

    const showMessage = (type, text) => {
        setMessage({ type, text })
        setTimeout(() => setMessage({ type: null, text: '' }), 5000)
    }

    const handleInvite = async (e) => {
        e.preventDefault()
        if (!name || !email) { showMessage('error', 'Preencha nome e email.'); return }
        setInviting(true)
        setMessage({ type: null, text: '' })

        try {
            const { data, error } = await supabase.functions.invoke('invite-user', {
                body: { name, email, role }
            })
            if (data?.error) throw new Error(data.error)
            if (error) throw error
            showMessage('success', `Convite enviado com sucesso para ${email}!`)
            setName(''); setEmail(''); setRole('representative')
            fetchUsers()
        } catch (error) {
            console.error(error)
            showMessage('error', `Erro ao convidar: ${error.message}`)
        } finally {
            setInviting(false)
        }
    }

    const handleEditBudget = (budget) => {
        navigate('/orcamentos', { state: { editMode: true, budgetData: budget } })
    }

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })

    const formatDateShort = (dateString) => new Date(dateString).toLocaleDateString('pt-BR', {
        month: 'short', year: 'numeric'
    })

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="animate-spin text-[#0071b4]" size={40} />
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8 animate-in fade-in duration-500">

            {/* ====== Convidar Usuário ====== */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0071b4]">
                        <UserPlus size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Convidar Usuário</h2>
                        <p className="text-sm text-gray-500">Envie um convite para criar um novo acesso ao sistema.</p>
                    </div>
                </div>

                {message.type && (
                    <div className={`p-4 rounded-lg mb-6 flex items-start gap-3 ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        {message.type === 'error' ? <AlertCircle className="mt-0.5" size={18} /> : <CheckCircle className="mt-0.5" size={18} />}
                        <div className="text-sm">{message.text}</div>
                    </div>
                )}

                <form onSubmit={handleInvite} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-[#0071b4] outline-none transition"
                                placeholder="Ex: João Silva" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 text-gray-400" size={16} />
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0071b4] outline-none transition"
                                    placeholder="email@empresa.com" required />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nível de Acesso</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className={`border rounded-xl p-4 cursor-pointer transition flex items-start gap-3 ${role === 'representative' ? 'border-[#0071b4] bg-blue-50/50 ring-1 ring-[#0071b4]' : 'border-gray-200 hover:border-gray-300'}`}>
                                <input type="radio" name="role" value="representative" checked={role === 'representative'} onChange={() => setRole('representative')} className="mt-1" />
                                <div>
                                    <div className="font-semibold text-gray-900">Representante</div>
                                    <div className="text-sm text-gray-500">Pode criar orçamentos e ver seu próprio histórico.</div>
                                </div>
                            </label>
                            <label className={`border rounded-xl p-4 cursor-pointer transition flex items-start gap-3 ${role === 'admin' ? 'border-[#0071b4] bg-blue-50/50 ring-1 ring-[#0071b4]' : 'border-gray-200 hover:border-gray-300'}`}>
                                <input type="radio" name="role" value="admin" checked={role === 'admin'} onChange={() => setRole('admin')} className="mt-1" />
                                <div>
                                    <div className="font-semibold text-gray-900 flex items-center gap-2">Administrador <Shield size={14} className="text-[#0071b4]" /></div>
                                    <div className="text-sm text-gray-500">Acesso total. Pode ver todos os orçamentos e convidar usuários.</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex justify-end">
                        <button type="submit" disabled={inviting}
                            className="bg-[#0071b4] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#005a91] transition flex items-center gap-2 disabled:opacity-50 shadow-sm">
                            {inviting ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
                            {inviting ? 'Enviando...' : 'Enviar Convite'}
                        </button>
                    </div>
                </form>
            </div>

            {/* ====== Lista de Usuários ====== */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0071b4]">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Equipe</h2>
                            <p className="text-sm text-gray-500">{users.length} membro{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button onClick={fetchUsers} className="text-sm text-[#0071b4] hover:underline font-medium">
                        Atualizar
                    </button>
                </div>

                {loadingUsers ? (
                    <div className="py-12 text-center text-gray-500">
                        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                        Carregando equipe...
                    </div>
                ) : users.length === 0 ? (
                    <div className="py-12 text-center text-gray-500">
                        Nenhum usuário encontrado.
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-600 font-medium">
                                <tr>
                                    <th className="p-4">Nome</th>
                                    <th className="p-4">Email</th>
                                    <th className="p-4">Cargo</th>
                                    <th className="p-4">Membro desde</th>
                                    <th className="p-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map((u) => (
                                    <tr key={u.id} className={`transition ${selectedUser?.id === u.id ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-100 to-[#0071b4]/20 flex items-center justify-center text-[#0071b4] font-bold text-xs">
                                                    {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-gray-900">{u.name || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-600">{u.email}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {u.role === 'admin' ? 'Admin' : 'Representante'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-500 capitalize">{formatDateShort(u.created_at)}</td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => handleSelectUser(u)}
                                                className={`p-2 rounded-lg transition text-sm font-medium flex items-center gap-1.5 ml-auto ${selectedUser?.id === u.id ? 'bg-[#0071b4] text-white' : 'text-gray-500 hover:text-[#0071b4] hover:bg-blue-50'}`}>
                                                <Eye size={16} />
                                                Propostas
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ====== Propostas do Representante Selecionado ====== */}
            {selectedUser && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Propostas de {selectedUser.name || selectedUser.email}</h2>
                            <p className="text-sm text-gray-500">{userBudgets.length} orçamento{userBudgets.length !== 1 ? 's' : ''} encontrado{userBudgets.length !== 1 ? 's' : ''}</p>
                        </div>
                        <button onClick={() => { setSelectedUser(null); setUserBudgets([]) }}
                            className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-lg hover:bg-gray-100">
                            <X size={18} />
                        </button>
                    </div>

                    {loadingBudgets ? (
                        <div className="py-12 text-center text-gray-500">
                            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                            Carregando propostas...
                        </div>
                    ) : userBudgets.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">
                            Este membro ainda não gerou nenhum orçamento.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="p-4">Data</th>
                                        <th className="p-4">Cliente</th>
                                        <th className="p-4">Valor Total</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {userBudgets.map((b) => (
                                        <tr key={b.id} className="hover:bg-gray-50 transition">
                                            <td className="p-4 text-gray-600">{formatDate(b.created_at)}</td>
                                            <td className="p-4">
                                                <div className="font-medium text-gray-900">{b.cliente_empresa || '—'}</div>
                                                <div className="text-xs text-gray-500">{b.cliente_nome}</div>
                                            </td>
                                            <td className="p-4 font-medium text-gray-900">{formatCurrency(b.valor_total)}</td>
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
                                                    <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                                        V{b.payload.version}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => setSelectedBudget(b)}
                                                        className="p-2 text-gray-500 hover:text-[#0071b4] hover:bg-blue-50 rounded-lg transition"
                                                        title="Ver Detalhes">
                                                        <Eye size={18} />
                                                    </button>
                                                    <button onClick={() => handleEditBudget(b)}
                                                        className="p-2 text-gray-500 hover:text-[#0071b4] hover:bg-blue-50 rounded-lg transition"
                                                        title="Editar Orçamento">
                                                        <Pencil size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ====== Modal de Detalhes do Orçamento ====== */}
            {selectedBudget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-[#0071b4]">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Detalhes do Orçamento</h3>
                                    <p className="text-sm text-gray-500">
                                        {formatDate(selectedBudget.created_at)} &bull; {selectedBudget.cliente_empresa}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedBudget(null)} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-lg hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-4 rounded-xl">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">Cliente</p>
                                    <p className="font-medium text-gray-900">{selectedBudget.cliente_empresa}</p>
                                    <p className="text-sm text-gray-600">{selectedBudget.cliente_nome}</p>
                                    <p className="text-sm text-gray-600">{selectedBudget.cliente_cnpj}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl">
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-2">Valores</p>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Subtotal:</span>
                                        <span>{formatCurrency(selectedBudget.payload?.valores?.subtotal || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Impostos:</span>
                                        <span>{formatCurrency((selectedBudget.payload?.valores?.icms || 0) + (selectedBudget.payload?.valores?.ipi || 0))}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200 mt-2">
                                        <span>Total:</span>
                                        <span className="text-[#0071b4]">{formatCurrency(selectedBudget.valor_total)}</span>
                                    </div>
                                </div>
                            </div>

                            <h4 className="font-bold text-gray-900 mb-3">Itens do Orçamento</h4>
                            <div className="border border-gray-100 rounded-xl overflow-hidden">
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
                                                <td className="p-3 font-medium text-gray-900">{item.nome}</td>
                                                <td className="p-3 text-center">{item.quantidade} {item.unidade}</td>
                                                <td className="p-3 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                            <button onClick={() => setSelectedBudget(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition">
                                Fechar
                            </button>
                            <button onClick={() => { setSelectedBudget(null); handleEditBudget(selectedBudget) }}
                                className="px-4 py-2 text-sm font-medium text-white bg-[#0071b4] rounded-lg hover:bg-[#005a91] transition flex items-center gap-2">
                                <Pencil size={14} />
                                Editar Orçamento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
