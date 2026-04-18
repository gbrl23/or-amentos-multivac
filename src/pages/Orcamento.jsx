import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { Trash2, Plus, Search, Loader2, CheckCircle, AlertCircle, XCircle, User, X } from 'lucide-react'
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
  const TABLE_CLIENTES = 'clientes'

  const navigate = useNavigate()
  const location = useLocation()
  const { showToast, ToastHost } = useToast()

  // Edição
  const [editMode, setEditMode] = useState(false)
  const [budgetToUpdate, setBudgetToUpdate] = useState(null)
  const [previousStatus, setPreviousStatus] = useState(null)
  const [version, setVersion] = useState(1)

  // Estados
  const [representante, setRepresentante] = useState('')
  const [representanteEmail, setRepresentanteEmail] = useState('')
  const [cliente, setCliente] = useState({
    nome: '', empresa: '', cnpj: '', inscricaoEstadual: '', isentoIE: false,
    email: '', emailCobranca: '', telefone: '', cidade: '', estado: '', tipoVenda: 'consumidor-final'
  })

  const [itens, setItens] = useState([
    { id: 1, codigo: '', nome: '', quantidade: 1, precoUnitario: 0, multiplo: 1, unidade: 'UN', ipi: 0 }
  ])

  const [comercial, setComercial] = useState({
    validade: '', formaPagamento: '28/56 dias', formaPagamentoDetalhe: '', prazoEntrega: '',
    frete: 'FOB', transportadora: '',
    observacoes: 'Frete FOB\nFaturamento sujeito à análise de crédito\nValidade de 7 dias\nOs valores podem sofrer alteração devido à legislação de cada estado\nST: caso aplicável, será passado posteriormente'
  })
  const [icms, setIcms] = useState('')
  const [desconto, setDesconto] = useState(0)

  // Produtos/autocomplete
  const [produtos, setProdutos] = useState([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(true)
  const [erroProdutos, setErroProdutos] = useState(false)

  const [buscasItens, setBuscasItens] = useState({})
  const [dropdownAberto, setDropdownAberto] = useState(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!dropdownAberto) return
    const handleClickOutside = (e) => {
      if (!e.target.closest('.autocomplete-container')) setDropdownAberto(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownAberto])

  // Busca cliente
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [statusBuscaCliente, setStatusBuscaCliente] = useState(null)

  // Popover de confirmação/sucesso
  const [showConfirm, setShowConfirm] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [respostaN8n, setRespostaN8n] = useState(null)

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

      setRepresentanteEmail(user.email ?? '')

      if (nome) {
        setRepresentante(nome)
      } else {
        setRepresentante(user.email.split('@')[0])
        setShowSetupModal(true)
      }
    })()
  }, [navigate])

  // Validade automática
  const calcularValidadePadrao = () => {
    const agora = new Date()
    const base = new Date(agora)
    if (agora.getHours() >= 17) base.setDate(base.getDate() + 1)
    const validade = new Date(base); validade.setDate(validade.getDate() + 7)
    return `${String(validade.getDate()).padStart(2, '0')}/${String(validade.getMonth() + 1).padStart(2, '0')}/${validade.getFullYear()}`
  }

  useEffect(() => {
    setComercial((p) => ({ ...p, validade: calcularValidadePadrao() }))
  }, [])

  // Resetar formulário
  const resetForm = () => {
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
    setEditMode(false)
    setBudgetToUpdate(null)
    setVersion(1)
    setErrors({})
    setBuscasItens({})
    setDropdownAberto(null)
    navigate(location.pathname, { replace: true })
    setShowConfirm(false)
    setRespostaN8n(null)
    setEnviando(false)
  }

  const fecharPopover = () => {
    if (respostaN8n) {
      resetForm()
    } else {
      setShowConfirm(false)
      setRespostaN8n(null)
      setEnviando(false)
    }
  }

  // ---------- Gateway n8n ----------
  const callGateway = async (action, extraPayload = {}, { noPreflight = true } = {}) => {
    const body = { action, ...extraPayload }
    const headers = noPreflight
      ? { 'Content-Type': 'text/plain' }
      : { 'Content-Type': 'application/json' }
    if (action === 'proposta') {
      headers['X-API-Key'] = 'mk-proposta-2026-xK9mP'
    }
    const resp = await fetch(N8N_GATEWAY_URL, { method: 'POST', headers, body: JSON.stringify(body) })
    const text = await resp.text()
    if (!resp.ok) throw new Error(text || `HTTP ${resp.status}`)
    try { return JSON.parse(text) } catch { return text }
  }

  // ---------- Setup Modal ----------
  const handleSetupSubmit = async (e) => {
    e.preventDefault()
    if (!setupName.trim()) { showToast('O nome é obrigatório.', 'error'); return }
    if (setupPassword && setupPassword !== setupConfirm) { showToast('As senhas não conferem.', 'error'); return }
    if (setupPassword && setupPassword.length < 6) { showToast('A senha deve ter pelo menos 6 caracteres.', 'error'); return }
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
    } finally { setSetupLoading(false) }
  }

  // ---------- Produtos ----------
  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        setCarregandoProdutos(true); setErroProdutos(false)
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
        console.error('Erro ao carregar produtos:', e)
        setErroProdutos(true)
      } finally { setCarregandoProdutos(false) }
    }
    carregarProdutos()
  }, [])

  // ---------- Edição ----------
  useEffect(() => {
    if (location.state?.editMode && location.state?.budgetData) {
      const { budgetData } = location.state
      const { payload } = budgetData
      setEditMode(true)
      setBudgetToUpdate(budgetData)
      setPreviousStatus(budgetData.status)
      if (payload.cliente) setCliente(payload.cliente)
      if (payload.version) setVersion(payload.version)
      if (payload.itens) {
        setItens(payload.itens.map(i => ({
          ...i, id: Date.now() + Math.random(),
          multiplo: i.multiplo || 1, unidade: i.unidade || 'UN',
          ipi: i.ipi || 0, precoUnitario: i.precoUnitario || 0, quantidade: i.quantidade || 1
        })))
      }
      if (payload.comercial) setComercial(payload.comercial)
      if (payload.icms !== undefined) setIcms(payload.icms)
      if (payload.desconto !== undefined) setDesconto(payload.desconto)
    }
  }, [location.state])

  // ---------- Busca CNPJ ----------
  const buscarClientePorCNPJ = async (cnpjDigitado) => {
    const limpo = String(cnpjDigitado || '').replace(/\D/g, '').slice(0, 14)
    if (limpo.length < 14) return
    const mascara = formatarCNPJ(limpo)
    try {
      setBuscandoCliente(true); setStatusBuscaCliente(null)
      const { data: d1, error: e1 } = await supabase.from('clientes').select('*').eq('cnpj_normalizado', limpo).limit(1)
      if (e1) throw e1
      let row = (Array.isArray(d1) && d1[0]) || null
      if (!row) {
        const { data: d2, error: e2 } = await supabase.from('clientes').select('*').eq('CNPJ', mascara).limit(1)
        if (e2) throw e2
        row = (Array.isArray(d2) && d2[0]) || null
      }
      if (row) {
        const empresa = row.empresa_razao_social ?? row.razao_social ?? row['Empresa / Razão Social'] ?? row.empresa ?? row.Empresa ?? ''
        const nome = row.nome_contato ?? row.nome ?? row.contato ?? row['Nome do Contato'] ?? ''
        const telefone = row.telefone ?? row.fone ?? row['Telefone'] ?? ''
        const cidade = row.cidade ?? row['Cidade'] ?? ''
        const uf = row.uf ?? row.UF ?? row.estado ?? row['UF'] ?? ''
        const ie = row.inscricao_estadual ?? row.ie ?? row['Inscrição Estadual'] ?? ''
        const email = row.email ?? row['Email'] ?? row['E-mail'] ?? row['E_MAIL'] ?? ''
        const isIsento = String(ie || '').toUpperCase() === 'ISENTO'
        setCliente((p) => ({
          ...p, cnpj: formatarCNPJ(limpo),
          nome: nome || p.nome, empresa: empresa || p.empresa, email: email || p.email,
          telefone: telefone ? formatarTelefone(telefone) : p.telefone,
          cidade: cidade || p.cidade, estado: uf || p.estado,
          inscricaoEstadual: ie || (isIsento ? 'ISENTO' : p.inscricaoEstadual),
          isentoIE: isIsento, emailCobranca: email || p.emailCobranca || '',
        }))
        setStatusBuscaCliente('encontrado')
      } else { setStatusBuscaCliente('nao-encontrado') }
    } catch (e) {
      console.error('Erro ao buscar cliente por CNPJ:', e)
      setStatusBuscaCliente('nao-encontrado')
    } finally {
      setBuscandoCliente(false)
      setTimeout(() => setStatusBuscaCliente(null), 3000)
    }
  }

  useEffect(() => {
    const limpo = onlyDigits(cliente.cnpj)
    if (limpo.length !== 14) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscarClientePorCNPJ(limpo), 300)
    return () => clearTimeout(debounceRef.current)
  }, [cliente.cnpj])

  // ---- Produtos/itens ----
  const filtrarProdutosPorBusca = (itemId) => {
    const raw = String(buscasItens[itemId] || '').toLowerCase().trim()
    const termo = raw.includes(' - ') ? raw.split(' - ')[0].trim() : raw
    if (!raw) return produtos
    let arr = produtos.filter((p) => p.codigo.toLowerCase().includes(termo) || p.nome.toLowerCase().includes(termo))
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
    setItens((arr) => arr.map((i) => i.id === id ? {
      ...i, codigo: p.codigo, nome: p.nome, precoUnitario: n(p.preco),
      multiplo: Math.max(1, parseInt(p.multiplo ?? 1) || 1),
      quantidade: Math.max(1, parseInt(p.multiplo ?? 1) || 1),
      unidade: p.un || 'UN', ipi: n(p.ipi, 0),
    } : i))
    setBuscasItens((b) => ({ ...b, [id]: `${p.codigo} - ${p.nome}` }))
    setDropdownAberto(null)
    setErrors((prev) => ({ ...prev, itens: { ...(prev.itens || {}), [id]: { ...(prev.itens?.[id] || {}), codigo: false, quantidade: false } } }))
  }

  const limparProduto = (id) => {
    setItens((arr) => arr.map((i) => i.id === id
      ? { ...i, codigo: '', nome: '', precoUnitario: 0, quantidade: 1, multiplo: 1, unidade: 'UN', ipi: 0 }
      : i
    ))
    setBuscasItens((b) => ({ ...b, [id]: '' }))
    setErrors((prev) => ({ ...prev, itens: { ...(prev.itens || {}), [id]: { ...(prev.itens?.[id] || {}), codigo: false, quantidade: false } } }))
  }

  const validarMultiplo = (i) => (!i.codigo ? true : (n(i.quantidade) % n(i.multiplo, 1) === 0) && n(i.quantidade) > 0)

  // ---- Totais ----
  const itemSubtotal = (i) => n(i.quantidade) * n(i.precoUnitario)
  const itemIPI = (i) => itemSubtotal(i) * (n(i.ipi) / 100)
  const calcularSubtotal = () => itens.reduce((acc, i) => acc + itemSubtotal(i), 0)
  const calcularDesconto = () => calcularSubtotal() * (n(desconto) / 100)
  const calcularICMS = () => calcularSubtotal() * (n(icms) / 100)
  const calcularIPITotal = () => itens.reduce((acc, i) => acc + itemIPI(i), 0)
  const calcularTotal = () => n(calcularSubtotal() - calcularDesconto() + calcularICMS() + calcularIPITotal(), 0)

  // ---- Validação ----
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
    if (comercial.frete === 'Transportadora' && isEmpty(comercial.transportadora)) errs.comercial.transportadora = true
    if (comercial.frete === 'Outros' && isEmpty(comercial.transportadora)) errs.comercial.transportadora = true
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

  const inputClass = (sec, key) =>
    `w-full border ${hasErr(sec, key) ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#0071b4]'} rounded-lg px-4 py-3 focus:outline-none focus:ring-2 transition`

  const confirmarGerarOrcamento = () => {
    if (itens.some((i) => !validarMultiplo(i))) {
      showToast('Corrija as quantidades (múltiplos inválidos) antes de gerar o orçamento.', 'error'); return
    }
    if (!validateForm()) return
    setShowConfirm(true); setRespostaN8n(null)
  }

  const gerarOrcamento = async () => {
    if (!N8N_GATEWAY_URL) {
      showToast('Erro de configuração: URL do servidor de orçamentos não encontrada.', 'error')
      return
    }
    let obsAdicionais = ''
    if (comercial.formaPagamento === 'Outros' && comercial.formaPagamentoDetalhe) obsAdicionais += `\nForma de Pagamento: ${comercial.formaPagamentoDetalhe}`
    if (comercial.frete === 'Transportadora' && comercial.transportadora) obsAdicionais += `\nTransportadora: ${comercial.transportadora}`
    else if (comercial.frete === 'Outros' && comercial.transportadora) obsAdicionais += `\nFrete (Detalhes): ${comercial.transportadora}`

    const currentVer = editMode ? (version || 1) : 0
    const shouldIncrement = previousStatus !== 'rascunho'
    const nextVer = shouldIncrement ? currentVer + 1 : currentVer

    const payload = {
      isEdited: editMode, version: nextVer, versaoLabel: nextVer > 1 ? `V${nextVer}` : '',
      representante, representanteEmail, cliente,
      itens: itens.map(i => ({
        codigo: i.codigo, nome: i.nome, quantidade: n(i.quantidade, 1),
        precoUnitario: n(i.precoUnitario, 0), multiplo: n(i.multiplo, 1),
        unidade: i.unidade ?? i.un ?? 'UN', ipi: n(i.ipi, 0),
        subtotal: itemSubtotal(i), ipiValor: itemIPI(i),
      })),
      comercial: { ...comercial, observacoes: (comercial.observacoes || '') + obsAdicionais, formaPagamento: comercial.formaPagamento, icms: n(icms, 0), desconto: n(desconto, 0) },
      icms: n(icms, 0), desconto: n(desconto, 0),
      valores: { subtotal: calcularSubtotal(), desconto: calcularDesconto(), icms: calcularICMS(), ipi: calcularIPITotal(), total: calcularTotal() }
    }

    let newBudgetId = null
    try {
      setEnviando(true); setRespostaN8n(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        let savedData, errSupabase
        if (editMode && previousStatus === 'erro' && budgetToUpdate?.id) {
          newBudgetId = budgetToUpdate.id
          const { data, error } = await supabase.from('orcamentos').update({
            user_id: user.id, cliente_nome: cliente.nome, cliente_empresa: cliente.empresa,
            cliente_cnpj: cliente.cnpj, valor_total: payload.valores.total,
            status: 'enviado', payload: payload, created_at: new Date().toISOString()
          }).eq('id', newBudgetId).select()
          savedData = data; errSupabase = error
        } else {
          const { data, error } = await supabase.from('orcamentos').insert({
            user_id: user.id, cliente_nome: cliente.nome, cliente_empresa: cliente.empresa,
            cliente_cnpj: cliente.cnpj, valor_total: payload.valores.total,
            status: 'enviado', payload: payload
          }).select()
          savedData = data; errSupabase = error
        }
        if (errSupabase) console.error('Erro ao salvar histórico:', errSupabase)
        else if (savedData && savedData[0]) newBudgetId = savedData[0].id
      }
      const data = await callGateway('proposta', payload, { noPreflight: true })
      setRespostaN8n(data)
      if (newBudgetId && data?.pdfUrl) {
        try { await supabase.from('orcamentos').update({ pdf_url: data.pdfUrl }).eq('id', newBudgetId) }
        catch (updateErr) { console.error('Falha ao salvar pdf_url:', updateErr) }
      }
      showToast('Orçamento gerado com sucesso!', 'success')
    } catch (e) {
      console.error(e)
      if (newBudgetId) {
        try { await supabase.from('orcamentos').update({ status: 'rascunho' }).eq('id', newBudgetId) }
        catch (updateErr) { console.error('Falha ao atualizar status para rascunho:', updateErr) }
      }
      const msg = e instanceof Error ? e.message : String(e)
      showToast(`Erro ao gerar orçamento: ${msg}`, 'error')
    } finally { setEnviando(false) }
  }

  // ===================== UI =====================
  return (
    <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8 animate-in fade-in duration-500 relative">
      <ToastHost />

      {/* Setup User Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-[#0071b4] mx-auto mb-4">
                <User size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Bem-vindo(a)!</h2>
              <p className="text-sm text-gray-500 mt-2">Para começar, precisamos finalizar seu cadastro.</p>
            </div>
            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo *</label>
                <input type="text" required className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071b4] outline-none transition" placeholder="Seu nome" value={setupName} onChange={(e) => setSetupName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nova Senha <span className="text-gray-400 font-normal">(Opcional)</span></label>
                <input type="password" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071b4] outline-none transition" placeholder="Defina uma senha pessoal" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} />
              </div>
              {setupPassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Senha</label>
                  <input type="password" className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0071b4] outline-none transition" placeholder="Repita a senha" value={setupConfirm} onChange={(e) => setSetupConfirm(e.target.value)} />
                </div>
              )}
              <button type="submit" disabled={setupLoading} className="w-full bg-[#0071b4] text-white py-3 rounded-lg font-semibold hover:bg-[#005a91] transition disabled:opacity-50 flex items-center justify-center gap-2">
                {setupLoading ? <Loader2 className="animate-spin" size={18} /> : 'Salvar e Continuar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit mode banner */}
      {editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#0071b4]">Modo de Edição</p>
            <p className="text-xs text-gray-500">Editando orçamento de {cliente.empresa || 'cliente'} {version > 1 ? `(V${version})` : ''}</p>
          </div>
          <button onClick={resetForm} className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-white transition">Cancelar</button>
        </div>
      )}

      {/* ====== Dados do Cliente ====== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Dados do Cliente</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">CNPJ *</label>
          <div className="relative">
            <input ref={refs.cnpj} type="text" placeholder="Digite o CNPJ" value={cliente.cnpj}
              onChange={(e) => { setCliente({ ...cliente, cnpj: formatarCNPJ(e.target.value) }); setFieldError('cliente', 'cnpj', false) }}
              onBlur={(e) => buscarClientePorCNPJ(e.target.value)}
              className={`${inputClass('cliente', 'cnpj')} pr-10`} aria-invalid={hasErr('cliente', 'cnpj') || undefined} />
            {buscandoCliente && <Loader2 className="absolute right-3 top-3 animate-spin text-[#0071b4]" size={18} />}
            {statusBuscaCliente === 'encontrado' && <CheckCircle className="absolute right-3 top-3 text-green-500" size={18} />}
            {statusBuscaCliente === 'nao-encontrado' && <AlertCircle className="absolute right-3 top-3 text-yellow-500" size={18} />}
          </div>
          {hasErr('cliente', 'cnpj') && <p className="text-red-500 text-xs mt-1">Informe um CNPJ válido (14 dígitos).</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Contato *</label>
            <input ref={refs.nome} type="text" placeholder="Nome do contato" value={cliente.nome}
              onChange={(e) => { setCliente({ ...cliente, nome: e.target.value }); setFieldError('cliente', 'nome', !e.target.value.trim()) }}
              className={inputClass('cliente', 'nome')} aria-invalid={hasErr('cliente', 'nome') || undefined} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Razão Social / Empresa *</label>
            <input ref={refs.empresa} type="text" placeholder="Razão social" value={cliente.empresa}
              onChange={(e) => { setCliente({ ...cliente, empresa: e.target.value }); setFieldError('cliente', 'empresa', !e.target.value.trim()) }}
              className={inputClass('cliente', 'empresa')} aria-invalid={hasErr('cliente', 'empresa') || undefined} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
            <input ref={refs.email} type="email" placeholder="email@empresa.com" value={cliente.email}
              onChange={(e) => { setCliente({ ...cliente, email: e.target.value }); setFieldError('cliente', 'email', !isValidEmail(e.target.value)) }}
              className={inputClass('cliente', 'email')} aria-invalid={hasErr('cliente', 'email') || undefined} />
            {cliente.email && !isValidEmail(cliente.email) && <p className="text-red-500 text-xs mt-1">Informe um e-mail válido.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Telefone *</label>
            <input ref={refs.telefone} type="tel" placeholder="(00)00000-0000" value={cliente.telefone}
              onChange={(e) => { const v = formatarTelefone(e.target.value); setCliente({ ...cliente, telefone: v }); setFieldError('cliente', 'telefone', onlyDigits(v).length < 10) }}
              className={inputClass('cliente', 'telefone')} aria-invalid={hasErr('cliente', 'telefone') || undefined} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cidade *</label>
            <input ref={refs.cidade} type="text" placeholder="Cidade" value={cliente.cidade}
              onChange={(e) => { setCliente({ ...cliente, cidade: e.target.value }); setFieldError('cliente', 'cidade', !e.target.value.trim()) }}
              className={inputClass('cliente', 'cidade')} aria-invalid={hasErr('cliente', 'cidade') || undefined} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">UF *</label>
            <select ref={refs.estado} value={cliente.estado}
              onChange={(e) => { setCliente({ ...cliente, estado: e.target.value }); setFieldError('cliente', 'estado', !e.target.value) }}
              className={inputClass('cliente', 'estado')} aria-invalid={hasErr('cliente', 'estado') || undefined}>
              <option value="">Selecione...</option>
              {UFS.map((uf) => (<option key={uf} value={uf}>{uf}</option>))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email para Nota Fiscal *</label>
            <input ref={refs.emailCobranca} type="email" placeholder="email-nf@empresa.com" value={cliente.emailCobranca}
              onChange={(e) => { setCliente({ ...cliente, emailCobranca: e.target.value }); setFieldError('cliente', 'emailCobranca', !isValidEmail(e.target.value)) }}
              className={inputClass('cliente', 'emailCobranca')} aria-invalid={hasErr('cliente', 'emailCobranca') || undefined} />
            {cliente.emailCobranca && !isValidEmail(cliente.emailCobranca) && <p className="text-red-500 text-xs mt-1">Informe um e-mail válido.</p>}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cliente.email === cliente.emailCobranca && !!cliente.email}
              onChange={(e) => { if (e.target.checked) { setCliente({ ...cliente, emailCobranca: cliente.email }); setFieldError('cliente', 'emailCobranca', !isValidEmail(cliente.email)) } else { setCliente({ ...cliente, emailCobranca: '' }) } }}
              className="w-4 h-4 accent-[#0071b4] rounded" />
            <span className="text-sm text-gray-600">Mesmo do contato</span>
          </label>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">{cliente.isentoIE ? 'Inscrição Estadual (ISENTO)' : 'Inscrição Estadual *'}</label>
            <input ref={refs.inscricaoEstadual} type="text" placeholder={cliente.isentoIE ? 'ISENTO' : 'Inscrição Estadual'} value={cliente.inscricaoEstadual}
              onChange={(e) => { setCliente({ ...cliente, inscricaoEstadual: e.target.value }); if (!cliente.isentoIE) setFieldError('cliente', 'inscricaoEstadual', !e.target.value.trim()) }}
              disabled={cliente.isentoIE} className={inputClass('cliente', 'inscricaoEstadual') + ' disabled:bg-gray-50 disabled:text-gray-400'}
              aria-invalid={(!cliente.isentoIE && hasErr('cliente', 'inscricaoEstadual')) || undefined} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={cliente.isentoIE}
              onChange={(e) => { const isento = e.target.checked; setCliente({ ...cliente, isentoIE: isento, inscricaoEstadual: isento ? 'ISENTO' : '' }); if (isento) setFieldError('cliente', 'inscricaoEstadual', false) }}
              className="w-4 h-4 accent-[#0071b4] rounded" />
            <span className="text-sm text-gray-600">Isento de IE</span>
          </label>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Venda *</label>
          <select ref={refs.tipoVenda} value={cliente.tipoVenda}
            onChange={(e) => { setCliente({ ...cliente, tipoVenda: e.target.value }); setFieldError('cliente', 'tipoVenda', !e.target.value) }}
            className={`${inputClass('cliente', 'tipoVenda')} md:w-1/2`} aria-invalid={hasErr('cliente', 'tipoVenda') || undefined}>
            <option value="consumidor-final">Consumidor Final</option>
            <option value="revenda">Revenda</option>
            <option value="uso-consumo">Uso e Consumo (Não Contribuinte)</option>
          </select>
        </div>
      </div>

      {/* ====== Produtos ====== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-gray-900">Produtos</h2>
          <button onClick={adicionarItem} disabled={carregandoProdutos}
            className="bg-[#0071b4] hover:bg-[#005a91] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
            <Plus size={16} /> Adicionar Item
          </button>
        </div>

        {carregandoProdutos && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="animate-spin text-[#0071b4] mb-2" size={32} />
            <p className="text-sm text-gray-500">Carregando produtos...</p>
          </div>
        )}

        {erroProdutos && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-700">Erro ao carregar produtos. Tente recarregar a página.</p>
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
                <div key={item.id} className={`rounded-xl p-4 border ${(!multiploValido || itemHasCodigoErr || itemHasQtdErr) ? 'border-red-200 bg-red-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-bold text-gray-700">Item {index + 1}</span>
                    {itens.length > 1 && (
                      <button onClick={() => removerItem(item.id)} className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600 font-medium transition px-2.5 py-1 rounded-lg hover:bg-red-50">
                        <Trash2 size={14} />
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 relative autocomplete-container">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Produto *</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400 z-10" size={16} />
                        <input ref={itemRefs.current[item.id].produto} type="text" placeholder="Digite código ou nome do produto..."
                          value={buscasItens[item.id] || ''} onChange={(e) => atualizarBuscaItem(item.id, e.target.value)} onFocus={() => setDropdownAberto(item.id)}
                          className={`w-full pl-10 ${item.codigo ? 'pr-9' : 'pr-4'} py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 transition ${itemHasCodigoErr ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#0071b4]'}`}
                          aria-invalid={itemHasCodigoErr || undefined} />
                        {item.codigo && (
                          <button type="button" onClick={() => limparProduto(item.id)}
                            className="absolute right-2.5 top-2.5 text-gray-400 hover:text-red-500 transition p-0.5 rounded-full hover:bg-red-50"
                            aria-label="Limpar produto">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      {mostrarDropdown && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto" onMouseDown={(e) => e.preventDefault()}>
                          {produtosFiltrados.map((p) => (
                            <button key={p.codigo} onClick={() => selecionarProduto(item.id, p)}
                              className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 transition hover:bg-blue-50/50">
                              <div className="flex justify-between items-center">
                                <div><span className="font-semibold text-[#0071b4] text-sm">{p.codigo}</span><span className="text-gray-700 ml-2 text-sm">{p.nome}</span></div>
                                <div className="text-right">
                                  <span className="text-gray-600 font-medium text-sm">R$ {Number(n(p.preco)).toFixed(2)}</span>
                                  <div className="text-[11px] text-gray-400">
                                    {p.un && <span className="mr-2">Un: {p.un}</span>}
                                    {Number.isFinite(p.ipi) && <span>IPI: {Number(p.ipi).toString().replace('.', ',')}%</span>}
                                  </div>
                                </div>
                              </div>
                              {p.multiplo > 1 && <span className="text-xs text-gray-400">Múltiplo de {p.multiplo}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {itemHasCodigoErr && <p className="text-red-500 text-xs mt-1">Selecione um produto.</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Qtd * {item.multiplo > 1 && <span className="text-gray-400 font-normal">(múlt. {item.multiplo})</span>}
                      </label>
                      <input ref={itemRefs.current[item.id].quantidade} type="number" value={item.quantidade}
                        onChange={(e) => atualizarItem(item.id, 'quantidade', parseInt(e.target.value) || 0)}
                        className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${(!multiploValido || itemHasQtdErr) ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#0071b4]'}`}
                        min={item.multiplo} step={item.multiplo} disabled={!item.codigo} aria-invalid={(!multiploValido || itemHasQtdErr) || undefined} />
                      {(!multiploValido || itemHasQtdErr) && item.codigo && <p className="text-red-500 text-xs mt-1 font-medium">Deve ser múltiplo de {item.multiplo}</p>}
                    </div>
                  </div>
                  {item.codigo && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs bg-white p-3 rounded-lg border border-gray-100">
                      <div><span className="text-gray-400">Código:</span><span className="ml-1 font-medium text-gray-700">{item.codigo}</span></div>
                      <div><span className="text-gray-400">Preço:</span><span className="ml-1 font-medium text-gray-700">R$ {Number(n(item.precoUnitario)).toFixed(2)}</span></div>
                      <div><span className="text-gray-400">Un:</span><span className="ml-1 font-medium text-gray-700">{item.unidade || 'UN'}</span></div>
                      <div><span className="text-gray-400">IPI %:</span><span className="ml-1 font-medium text-gray-700">{Number(n(item.ipi)).toString().replace('.', ',')}</span></div>
                      <div><span className="text-gray-400">IPI R$:</span><span className="ml-1 font-medium text-gray-700">R$ {itemIPI(item).toFixed(2)}</span></div>
                    </div>
                  )}
                  <div className="mt-3 text-right">
                    <span className="text-xs text-gray-400">Subtotal: </span>
                    <span className="font-bold text-gray-800">R$ {itemSubtotal(item).toFixed(2)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ====== Impostos e Descontos ====== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Impostos e Descontos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ICMS (%) *</label>
            <select ref={refs.icms} value={icms}
              onChange={(e) => { setIcms(e.target.value); setFieldError('impostos', 'icms', isEmpty(e.target.value)) }}
              className={inputClass('impostos', 'icms')} aria-invalid={hasErr('impostos', 'icms') || undefined}>
              <option value="">Selecione...</option>
              <option value="7">7%</option><option value="12">12%</option><option value="18">18%</option>
            </select>
            {hasErr('impostos', 'icms') && <p className="text-red-500 text-xs mt-1">Informe o ICMS.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Desconto (%)</label>
            <select ref={refs.desconto} value={desconto} onChange={(e) => setDesconto(parseFloat(e.target.value))} className={inputClass('impostos', 'desconto')}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((v) => (<option key={v} value={v}>{v}%</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* ====== Dados Comerciais ====== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Dados Comerciais</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Validade da Proposta</label>
            <input type="text" value={comercial.validade} readOnly className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">Calculado automaticamente (7 dias)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pagamento *</label>
            <select ref={refs.formaPagamento} value={comercial.formaPagamento}
              onChange={(e) => { setComercial({ ...comercial, formaPagamento: e.target.value }); setFieldError('comercial', 'formaPagamento', !e.target.value) }}
              className={inputClass('comercial', 'formaPagamento')} aria-invalid={hasErr('comercial', 'formaPagamento') || undefined}>
              <option value="À vista">À vista</option><option value="14 dias">14 dias</option><option value="28 dias">28 dias</option>
              <option value="30 dias">30 dias</option><option value="45 dias">45 dias</option><option value="60 dias">60 dias</option>
              <option value="28/56 dias">28/56 dias</option><option value="30/60 dias">30/60 dias</option><option value="Outros">Outros</option>
            </select>
          </div>
          {comercial.formaPagamento === 'Outros' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Especifique *</label>
              <input ref={refs.formaPagamentoDetalhe} type="text" placeholder="Ex: 50% entrada + 50% na entrega" value={comercial.formaPagamentoDetalhe}
                onChange={(e) => { setComercial({ ...comercial, formaPagamentoDetalhe: e.target.value }); setFieldError('comercial', 'formaPagamentoDetalhe', !e.target.value.trim()) }}
                className={inputClass('comercial', 'formaPagamentoDetalhe')} aria-invalid={hasErr('comercial', 'formaPagamentoDetalhe') || undefined} />
              {hasErr('comercial', 'formaPagamentoDetalhe') && <p className="text-red-500 text-xs mt-1">Campo obrigatório.</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Prazo de Entrega *</label>
            <input ref={refs.prazoEntrega} type="text" placeholder="Ex: 15 dias úteis" value={comercial.prazoEntrega}
              onChange={(e) => { setComercial({ ...comercial, prazoEntrega: e.target.value }); setFieldError('comercial', 'prazoEntrega', !e.target.value.trim()) }}
              className={inputClass('comercial', 'prazoEntrega')} aria-invalid={hasErr('comercial', 'prazoEntrega') || undefined} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Frete *</label>
            <select ref={refs.frete} value={comercial.frete}
              onChange={(e) => {
                const v = e.target.value
                setComercial({ ...comercial, frete: v, transportadora: (v !== 'Transportadora' && v !== 'Outros') ? '' : comercial.transportadora })
                setFieldError('comercial', 'frete', !v)
                if (v !== 'Transportadora' && v !== 'Outros') setFieldError('comercial', 'transportadora', false)
              }}
              className={inputClass('comercial', 'frete')} aria-invalid={hasErr('comercial', 'frete') || undefined}>
              <option value="FOB">FOB (por conta do cliente)</option><option value="Retira">Retira (cliente busca)</option>
              <option value="Transportadora">Transportadora</option><option value="Outros">Outros</option>
            </select>
          </div>
          {(comercial.frete === 'Transportadora' || comercial.frete === 'Outros') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{comercial.frete === 'Transportadora' ? 'Nome da Transportadora *' : 'Especifique o meio de envio *'}</label>
              <input ref={refs.transportadora} type="text" placeholder={comercial.frete === 'Transportadora' ? "Nome da transportadora" : "Ex: Motoboy, Correios..."} value={comercial.transportadora}
                onChange={(e) => { setComercial({ ...comercial, transportadora: e.target.value }); setFieldError('comercial', 'transportadora', !e.target.value.trim()) }}
                className={inputClass('comercial', 'transportadora')} aria-invalid={hasErr('comercial', 'transportadora') || undefined} />
              {hasErr('comercial', 'transportadora') && <p className="text-red-500 text-xs mt-1">Campo obrigatório.</p>}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Observações (opcional)</label>
          <textarea value={comercial.observacoes} onChange={(e) => setComercial({ ...comercial, observacoes: e.target.value })} rows="5"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071b4] transition" />
        </div>
      </div>

      {/* ====== Resumo Financeiro ====== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Resumo Financeiro</h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium text-gray-800">R$ {calcularSubtotal().toFixed(2)}</span></div>
          <div className="flex justify-between text-sm text-red-600"><span>Desconto ({n(desconto)}%)</span><span className="font-medium">- R$ {calcularDesconto().toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">ICMS ({n(icms)}%)</span><span className="font-medium text-gray-800">+ R$ {calcularICMS().toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">IPI (itens com IPI)</span><span className="font-medium text-gray-800">+ R$ {calcularIPITotal().toFixed(2)}</span></div>
          <div className="border-t border-gray-100 pt-4 mt-2">
            <div className="flex justify-between items-center bg-blue-50 rounded-xl px-5 py-4">
              <span className="text-gray-900 font-bold text-lg">Total</span>
              <span className="font-bold text-2xl text-[#0071b4]">R$ {calcularTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Botão Gerar */}
      <div className="flex justify-end pb-4">
        <button ref={gerarBtnRef} onClick={confirmarGerarOrcamento} disabled={enviando}
          className="w-full sm:w-auto bg-[#0071b4] hover:bg-[#005a91] text-white px-8 py-3 rounded-xl text-base font-semibold transition shadow-lg shadow-blue-500/20 ring-1 ring-[#005a91]/50 disabled:opacity-50 disabled:cursor-not-allowed">
          {editMode ? (previousStatus === 'rascunho' ? 'Tentar Novamente' : 'Salvar Alterações') : 'Gerar Orçamento'}
        </button>
      </div>

      {/* Popover */}
      {showConfirm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={fecharPopover} aria-hidden="true" />
          <div className="fixed z-50 inset-x-4 sm:inset-x-auto top-1/2 left-1/2 -translate-y-1/2 sm:-translate-x-1/2 w-auto sm:w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-200" role="dialog" aria-modal="true">
            {!respostaN8n ? (
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Confirmar envio</h3>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm mb-5 space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Cliente:</span><span className="font-medium text-gray-800">{cliente.empresa || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal:</span><span className="font-medium">R$ {calcularSubtotal().toFixed(2)}</span></div>
                  <div className="flex justify-between text-red-600"><span>Desconto ({n(desconto)}%):</span><span className="font-medium">- R$ {calcularDesconto().toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">ICMS ({n(icms)}%):</span><span className="font-medium">+ R$ {calcularICMS().toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">IPI:</span><span className="font-medium">+ R$ {calcularIPITotal().toFixed(2)}</span></div>
                  <div className="flex justify-between border-t border-gray-200 pt-2 mt-2"><span className="font-semibold text-gray-800">Total:</span><span className="font-bold text-[#0071b4]">R$ {calcularTotal().toFixed(2)}</span></div>
                  <div className="flex justify-between mt-2 text-gray-500"><span>Representante:</span><span className="font-medium text-gray-800">{representante || '—'}</span></div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={fecharPopover} disabled={enviando} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">Cancelar</button>
                  <button onClick={gerarOrcamento} disabled={enviando} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#0071b4] hover:bg-[#005a91] shadow-sm disabled:opacity-50 flex items-center gap-2 transition">
                    {enviando && <Loader2 className="animate-spin" size={16} />}
                    {enviando ? 'Enviando...' : (editMode ? (previousStatus === 'rascunho' ? 'Confirmar Reenvio' : 'Confirmar Edição') : 'Confirmar envio')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3">{editMode ? 'Orçamento Atualizado!' : 'Orçamento gerado!'}</h3>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 mb-5 space-y-1">
                  <p><span className="text-gray-500">Proposta: </span><span className="font-semibold text-green-700">{respostaN8n.numeroProposta || '—'}</span></p>
                  <p><span className="text-gray-500">Validade: </span><span className="font-semibold text-green-700">{respostaN8n.validade || comercial.validade || '—'}</span></p>
                  <p><span className="text-gray-500">Total: </span><span className="font-semibold text-green-700">R$ {respostaN8n.total ? Number(respostaN8n.total).toFixed(2) : calcularTotal().toFixed(2)}</span></p>
                  {respostaN8n.pdfUrl && (
                    <a href={respostaN8n.pdfUrl} target="_blank" rel="noopener noreferrer" className="block mt-4 text-center font-semibold rounded-lg px-4 py-2 text-white bg-[#0071b4] hover:bg-[#005a91] transition">Baixar PDF</a>
                  )}
                </div>
                <div className="flex justify-end">
                  <button onClick={fecharPopover} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#0071b4] hover:bg-[#005a91] shadow-sm transition">Fechar</button>
                </div>
              </div>
            )}
            <div className={`hidden sm:block absolute ${popoverPos.placement === 'bottom' ? '-top-2' : '-bottom-2'} right-6 w-0 h-0 border-l-8 border-r-8 ${popoverPos.placement === 'bottom' ? 'border-b-8 border-b-white border-l-transparent border-r-transparent' : 'border-t-8 border-t-white border-l-transparent border-r-transparent'}`} />
          </div>
        </>
      )}
    </div>
  )
}
