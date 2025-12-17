import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { Trash2, Plus, Search, Loader2, CheckCircle, AlertCircle, LogOut, XCircle, User, ChevronDown } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

// --------------------------------------------------
// Helpers de formatação
// --------------------------------------------------
function formatarCNPJ(valor) {
  const nums = String(valor || '').replace(/\D/g, '').slice(0, 14)
  const p1 = nums.slice(0, 2), p2 = nums.slice(2, 5), p3 = nums.slice(5, 8), p4 = nums.slice(8, 12), p5 = nums.slice(12, 14)
  let out = p1
  if (p2) out += '.' + p2
  if (p3) out += '.' + p3
  if (p4) out += '/' + p4
  if (p5) out += '-' + p5
  return out
}

function formatarTelefone(valor) {
  const nums = String(valor || '').replace(/\D/g, '').slice(0, 11)
  const ddd = nums.slice(0, 2), parte1 = nums.slice(2, 7), parte2 = nums.slice(7, 11)
  if (nums.length <= 2) return ddd ? `(${ddd}` : ''
  if (nums.length <= 7) return `(${ddd})${parte1}`
  return `(${ddd})${parte1}-${parte2}`
}
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']

// --------------------------------------------------
// Toast leve (sem libs)
// --------------------------------------------------
function useToast() {
  const [toasts, setToasts] = useState([])
  const showToast = (message, variant = 'default', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, variant }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration)
  }
  const ToastHost = () => (
    <div className="fixed z-[100] top-4 right-4 space-y-2">
      {toasts.map((t) => (
        <div key={t.id}
          className={`flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg border text-sm max-w-[320px] bg-white
             ${t.variant === 'success' ? 'border-green-300' : t.variant === 'error' ? 'border-red-300' : 'border-gray-200'}`}>
          {t.variant === 'error' ? <XCircle className="mt-0.5 text-red-500" size={18} /> : null}
          <span className="text-gray-800">{t.message}</span>
        </div>
      ))}
    </div>
  )
  return { showToast, ToastHost }
}

// --------------------------------------------------
// Validação
// --------------------------------------------------
const isEmpty = (v) => v === null || v === undefined || String(v).trim() === ''
const onlyDigits = (v) => String(v || '').replace(/\D/g, '')
function isValidEmail(email) {
  if (isEmpty(email)) return false
  const s = String(email).trim()
  if (/\s/.test(s)) return false
  if (s.includes('..')) return false
  if (s.startsWith('@') || s.endsWith('@')) return false
  if (s.includes('@.') || s.includes('.@')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)
}

// num safe
const n = (v, d = 0) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : d
}

// --------------------------------------------------
// Componente principal
// --------------------------------------------------
export default function OrcamentoMultivac() {
  const N8N_GATEWAY_URL = (import.meta.env.VITE_N8N_GATEWAY_URL || '').trim()
  const LOGO_URL = 'https://i.postimg.cc/13BWhCY0/Multivac-Horizontal-Branco.png'
  const TABLE_CLIENTES = 'clientes' // <-- tabela no Supabase

  const navigate = useNavigate()
  const location = useLocation()
  const { showToast, ToastHost } = useToast()

  // Edição
  const [editMode, setEditMode] = useState(false)
  const [budgetToUpdate, setBudgetToUpdate] = useState(null)
  // Versionamento
  const [version, setVersion] = useState(1)

  // Estados
  const [representante, setRepresentante] = useState('')
  const [cliente, setCliente] = useState({
    nome: '', empresa: '', cnpj: '', inscricaoEstadual: '', isentoIE: false,
    email: '', emailCobranca: '', telefone: '', cidade: '', estado: '', tipoVenda: 'consumidor-final'
  })

  // inclui unidade e ipi (default) no item
  const [itens, setItens] = useState([
    { id: 1, codigo: '', nome: '', quantidade: 1, precoUnitario: 0, multiplo: 1, unidade: 'UN', ipi: 0 }
  ])

  const [comercial, setComercial] = useState({
    validade: '', formaPagamento: '28/56 dias', formaPagamentoDetalhe: '', prazoEntrega: '',
    frete: 'FOB', transportadora: '',
    observacoes: 'Frete FOB\nFaturamento sujeito à análise de crédito\nValidade de 7 dias\nOs valores podem sofrer alteração devido à legislação de cada estado\nST: caso aplicável, será passado posteriormente'
  })
  const [icms, setIcms] = useState('')    // %
  const [desconto, setDesconto] = useState(0) // %

  // Produtos/autocomplete
  const [produtos, setProdutos] = useState([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(true)
  const [erroProdutos, setErroProdutos] = useState(false)

  // busca digitada por item (string que aparece no input)
  const [buscasItens, setBuscasItens] = useState({})
  const [dropdownAberto, setDropdownAberto] = useState(null)

  // Busca cliente
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [statusBuscaCliente, setStatusBuscaCliente] = useState(null)

  // Popover de confirmação/sucesso
  const [showConfirm, setShowConfirm] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [respostaN8n, setRespostaN8n] = useState(null)

  // Header Menu
  const [menuOpen, setMenuOpen] = useState(false)

  // First Access / Setup Modal
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [setupName, setSetupName] = useState('')
  const [setupPassword, setSetupPassword] = useState('')
  const [setupConfirm, setSetupConfirm] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)

  // Validação (erros)
  const [errors, setErrors] = useState({})
  const hasErr = (sec, key) => !!errors?.[sec]?.[key]
  const setFieldError = (sec, key, val) =>
    setErrors((prev) => ({ ...prev, [sec]: { ...(prev[sec] || {}), [key]: val || undefined } }))

  // Refs
  const refs = {
    cnpj: useRef(null), nome: useRef(null), empresa: useRef(null), email: useRef(null),
    telefone: useRef(null), cidade: useRef(null), estado: useRef(null), inscricaoEstadual: useRef(null),
    tipoVenda: useRef(null), formaPagamento: useRef(null), prazoEntrega: useRef(null),
    frete: useRef(null), transportadora: useRef(null), icms: useRef(null), desconto: useRef(null),
    frete: useRef(null), transportadora: useRef(null), icms: useRef(null), desconto: useRef(null),
    emailCobranca: useRef(null), formaPagamentoDetalhe: useRef(null),
  }
  const itemRefs = useRef({})
  const gerarBtnRef = useRef(null)
  const debounceRef = useRef(null)

  // Popover position
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, placement: 'bottom' })
  const POPOVER_WIDTH = 420
  const POPOVER_MARGIN = 12
  const computePopoverPos = useCallback(() => {
    const btn = gerarBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    const estimatedHeight = 360
    let left = Math.min(Math.max(16, rect.left - (POPOVER_WIDTH - rect.width)), Math.max(16, vw - POPOVER_WIDTH - 16))
    let top = rect.bottom + POPOVER_MARGIN
    let placement = 'bottom'
    if (top + estimatedHeight > vh - 16) {
      top = Math.max(16, rect.top - estimatedHeight - POPOVER_MARGIN)
      placement = 'top'
    }
    setPopoverPos({ top, left, placement })
  }, [])
  useLayoutEffect(() => { if (showConfirm) computePopoverPos() }, [showConfirm, computePopoverPos])
  useEffect(() => {
    if (!showConfirm) return
    const onScroll = () => computePopoverPos()
    const onResize = () => computePopoverPos()
    const onKey = (e) => { if (e.key === 'Escape') fecharPopover() }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey) }
  }, [showConfirm, computePopoverPos])
  // Auth + nome user
  useEffect(() => {
    ; (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return navigate('/', { replace: true })
      const user = session.user
      const nome = user.user_metadata?.full_name || user.user_metadata?.name

      if (nome) {
        setRepresentante(nome)
      } else {
        // Se não tem nome, força o setup
        setRepresentante(user.email.split('@')[0]) // fallback visual
        setShowSetupModal(true)
      }
    })()
  }, [navigate])

  // Validade automática helper
  const calcularValidadePadrao = () => {
    const agora = new Date()
    const base = new Date(agora)
    if (agora.getHours() >= 17) base.setDate(base.getDate() + 1)
    const validade = new Date(base); validade.setDate(validade.getDate() + 7)
    return `${String(validade.getDate()).padStart(2, '0')}/${String(validade.getMonth() + 1).padStart(2, '0')}/${validade.getFullYear()}`
  }

  // Effect inicial
  useEffect(() => {
    setComercial((p) => ({ ...p, validade: calcularValidadePadrao() }))
  }, [])

  // Resetar formulário
  const resetForm = () => {
    // Resetar estados de dados
    setCliente({
      nome: '', empresa: '', cnpj: '', inscricaoEstadual: '', isentoIE: false,
      email: '', emailCobranca: '', telefone: '', cidade: '', estado: '', tipoVenda: 'consumidor-final'
    })
    setItens([{ id: Date.now(), codigo: '', nome: '', quantidade: 1, precoUnitario: 0, multiplo: 1, unidade: 'UN', ipi: 0 }])
    setComercial({
      validade: calcularValidadePadrao(),
      formaPagamento: '28/56 dias', formaPagamentoDetalhe: '', prazoEntrega: '',
      frete: 'FOB', transportadora: '',
      observacoes: 'Frete FOB\nFaturamento sujeito à análise de crédito\nValidade de 7 dias\nOs valores podem sofrer alteração devido à legislação de cada estado\nST: caso aplicável, será passado posteriormente'
    })
    setIcms('')
    setDesconto(0)

    // Resetar estados de controle
    setEditMode(false)
    setBudgetToUpdate(null)
    setVersion(1)
    setErrors({})
    setBuscasItens({})
    setDropdownAberto(null)

    // Limpar location state (sair do modo edição no router)
    navigate(location.pathname, { replace: true })

    // Fechar modais
    setShowConfirm(false)
    setRespostaN8n(null)
    setEnviando(false)
  }

  // Fechar popover com lógica de reset se sucesso
  const fecharPopover = () => {
    if (respostaN8n) {
      // Se tem resposta, foi sucesso -> Resetar
      resetForm()
    } else {
      // Se não, só fecha (cancelou ou algo assim)
      setShowConfirm(false)
      setRespostaN8n(null)
      setEnviando(false)
    }
  }

  // Logout
  const handleLogout = async () => {
    try { await supabase.auth.signOut(); navigate('/', { replace: true }) } catch (e) { console.error(e) }
  }

  // ---------- Client util: chamada ao gateway do n8n (para gerar proposta) ----------
  const callGateway = async (action, extraPayload = {}, { noPreflight = true } = {}) => {
    const body = { action, ...extraPayload }
    const headers = noPreflight
      ? { 'Content-Type': 'text/plain' }
      : { 'Content-Type': 'application/json' }

    const resp = await fetch(N8N_GATEWAY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const text = await resp.text()
    if (!resp.ok) throw new Error(text || `HTTP ${resp.status}`)
    try { return JSON.parse(text) } catch { return text }
  }

  // ---------- Setup Modal Submit ----------
  const handleSetupSubmit = async (e) => {
    e.preventDefault()
    if (!setupName.trim()) {
      showToast('O nome é obrigatório.', 'error')
      return
    }
    if (setupPassword && setupPassword !== setupConfirm) {
      showToast('As senhas não conferem.', 'error')
      return
    }
    if (setupPassword && setupPassword.length < 6) {
      showToast('A senha deve ter pelo menos 6 caracteres.', 'error')
      return
    }

    setSetupLoading(true)
    try {
      const payload = { data: { full_name: setupName } }
      if (setupPassword) payload.password = setupPassword

      const { error } = await supabase.auth.updateUser(payload)
      if (error) throw error

      setRepresentante(setupName)
      setShowSetupModal(false)
      showToast('Cadastro finalizado com sucesso!', 'success')
    } catch (err) {
      console.error(err)
      showToast('Erro ao salvar dados: ' + err.message, 'error')
    } finally {
      setSetupLoading(false)
    }
  }

  // ---------- Produtos (bootstrap via Supabase) ----------
  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        setCarregandoProdutos(true)
        setErroProdutos(false)

        const { data, error } = await supabase.from('lista_produtos').select('*')
        if (error) throw error

        const normalizados = (data || []).map(p => ({
          codigo: p.codigo || p.item || '',
          nome: p.nome || p.descricao || p.detalhe || '',
          preco: n(p.preco ?? p.vd_preco),
          multiplo: Math.max(1, parseInt(p.multiplo ?? p.qtd_min ?? p.qtdMin ?? 1) || 1),
          un: p.un || p.unidade || 'UN',
          ipi: n(p.ipi ?? p.al_ipi),
        }))
        setProdutos(normalizados)
      } catch (e) {
        console.error('Erro ao carregar produtos (bootstrap):', e)
        setErroProdutos(true)
      } finally {
        setCarregandoProdutos(false)
      }
    }
    carregarProdutos()
  }, [])

  // ---------- Carregar Dados para Edição ----------
  useEffect(() => {
    if (location.state?.editMode && location.state?.budgetData) {
      const { budgetData } = location.state
      const { payload } = budgetData

      setEditMode(true)
      setBudgetToUpdate(budgetData)

      if (payload.cliente) setCliente(payload.cliente)

      // Carregar versão atual ou default 1
      if (payload.version) setVersion(payload.version)

      if (payload.itens) {
        // Recriar IDs pois não são salvos no payload
        const mappedItens = payload.itens.map(i => ({
          ...i,
          id: Date.now() + Math.random(),
          multiplo: i.multiplo || 1,
          unidade: i.unidade || 'UN',
          ipi: i.ipi || 0,
          precoUnitario: i.precoUnitario || 0,
          quantidade: i.quantidade || 1
        }))
        setItens(mappedItens)
        // Refs serão criados no render
      }

      if (payload.comercial) setComercial(payload.comercial)

      // Ajuste para lidar com 0
      if (payload.icms !== undefined) setIcms(payload.icms)
      if (payload.desconto !== undefined) setDesconto(payload.desconto)
    }
  }, [location.state])

  // ---------- Map row -> cliente ----------

  // ---------- Busca CNPJ direto no Supabase (robusta p/ CNPJ maiúsculo) ----------
  const buscarClientePorCNPJ = async (cnpjDigitado) => {
    const limpo = String(cnpjDigitado || '').replace(/\D/g, '').slice(0, 14)
    if (limpo.length < 14) return
    const mascara = formatarCNPJ(limpo)

    try {
      setBuscandoCliente(true); setStatusBuscaCliente(null)

      // 1) tenta pelo cnpj_normalizado (sempre lowercase)
      const { data: d1, error: e1 } = await supabase
        .from('clientes')
        .select('*')
        .eq('cnpj_normalizado', limpo)
        .limit(1)

      if (e1) throw e1

      let row = (Array.isArray(d1) && d1[0]) || null

      // 2) se não achou, tenta pela coluna "CNPJ" (com maiúsculas)
      if (!row) {
        const { data: d2, error: e2 } = await supabase
          .from('clientes')
          .select('*')
          .eq('CNPJ', mascara)  // supabase-js faz a citação correta do identificador
          .limit(1)
        if (e2) throw e2
        row = (Array.isArray(d2) && d2[0]) || null
      }

      console.log('[buscarClientePorCNPJ] limpo=', limpo, 'mascara=', mascara, 'row=', row)

      if (row) {
        // mapeia campos prováveis
        const empresa =
          row.empresa_razao_social ?? row.razao_social ?? row['Empresa / Razão Social'] ?? row.empresa ?? row.Empresa ?? ''
        const nome = row.nome_contato ?? row.nome ?? row.contato ?? row['Nome do Contato'] ?? ''
        const telefone = row.telefone ?? row.fone ?? row['Telefone'] ?? ''
        const cidade = row.cidade ?? row['Cidade'] ?? ''
        const uf = row.uf ?? row.UF ?? row.estado ?? row['UF'] ?? ''
        const ie = row.inscricao_estadual ?? row.ie ?? row['Inscrição Estadual'] ?? ''
        const email = row.email ?? row['Email'] ?? row['E-mail'] ?? row['E_MAIL'] ?? ''

        const isIsento = String(ie || '').toUpperCase() === 'ISENTO'
        setCliente((p) => ({
          ...p,
          cnpj: formatarCNPJ(limpo),
          nome: nome || p.nome,
          empresa: empresa || p.empresa,
          email: email || p.email,
          telefone: telefone ? formatarTelefone(telefone) : p.telefone,
          cidade: cidade || p.cidade,
          estado: uf || p.estado,
          inscricaoEstadual: ie || (isIsento ? 'ISENTO' : p.inscricaoEstadual),
          isentoIE: isIsento,
          emailCobranca: email || p.emailCobranca || '', // Default to main email if found
        }))
        setStatusBuscaCliente('encontrado')
      } else {
        setStatusBuscaCliente('nao-encontrado')
        // opcional: feedback visível
        // showToast('Cliente não encontrado pelo CNPJ informado.', 'error')
      }
    } catch (e) {
      console.error('Erro ao buscar cliente por CNPJ:', e)
      setStatusBuscaCliente('nao-encontrado')
    } finally {
      setBuscandoCliente(false)
      setTimeout(() => setStatusBuscaCliente(null), 3000)
    }
  }

  // Debounce para evitar múltiplas chamadas
  useEffect(() => {
    const limpo = onlyDigits(cliente.cnpj)
    if (limpo.length !== 14) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscarClientePorCNPJ(limpo), 300)
    return () => clearTimeout(debounceRef.current)
  }, [cliente.cnpj])

  // ---------------------- Produtos/itens ----------------------
  const filtrarProdutosPorBusca = (itemId) => {
    const raw = String(buscasItens[itemId] || '').toLowerCase().trim()
    const termo = raw.includes(' - ') ? raw.split(' - ')[0].trim() : raw
    if (!raw) return produtos
    let arr = produtos.filter((p) =>
      p.codigo.toLowerCase().includes(termo) || p.nome.toLowerCase().includes(termo)
    )
    if (arr.length === 0) arr = produtos
    return arr
  }

  const atualizarBuscaItem = (itemId, valor) => {
    setBuscasItens((b) => ({ ...b, [itemId]: valor }))
    setDropdownAberto(itemId)
    setErrors((prev) => ({ ...prev, itens: { ...(prev.itens || {}), [itemId]: { ...(prev.itens?.[itemId] || {}), codigo: true } } }))
  }

  const adicionarItem = () => {
    const id = Date.now()
    setItens((arr) => [...arr, { id, codigo: '', nome: '', quantidade: 1, precoUnitario: 0, multiplo: 1, unidade: 'UN', ipi: 0 }])
    setBuscasItens((b) => ({ ...b, [id]: '' }))
    setDropdownAberto(id)
    itemRefs.current[id] = { produto: React.createRef(), quantidade: React.createRef() }
  }

  const removerItem = (id) => {
    setItens((arr) => (arr.length > 1 ? arr.filter((i) => i.id !== id) : arr))
    setBuscasItens((b) => { const n2 = { ...b }; delete n2[id]; return n2 })
    if (dropdownAberto === id) setDropdownAberto(null)
    setErrors((prev) => { const n3 = { ...(prev.itens || {}) }; delete n3[id]; return { ...prev, itens: n3 } })
    delete itemRefs.current[id]
  }

  const atualizarItem = (id, campo, valor) => {
    setItens((arr) => arr.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)))
    if (campo === 'quantidade') {
      const item = itens.find((i) => i.id === id) || {}
      const mult = item.multiplo || 1
      const ok = (parseInt(valor) || 0) > 0 && ((parseInt(valor) || 0) % mult === 0)
      setErrors((prev) => ({ ...prev, itens: { ...(prev.itens || {}), [id]: { ...(prev.itens?.[id] || {}), quantidade: !ok } } }))
    }
  }

  const selecionarProduto = (id, p) => {
    setItens((arr) =>
      arr.map((i) =>
        i.id === id
          ? {
            ...i,
            codigo: p.codigo,
            nome: p.nome,
            precoUnitario: n(p.preco),
            multiplo: Math.max(1, parseInt(p.multiplo ?? 1) || 1),
            quantidade: Math.max(1, parseInt(p.multiplo ?? 1) || 1),
            unidade: p.un || 'UN',
            ipi: n(p.ipi, 0),
          }
          : i
      )
    )
    setBuscasItens((b) => ({ ...b, [id]: `${p.codigo} - ${p.nome}` }))
    setDropdownAberto(null)
    setErrors((prev) => ({
      ...prev,
      itens: {
        ...(prev.itens || {}),
        [id]: { ...(prev.itens?.[id] || {}), codigo: false, quantidade: false }
      }
    }))
  }

  const validarMultiplo = (i) => (!i.codigo ? true : (n(i.quantidade) % n(i.multiplo, 1) === 0) && n(i.quantidade) > 0)

  // ---------------------- Totais ----------------------
  const itemSubtotal = (i) => n(i.quantidade) * n(i.precoUnitario)
  const itemIPI = (i) => itemSubtotal(i) * (n(i.ipi) / 100)

  const calcularSubtotal = () => itens.reduce((acc, i) => acc + itemSubtotal(i), 0)
  const calcularDesconto = () => calcularSubtotal() * (n(desconto) / 100)
  const calcularICMS = () => calcularSubtotal() * (n(icms) / 100)
  const calcularIPITotal = () => itens.reduce((acc, i) => acc + itemIPI(i), 0)

  const calcularTotal = () => {
    const sub = calcularSubtotal()
    const desc = calcularDesconto()
    const ic = calcularICMS()
    const ipiTot = calcularIPITotal()
    return n(sub - desc + ic + ipiTot, 0)
  }

  // ---------------- VALIDAÇÃO OBRIGATÓRIOS ----------------
  const validateForm = () => {
    const errs = { cliente: {}, comercial: {}, impostos: {}, itens: {} }

    if (isEmpty(cliente.cnpj) || onlyDigits(cliente.cnpj).length !== 14) errs.cliente.cnpj = true
    if (isEmpty(cliente.nome)) errs.cliente.nome = true
    if (isEmpty(cliente.empresa)) errs.cliente.empresa = true
    if (!isValidEmail(cliente.email)) errs.cliente.email = true
    if (!isValidEmail(cliente.emailCobranca)) errs.cliente.emailCobranca = true
    if (isEmpty(cliente.telefone) || onlyDigits(cliente.telefone).length < 10) errs.cliente.telefone = true
    if (isEmpty(cliente.cidade)) errs.cliente.cidade = true
    if (isEmpty(cliente.estado)) errs.cliente.estado = true
    if (!cliente.isentoIE && isEmpty(cliente.inscricaoEstadual)) errs.cliente.inscricaoEstadual = true
    if (isEmpty(cliente.tipoVenda)) errs.cliente.tipoVenda = true

    if (isEmpty(comercial.formaPagamento)) errs.comercial.formaPagamento = true
    if (comercial.formaPagamento === 'Outros' && isEmpty(comercial.formaPagamentoDetalhe)) errs.comercial.formaPagamentoDetalhe = true
    if (isEmpty(comercial.prazoEntrega)) errs.comercial.prazoEntrega = true
    if (isEmpty(comercial.frete)) errs.comercial.frete = true
    if (isEmpty(comercial.frete)) errs.comercial.frete = true
    if (comercial.frete === 'Transportadora' && isEmpty(comercial.transportadora)) errs.comercial.transportadora = true
    if (comercial.frete === 'Outros' && isEmpty(comercial.transportadora)) errs.comercial.transportadora = true // Reusing transportadora field for "Outros" details

    const icmsNum = parseFloat(icms)
    if (isNaN(icmsNum) || icms === '') errs.impostos.icms = true

    itens.forEach((i) => {
      const iErr = {}
      if (isEmpty(i.codigo)) iErr.codigo = true
      if (!validarMultiplo(i)) iErr.quantidade = true
      if (Object.keys(iErr).length) errs.itens[i.id] = iErr
    })

    setErrors(errs)
    const hasErrors = Object.values(errs.cliente).length || Object.values(errs.comercial).length || Object.values(errs.impostos).length || Object.values(errs.itens).length
    if (hasErrors) {
      showToast('Preencha os campos obrigatórios destacados antes de gerar o orçamento.', 'error')
      const order = [
        ['cliente', 'cnpj', refs.cnpj], ['cliente', 'nome', refs.nome], ['cliente', 'empresa', refs.empresa],
        ['cliente', 'email', refs.email], ['cliente', 'emailCobranca', refs.emailCobranca],
        ['cliente', 'telefone', refs.telefone], ['cliente', 'cidade', refs.cidade],
        ['cliente', 'estado', refs.estado], ['cliente', 'inscricaoEstadual', refs.inscricaoEstadual],
        ['cliente', 'tipoVenda', refs.tipoVenda], ['comercial', 'formaPagamento', refs.formaPagamento],
        ['comercial', 'prazoEntrega', refs.prazoEntrega], ['comercial', 'frete', refs.frete],
        ['comercial', 'transportadora', refs.transportadora], ['impostos', 'icms', refs.icms]
      ]
      for (const [sec, key, r] of order) {
        if (errs?.[sec]?.[key] && r?.current) { r.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); r.current.focus?.(); break }
      }
      const itemComErro = Object.keys(errs.itens)[0]
      if (itemComErro) {
        const refSet = itemRefs.current[itemComErro]
        const qual = errs.itens[itemComErro].codigo ? refSet?.produto : refSet?.quantidade
        qual?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        qual?.current?.focus?.()
      }
      return false
    }
    return true
  }

  const inputErrClass = (sec, key) =>
    `w-full border ${hasErr(sec, key) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-[#0071b4]'} rounded px-4 py-2 focus:outline-none focus:ring-2`

  const confirmarGerarOrcamento = () => {
    const temErroMultiplo = itens.some((i) => !validarMultiplo(i))
    if (temErroMultiplo) {
      showToast('Corrija as quantidades (múltiplos inválidos) antes de gerar o orçamento.', 'error')
      return
    }
    if (!validateForm()) return
    setShowConfirm(true); setRespostaN8n(null)
  }

  const gerarOrcamento = async () => {
    let obsAdicionais = ''
    if (comercial.formaPagamento === 'Outros' && comercial.formaPagamentoDetalhe) {
      obsAdicionais += `\nForma de Pagamento: ${comercial.formaPagamentoDetalhe}`
    }
    if (comercial.frete === 'Transportadora' && comercial.transportadora) {
      obsAdicionais += `\nTransportadora: ${comercial.transportadora}`
    } else if (comercial.frete === 'Outros' && comercial.transportadora) {
      obsAdicionais += `\nFrete (Detalhes): ${comercial.transportadora}`
    }

    // Calcular nova versão
    const currentVer = editMode ? (version || 1) : 0
    const nextVer = currentVer + 1

    const payload = {
      isEdited: editMode,
      version: nextVer,
      versaoLabel: nextVer > 1 ? `V${nextVer}` : '',
      representante,
      cliente,
      itens: itens.map(i => ({
        codigo: i.codigo,
        nome: i.nome,
        quantidade: n(i.quantidade, 1),
        precoUnitario: n(i.precoUnitario, 0),
        multiplo: n(i.multiplo, 1),
        unidade: i.unidade ?? i.un ?? 'UN',
        ipi: n(i.ipi, 0),
        subtotal: itemSubtotal(i),
        ipiValor: itemIPI(i),
      })),
      comercial: {
        ...comercial,
        observacoes: (comercial.observacoes || '') + obsAdicionais,
        formaPagamento: comercial.formaPagamento,
        icms: n(icms, 0),
        desconto: n(desconto, 0)
      },
      icms: n(icms, 0),
      desconto: n(desconto, 0),
      valores: {
        subtotal: calcularSubtotal(),
        desconto: calcularDesconto(),
        icms: calcularICMS(),
        ipi: calcularIPITotal(),
        total: calcularTotal()
      }
    }

    try {
      setEnviando(true); setRespostaN8n(null)


      // 1. Salvar no Supabase (histórico)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Sempre criar um novo registro no histórico para manter o versionamento (V1, V2...)
        const { error: errSupabase } = await supabase.from('orcamentos').insert({
          user_id: user.id,
          cliente_nome: cliente.nome,
          cliente_empresa: cliente.empresa,
          cliente_cnpj: cliente.cnpj,
          valor_total: payload.valores.total,
          status: 'gerado', // status inicial
          payload: payload
        })

        if (errSupabase) {
          console.error('Erro ao salvar histórico:', errSupabase)
          // Opcional: mostrar toast de erro específico do banco, mas não impedir o envio pro n8n se for o caso
          // showToast('Erro ao salvar no histórico', 'error')
        }
      }

      // 2. Chamar N8N
      const data = await callGateway('proposta', payload, { noPreflight: true })
      setRespostaN8n(data)
      showToast('Orçamento gerado com sucesso!', 'success')
    } catch (e) {
      console.error(e); showToast('Erro ao gerar orçamento no servidor. Tente novamente.', 'error')
    } finally { setEnviando(false) }
  }

  // UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white relative">
      <ToastHost />

      {/* Setup User Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-[#0071b4] mx-auto mb-4">
                <User size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Bem-vindo(a)!</h2>
              <p className="text-gray-600 mt-2">Para começar, precisamos finalizar seu cadastro.</p>
            </div>

            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0071b4] outline-none"
                  placeholder="Seu nome"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha <span className="text-gray-400 font-normal">(Opcional)</span></label>
                <input
                  type="password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0071b4] outline-none"
                  placeholder="Defina uma senha pessoal"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                />
              </div>
              {setupPassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
                  <input
                    type="password"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#0071b4] outline-none"
                    placeholder="Repita a senha"
                    value={setupConfirm}
                    onChange={(e) => setSetupConfirm(e.target.value)}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={setupLoading}
                className="w-full bg-[#0071b4] text-white py-3 rounded-lg font-semibold hover:bg-[#005f9e] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {setupLoading ? <Loader2 className="animate-spin" /> : 'Salvar e Continuar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-white p-4 shadow-lg" style={{ background: 'linear-gradient(to right, #29a3da, #0071b4)' }}>
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Multivac" className="h-10 object-contain" />
            <p className="text-sm opacity-90">Sistema de Orçamentos</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right relative">
              <p className="text-sm opacity-90">Representante</p>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 hover:opacity-80 focus:outline-none"
              >
                <User size={16} />
                <span className="font-semibold">{representante || '—'}</span>
                <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-20 text-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => navigate('/perfil')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <User size={16} className="text-[#0071b4]" />
                      Meu Perfil
                    </button>
                    <div className="h-px bg-gray-100 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <LogOut size={16} />
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-white shadow-lg rounded-lg p-8">
          {/* Dados do Cliente */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 border-b-2 pb-2" style={{ borderColor: '#0071b4' }}>Dados do Cliente</h2>

            {/* CNPJ — linha inteira */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2 font-medium">CNPJ *</label>
              <div className="relative">
                <input
                  ref={refs.cnpj}
                  type="text"
                  placeholder="Digite o CNPJ"
                  value={cliente.cnpj}
                  onChange={(e) => {
                    setCliente({ ...cliente, cnpj: formatarCNPJ(e.target.value) })
                    setFieldError('cliente', 'cnpj', false)
                  }}
                  onBlur={(e) => buscarClientePorCNPJ(e.target.value)}
                  className={`${inputErrClass('cliente', 'cnpj')} pr-10`}
                  aria-invalid={hasErr('cliente', 'cnpj') || undefined}
                />
                {buscandoCliente && <Loader2 className="absolute right-3 top-3 animate-spin text-[#0071b4]" size={20} />}
                {statusBuscaCliente === 'encontrado' && <CheckCircle className="absolute right-3 top-3 text-green-500" size={20} />}
                {statusBuscaCliente === 'nao-encontrado' && <AlertCircle className="absolute right-3 top-3 text-yellow-500" size={20} />}
              </div>
              {hasErr('cliente', 'cnpj') && <p className="text-red-600 text-xs mt-1">Informe um CNPJ válido (14 dígitos).</p>}
            </div>

            {/* Dados gerais do cliente */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                ref={refs.nome}
                type="text"
                placeholder="Nome do Contato *"
                value={cliente.nome}
                onChange={(e) => { setCliente({ ...cliente, nome: e.target.value }); setFieldError('cliente', 'nome', !e.target.value.trim()) }}
                className={inputErrClass('cliente', 'nome')}
                aria-invalid={hasErr('cliente', 'nome') || undefined}
              />
              <input
                ref={refs.empresa}
                type="text"
                placeholder="Razão Social / Empresa *"
                value={cliente.empresa}
                onChange={(e) => { setCliente({ ...cliente, empresa: e.target.value }); setFieldError('cliente', 'empresa', !e.target.value.trim()) }}
                className={inputErrClass('cliente', 'empresa')}
                aria-invalid={hasErr('cliente', 'empresa') || undefined}
              />

              <div>
                <input
                  ref={refs.email}
                  type="email"
                  placeholder="Email *"
                  value={cliente.email}
                  onChange={(e) => {
                    const val = e.target.value
                    setCliente({ ...cliente, email: val })
                    setFieldError('cliente', 'email', !isValidEmail(val))
                  }}
                  className={inputErrClass('cliente', 'email')}
                  aria-invalid={hasErr('cliente', 'email') || undefined}
                />
                {cliente.email && !isValidEmail(cliente.email) && (
                  <p className="text-red-600 text-xs mt-1">
                    Informe um e-mail válido (ex.: nome@dominio.com).
                  </p>
                )}
              </div>



              <input
                ref={refs.telefone}
                type="tel"
                placeholder="Telefone *"
                value={cliente.telefone}
                onChange={(e) => {
                  const v = formatarTelefone(e.target.value)
                  setCliente({ ...cliente, telefone: v })
                  setFieldError('cliente', 'telefone', onlyDigits(v).length < 10)
                }}
                className={inputErrClass('cliente', 'telefone')}
                aria-invalid={hasErr('cliente', 'telefone') || undefined}
              />

              <input
                ref={refs.cidade}
                type="text"
                placeholder="Cidade *"
                value={cliente.cidade}
                onChange={(e) => { setCliente({ ...cliente, cidade: e.target.value }); setFieldError('cliente', 'cidade', !e.target.value.trim()) }}
                className={inputErrClass('cliente', 'cidade')}
                aria-invalid={hasErr('cliente', 'cidade') || undefined}
              />
              <select
                ref={refs.estado}
                value={cliente.estado}
                onChange={(e) => { setCliente({ ...cliente, estado: e.target.value }); setFieldError('cliente', 'estado', !e.target.value) }}
                className={inputErrClass('cliente', 'estado')}
                aria-invalid={hasErr('cliente', 'estado') || undefined}
              >
                <option value="">UF *</option>
                {UFS.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
              </select>

              <div className="relative md:col-span-2">
                <input
                  ref={refs.emailCobranca}
                  type="email"
                  placeholder="Email para Nota Fiscal *"
                  value={cliente.emailCobranca}
                  onChange={(e) => {
                    const val = e.target.value
                    setCliente({ ...cliente, emailCobranca: val })
                    setFieldError('cliente', 'emailCobranca', !isValidEmail(val))
                  }}
                  className={inputErrClass('cliente', 'emailCobranca')}
                  aria-invalid={hasErr('cliente', 'emailCobranca') || undefined}
                />
                {cliente.emailCobranca && !isValidEmail(cliente.emailCobranca) && (
                  <p className="text-red-600 text-xs mt-1">
                    Informe um e-mail válido.
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cliente.email === cliente.emailCobranca && !!cliente.email}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setCliente({ ...cliente, emailCobranca: cliente.email })
                      setFieldError('cliente', 'emailCobranca', !isValidEmail(cliente.email))
                    } else {
                      setCliente({ ...cliente, emailCobranca: '' })
                    }
                  }}
                  className="w-4 h-4 accent-[#0071b4]"
                />
                <span className="text-gray-700">Mesmo do contato</span>
              </label>

              <div className="relative md:col-span-2">
                <input
                  ref={refs.inscricaoEstadual}
                  type="text"
                  placeholder={cliente.isentoIE ? 'ISENTO' : 'Inscrição Estadual *'}
                  value={cliente.inscricaoEstadual}
                  onChange={(e) => {
                    const v = e.target.value
                    setCliente({ ...cliente, inscricaoEstadual: v })
                    if (!cliente.isentoIE) setFieldError('cliente', 'inscricaoEstadual', !v.trim())
                  }}
                  disabled={cliente.isentoIE}
                  className={inputErrClass('cliente', 'inscricaoEstadual') + ' disabled:bg-gray-100'}
                  aria-invalid={(!cliente.isentoIE && hasErr('cliente', 'inscricaoEstadual')) || undefined}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cliente.isentoIE}
                  onChange={(e) => {
                    const isento = e.target.checked
                    setCliente({ ...cliente, isentoIE: isento, inscricaoEstadual: isento ? 'ISENTO' : '' })
                    if (isento) setFieldError('cliente', 'inscricaoEstadual', false)
                  }}
                  className="w-4 h-4 accent-[#0071b4]"
                />
                <span className="text-gray-700">Isento de IE</span>
              </label>
            </div>

            <div className="mt-4">
              <label className="block text-gray-700 mb-2 font-medium">Tipo de Venda *</label>
              <select
                ref={refs.tipoVenda}
                value={cliente.tipoVenda}
                onChange={(e) => { setCliente({ ...cliente, tipoVenda: e.target.value }); setFieldError('cliente', 'tipoVenda', !e.target.value) }}
                className="w-full md:w-1/2 border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071b4]"
                aria-invalid={hasErr('cliente', 'tipoVenda') || undefined}
              >
                <option value="consumidor-final">Consumidor Final</option>
                <option value="revenda">Revenda</option>
                <option value="uso-consumo">Uso e Consumo (Não Contribuinte)</option>
              </select>
            </div>
          </section>

          {/* Produtos */}
          <section className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-gray-800 border-b-2 pb-2" style={{ borderColor: '#0071b4' }}>Produtos *</h2>
              <button
                onClick={adicionarItem}
                disabled={carregandoProdutos}
                className="text-white px-4 py-2 rounded flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: '#0071b4' }}
              >
                <Plus size={20} /> Adicionar Item
              </button>
            </div>

            {carregandoProdutos && (
              <div className="text-center py-8">
                <Loader2 className="animate-spin mx-auto mb-2" size={32} style={{ color: '#0071b4' }} />
                <p className="text-gray-600">Carregando produtos...</p>
              </div>
            )}

            {erroProdutos && (
              <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                <p className="text-red-700">Erro ao carregar produtos. Tente recarregar a página.</p>
              </div>
            )}

            {!carregandoProdutos && !erroProdutos && (
              <div className="space-y-4">
                {itens.map((item, index) => {
                  const multiploValido = validarMultiplo(item)
                  const produtosFiltrados = filtrarProdutosPorBusca(item.id)
                  const mostrarDropdown = dropdownAberto === item.id && produtosFiltrados.length > 0
                  if (!itemRefs.current[item.id]) itemRefs.current[item.id] = { produto: React.createRef(), quantidade: React.createRef() }

                  const itemHasCodigoErr = !!errors?.itens?.[item.id]?.codigo
                  const itemHasQtdErr = !!errors?.itens?.[item.id]?.quantidade

                  return (
                    <div key={item.id}
                      className={`border rounded-lg p-4 ${(!multiploValido || itemHasCodigoErr || itemHasQtdErr) ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-semibold text-gray-700">Item {index + 1}</span>
                        {itens.length > 1 && (
                          <button onClick={() => removerItem(item.id)} className="text-red-500 hover:text-red-700 transition" aria-label="Remover item">
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Busca produto */}
                        <div className="md:col-span-2 relative autocomplete-container">
                          <label className="block text-gray-700 text-sm mb-1">Produto *</label>
                          <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-400 z-10" size={18} />
                            <input
                              ref={itemRefs.current[item.id].produto}
                              type="text"
                              placeholder="Digite código ou nome do produto..."
                              value={buscasItens[item.id] || ''}
                              onChange={(e) => atualizarBuscaItem(item.id, e.target.value)}
                              onFocus={() => setDropdownAberto(item.id)}
                              className={`w-full pl-10 pr-4 py-2 border rounded focus:outline-none focus:ring-2 ${itemHasCodigoErr ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-[#0071b4]'
                                }`}
                              aria-invalid={itemHasCodigoErr || undefined}
                            />
                          </div>

                          {mostrarDropdown && (
                            <div
                              className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {produtosFiltrados.map((p) => (
                                <button
                                  key={p.codigo}
                                  onClick={() => selecionarProduto(item.id, p)}
                                  className="w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 transition hover:opacity-90"
                                  style={{ backgroundColor: '#f0f9ff' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e6f4fa')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <span className="font-semibold" style={{ color: '#0071b4' }}>{p.codigo}</span>
                                      <span className="text-gray-700 ml-2">{p.nome}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-gray-600 font-medium">R$ {Number(n(p.preco)).toFixed(2)}</span>
                                      <div className="text-[11px] text-gray-500">
                                        {p.un && <span className="mr-2">Un: {p.un}</span>}
                                        {Number.isFinite(p.ipi) && <span>IPI: {Number(p.ipi).toString().replace('.', ',')}%</span>}
                                      </div>
                                    </div>
                                  </div>
                                  {p.multiplo > 1 && <span className="text-xs text-gray-500">Múltiplo de {p.multiplo}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                          {itemHasCodigoErr && <p className="text-red-600 text-xs mt-1">Selecione um produto.</p>}
                        </div>

                        {/* Quantidade */}
                        <div>
                          <label className="block text-gray-700 text-sm mb-1">
                            Quantidade * {item.multiplo > 1 && `(múltiplo de ${item.multiplo})`}
                          </label>
                          <input
                            ref={itemRefs.current[item.id].quantidade}
                            type="number"
                            value={item.quantidade}
                            onChange={(e) => atualizarItem(item.id, 'quantidade', parseInt(e.target.value) || 0)}
                            className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 ${(!multiploValido || itemHasQtdErr) ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-[#0071b4]'
                              }`}
                            min={item.multiplo}
                            step={item.multiplo}
                            disabled={!item.codigo}
                            aria-invalid={(!multiploValido || itemHasQtdErr) || undefined}
                          />
                          {(!multiploValido || itemHasQtdErr) && item.codigo && (
                            <p className="text-red-600 text-xs mt-1 font-semibold">⚠️ Deve ser múltiplo de {item.multiplo}</p>
                          )}
                        </div>
                      </div>

                      {item.codigo && (
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm bg-white p-3 rounded">
                          <div><span className="text-gray-600">Código:</span><span className="ml-2 font-medium">{item.codigo}</span></div>
                          <div><span className="text-gray-600">Preço Unit.:</span><span className="ml-2 font-medium">R$ {Number(n(item.precoUnitario)).toFixed(2)}</span></div>
                          <div><span className="text-gray-600">Unidade:</span><span className="ml-2 font-medium">{item.unidade || 'UN'}</span></div>
                          <div><span className="text-gray-600">IPI %:</span><span className="ml-2 font-medium">{Number(n(item.ipi)).toString().replace('.', ',')}</span></div>
                          <div><span className="text-gray-600">IPI (R$):</span><span className="ml-2 font-medium">R$ {itemIPI(item).toFixed(2)}</span></div>
                        </div>
                      )}

                      <div className="mt-3 text-right">
                        <span className="text-gray-600">Subtotal item: </span>
                        <span className="font-semibold text-lg">R$ {itemSubtotal(item).toFixed(2)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Impostos e Descontos */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 border-b-2 pb-2" style={{ borderColor: '#0071b4' }}>Impostos e Descontos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2 font-medium">ICMS (%) *</label>
                <select
                  ref={refs.icms}
                  value={icms}
                  onChange={(e) => { setIcms(e.target.value); setFieldError('impostos', 'icms', isEmpty(e.target.value)) }}
                  className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071b4]"
                  aria-invalid={hasErr('impostos', 'icms') || undefined}
                >
                  <option value="">Selecione...</option>
                  <option value="7">7%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                </select>
                {hasErr('impostos', 'icms') && <p className="text-red-600 text-xs mt-1">Informe o ICMS.</p>}
              </div>
              <div>
                <label className="block text-gray-700 mb-2 font-medium">Desconto (%) *</label>
                <select
                  ref={refs.desconto}
                  value={desconto}
                  onChange={(e) => setDesconto(parseFloat(e.target.value))}
                  className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071b4]"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((v) => (<option key={v} value={v}>{v}%</option>))}
                </select>
              </div>
            </div>
          </section>

          {/* Dados Comerciais */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 border-b-2 pb-2" style={{ borderColor: '#0071b4' }}>Dados Comerciais</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-gray-700 mb-2 font-medium">Validade da Proposta</label>
                <input type="text" value={comercial.validade} readOnly className="w-full border border-gray-300 rounded px-4 py-2 bg-gray-100 cursor-not-allowed" />
                <p className="text-xs text-gray-500 mt-1">Calculado automaticamente (7 dias)</p>
              </div>
              <div>
                <label className="block text-gray-700 mb-2 font-medium">Forma de Pagamento *</label>
                <select
                  ref={refs.formaPagamento}
                  value={comercial.formaPagamento}
                  onChange={(e) => { setComercial({ ...comercial, formaPagamento: e.target.value }); setFieldError('comercial', 'formaPagamento', !e.target.value) }}
                  className={inputErrClass('comercial', 'formaPagamento')}
                  aria-invalid={hasErr('comercial', 'formaPagamento') || undefined}
                >
                  <option value="À vista">À vista</option>
                  <option value="14 dias">14 dias</option>
                  <option value="28 dias">28 dias</option>
                  <option value="30 dias">30 dias</option>
                  <option value="45 dias">45 dias</option>
                  <option value="60 dias">60 dias</option>
                  <option value="28/56 dias">28/56 dias</option>
                  <option value="30/60 dias">30/60 dias</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {comercial.formaPagamento === 'Outros' && (
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Especifique a forma de pagamento *</label>
                  <input
                    ref={refs.formaPagamentoDetalhe}
                    type="text"
                    placeholder="Ex: 50% entrada + 50% na entrega"
                    value={comercial.formaPagamentoDetalhe}
                    onChange={(e) => { setComercial({ ...comercial, formaPagamentoDetalhe: e.target.value }); setFieldError('comercial', 'formaPagamentoDetalhe', !e.target.value.trim()) }}
                    className={inputErrClass('comercial', 'formaPagamentoDetalhe')}
                    aria-invalid={hasErr('comercial', 'formaPagamentoDetalhe') || undefined}
                  />
                  {hasErr('comercial', 'formaPagamentoDetalhe') && <p className="text-red-600 text-xs mt-1">Campo obrigatório.</p>}
                </div>
              )}

              <div>
                <label className="block text-gray-700 mb-2 font-medium">Prazo de Entrega *</label>
                <input
                  ref={refs.prazoEntrega}
                  type="text"
                  placeholder="Ex: 15 dias úteis"
                  value={comercial.prazoEntrega}
                  onChange={(e) => { setComercial({ ...comercial, prazoEntrega: e.target.value }); setFieldError('comercial', 'prazoEntrega', !e.target.value.trim()) }}
                  className={inputErrClass('comercial', 'prazoEntrega')}
                  aria-invalid={hasErr('comercial', 'prazoEntrega') || undefined}
                />
              </div>
            </div>



            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-gray-700 mb-2 font-medium">Frete *</label>
                <select
                  ref={refs.frete}
                  value={comercial.frete}
                  onChange={(e) => {
                    const v = e.target.value
                    setComercial({ ...comercial, frete: v, transportadora: (v !== 'Transportadora' && v !== 'Outros') ? '' : comercial.transportadora })
                    setFieldError('comercial', 'frete', !v)
                    if (v !== 'Transportadora' && v !== 'Outros') setFieldError('comercial', 'transportadora', false)
                  }}
                  className={inputErrClass('comercial', 'frete')}
                  aria-invalid={hasErr('comercial', 'frete') || undefined}
                >
                  <option value="FOB">FOB (por conta do cliente)</option>
                  <option value="Retira">Retira (cliente busca)</option>
                  <option value="Transportadora">Transportadora</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {(comercial.frete === 'Transportadora' || comercial.frete === 'Outros') && (
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">
                    {comercial.frete === 'Transportadora' ? 'Nome da Transportadora *' : 'Especifique o meio de envio *'}
                  </label>
                  <input
                    ref={refs.transportadora}
                    type="text"
                    placeholder={comercial.frete === 'Transportadora' ? "Nome da transportadora" : "Ex: Motoboy, Correios..."}
                    value={comercial.transportadora}
                    onChange={(e) => { setComercial({ ...comercial, transportadora: e.target.value }); setFieldError('comercial', 'transportadora', !e.target.value.trim()) }}
                    className={inputErrClass('comercial', 'transportadora')}
                    aria-invalid={hasErr('comercial', 'transportadora') || undefined}
                  />
                  {hasErr('comercial', 'transportadora') && <p className="text-red-600 text-xs mt-1">Campo obrigatório.</p>}
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-medium">Observações (opcional)</label>
              <textarea
                value={comercial.observacoes}
                onChange={(e) => setComercial({ ...comercial, observacoes: e.target.value })}
                rows="6"
                className="w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#0071b4]"
              />
            </div>
          </section>

          {/* Resumo Financeiro */}
          <section className="mb-8 p-6 rounded-lg border"
            style={{ background: 'linear-gradient(to bottom right, #e6f4fa, white)', borderColor: '#29a3da' }}>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Resumo Financeiro</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-lg">
                <span className="text-gray-700">Subtotal:</span>
                <span className="font-semibold">R$ {calcularSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg text-red-600">
                <span>Desconto ({n(desconto)}%):</span>
                <span className="font-semibold">- R$ {calcularDesconto().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg text-gray-800">
                <span>ICMS ({n(icms)}%):</span>
                <span className="font-semibold">+ R$ {calcularICMS().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg text-gray-800">
                <span>IPI (itens com IPI):</span>
                <span className="font-semibold">+ R$ {calcularIPITotal().toFixed(2)}</span>
              </div>
              <div className="border-t-2 pt-3 flex justify-between text-2xl" style={{ borderColor: '#29a3da' }}>
                <span className="text-gray-800 font-bold">Total:</span>
                <span className="font-bold" style={{ color: '#0071b4' }}>R$ {calcularTotal().toFixed(2)}</span>
              </div>
            </div>
          </section>

          {/* Botão Gerar */}
          <div className="flex justify-end">
            <button
              ref={gerarBtnRef}
              onClick={confirmarGerarOrcamento}
              className="text-white px-8 py-3 rounded-lg text-lg font-semibold transition shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#0071b4' }}
              disabled={enviando}
            >
              {editMode ? 'Salvar Alterações' : 'Gerar Orçamento'}
            </button>
          </div>
        </div>
      </div >

      {/* Overlay + Popover ancorado */}
      {
        showConfirm && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={fecharPopover} aria-hidden="true" />
            <div
              className="fixed z-50 w-[420px] max-w-[94vw] bg-white rounded-xl shadow-2xl border border-gray-200"
              style={{ top: popoverPos.top, left: popoverPos.left }}
              role="dialog"
              aria-modal="true"
            >
              {!respostaN8n ? (
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Confirmar envio</h3>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm mb-5">
                    <div className="flex justify-between"><span className="text-gray-600">Cliente:</span><span className="font-medium">{cliente.empresa || '—'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span className="font-medium">R$ {calcularSubtotal().toFixed(2)}</span></div>
                    <div className="flex justify-between text-red-600"><span>Desconto ({n(desconto)}%):</span><span className="font-semibold">- R$ {calcularDesconto().toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">ICMS ({n(icms)}%):</span><span className="font-medium">+ R$ {calcularICMS().toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">IPI:</span><span className="font-medium">+ R$ {calcularIPITotal().toFixed(2)}</span></div>
                    <div className="flex justify-between border-t pt-2 mt-2" style={{ borderColor: '#e5e7eb' }}>
                      <span className="text-gray-800 font-semibold">Total:</span>
                      <span className="font-bold text-[#0071b4]">R$ {calcularTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-2 text-gray-600">
                      <span>Representante:</span><span className="font-medium text-gray-800">{representante || '—'}</span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={fecharPopover} disabled={enviando}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition disabled:opacity-50">
                      Cancelar
                    </button>
                    <button onClick={gerarOrcamento} disabled={enviando}
                      className="px-4 py-2 rounded-lg font-semibold text-white shadow hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                      style={{ backgroundColor: '#0071b4' }}>
                      {enviando && <Loader2 className="animate-spin" size={18} />}
                      {enviando ? 'Enviando...' : (editMode ? 'Confirmar Edição' : 'Confirmar envio')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{editMode ? 'Orçamento Atualizado! 🎉' : 'Orçamento gerado! 🎉'}</h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 mb-5">
                    <p className="mb-1"><span className="text-gray-600">Número da proposta: </span><span className="font-semibold text-green-700">{respostaN8n.numeroProposta || '—'}</span></p>
                    <p className="mb-1"><span className="text-gray-600">Validade: </span><span className="font-semibold text-green-700">{respostaN8n.validade || comercial.validade || '—'}</span></p>
                    <p className="mb-1"><span className="text-gray-600">Total final: </span><span className="font-semibold text-green-700">R$ {respostaN8n.total ? Number(respostaN8n.total).toFixed(2) : calcularTotal().toFixed(2)}</span></p>
                    {respostaN8n.pdfUrl && (
                      <a href={respostaN8n.pdfUrl} target="_blank" rel="noopener noreferrer"
                        className="block mt-4 text-center font-semibold rounded-lg px-4 py-2 text-white"
                        style={{ backgroundColor: '#0071b4' }}>
                        Baixar PDF
                      </a>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={fecharPopover} className="px-4 py-2 rounded-lg font-semibold text-white shadow hover:opacity-90" style={{ backgroundColor: '#0071b4' }}>
                      Fechar
                    </button>
                  </div>
                </div>
              )}
              <div
                className={`absolute ${popoverPos.placement === 'bottom' ? '-top-2' : '-bottom-2'} right-6 w-0 h-0 border-l-8 border-r-8 ${popoverPos.placement === 'bottom'
                  ? 'border-b-8 border-b-white border-l-transparent border-r-transparent'
                  : 'border-t-8 border-t-white border-l-transparent border-r-transparent'
                  }`}
              />
            </div>
          </>
        )
      }
    </div >
  )
}