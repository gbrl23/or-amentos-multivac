import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Search, 
  Plus, 
  Edit2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Package,
  Save
} from 'lucide-react';

const PAGE_SIZE = 50;

export default function CatalogManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Drawer / Form state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  // Navigation
  const navigate = useNavigate();

  // --- BUSCA COM DEBOUNCE ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0); // Volta pra pág 1 quando pesquisa
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // --- FETCH DOS PRODUTOS ---
  useEffect(() => {
    fetchProducts();
  }, [page, debouncedSearch]);

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase
      .from('lista_produtos')
      .select('*', { count: 'exact' });

    if (debouncedSearch) {
      // Busca pelo nome, linha, ext1 ou item
      query = query.or(`detalhe.ilike.%${debouncedSearch}%,ext1.ilike.%${debouncedSearch}%,item.ilike.%${debouncedSearch}%,descricao_linha.ilike.%${debouncedSearch}%`);
    }

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    query = query.range(from, to).order('detalhe', { ascending: true });

    const { data, error, count } = await query;
    if (error) {
      console.error("Erro ao buscar catálogo:", error);
    } else {
      setProducts(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  // --- ABRIR DRAWER (NOVO OU EDIÇÃO) ---
  const handleOpenDrawer = (product = null) => {
    if (product) {
      setEditingItem({ ...product, isNew: false });
    } else {
      // Novo Produto
      setEditingItem({
        isNew: true,
        ext1: '',
        detalhe: '',
        linha: '',
        descricao_linha: '',
        vd_preco: 0,
        un: 'UN',
        al_ipi: 0,
        cfiscal: '',
        peso: 0,
        comprimento: 0,
        largura: 0,
        altura: 0,
        cubagem: 0,
        qtd_min: 1,
        ativo: true
      });
    }
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingItem(null);
  };

  // --- SALVAR (UPSERT) ---
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { isNew, id, ...payload } = editingItem;
      
      if (!payload.ext1 || !payload.detalhe) {
        alert("Código (EXT1) e Descrição são obrigatórios.");
        setSaving(false);
        return;
      }

      // Se não é novo e tem ID, repassamos o ID pra não gerar duplicata caso ext1 mude acidentalmente (embora não deva mudar)
      let finalPayload = { ...payload };
      if (!isNew && id) finalPayload.id = id;

      const { error } = await supabase
        .from('lista_produtos')
        .upsert(finalPayload, { onConflict: 'ext1' });

      if (error) throw error;

      // Recarrega a lista
      fetchProducts();
      handleCloseDrawer();
    } catch (err) {
      console.error("Erro ao salvar produto:", err);
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[85vh] overflow-hidden relative">
      
      {/* HEADER TELA COMPONENTE */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 text-[#0071b4] rounded-xl flex items-center justify-center">
            <Package size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Gestão do Catálogo</h2>
            <p className="text-sm text-gray-500">{totalCount} produtos encontrados</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por item, código ou nome..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0071b4] focus:border-[#0071b4] outline-none transition w-[240px]"
            />
          </div>
          <button 
            onClick={() => handleOpenDrawer()}
            className="flex items-center gap-2 bg-[#0071b4] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#005f9e] transition shadow-sm"
          >
            <Plus size={16} /> Adicionar
          </button>
        </div>
      </div>

      {/* TABELA */}
      <div className="flex-1 overflow-auto p-0 m-0 bg-gray-50/30">
        {loading && products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Loader2 className="animate-spin mb-2" size={32} />
            <p className="text-sm">Carregando catálogo...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Package size={48} className="mb-4 opacity-20" />
            <p className="text-gray-500 font-medium text-lg">Nenhum produto encontrado</p>
            <p className="text-sm">Tente limpar a busca ou adicione um novo produto.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-[#f8fafc] sticky top-0 z-10 border-b border-gray-200 shadow-sm">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-500">Ações</th>
                <th className="px-6 py-4 font-semibold text-gray-500">Item</th>
                <th className="px-6 py-4 font-semibold text-gray-500">Produto</th>
                <th className="px-6 py-4 font-semibold text-gray-500">Linha</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-right">Preço (R$)</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-blue-50/50 transition bg-white group">
                  <td className="px-6 py-3 whitespace-nowrap">
                    <button 
                      onClick={() => handleOpenDrawer(p)}
                      className="p-1.5 text-gray-400 hover:text-[#0071b4] bg-gray-50 hover:bg-blue-100 rounded-md transition"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                  <td className="px-6 py-3 font-mono text-gray-600 font-semibold">{p.item || p.ext1}</td>
                  <td className="px-6 py-3 text-gray-900 font-medium max-w-[300px] truncate" title={p.detalhe}>
                    {p.detalhe}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-semibold">{p.linha}</span>
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-[#0071b4] font-medium">
                    {Number(p.vd_preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      p.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {p.ativo ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINAÇÃO */}
      <div className="bg-white border-t border-gray-100 p-4 flex items-center justify-between text-sm text-gray-600">
        <div>
          Exibindo {Math.min(page * PAGE_SIZE + 1, totalCount)} a {Math.min((page + 1) * PAGE_SIZE, totalCount)} de <strong className="text-gray-900">{totalCount}</strong> produtos
        </div>
        <div className="flex items-center gap-2">
          <button 
            disabled={page === 0 || loading}
            onClick={() => setPage(page - 1)}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold text-gray-900 px-2">Página {page + 1}</span>
          <button 
            disabled={((page + 1) * PAGE_SIZE) >= totalCount || loading}
            onClick={() => setPage(page + 1)}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* PAINEL LATERAL (DRAWER) DE EDIÇÃO */}
      {isDrawerOpen && (
        <>
          {/* Overlay fundo */}
          <div 
            className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm z-40 transition-opacity"
            onClick={handleCloseDrawer}
          />

          {/* Painel */}
          <div className="absolute right-0 top-0 bottom-0 w-[450px] max-w-full bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-8 duration-300">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {editingItem?.isNew ? 'Adicionar Produto' : 'Editar Produto'}
              </h3>
              <button onClick={handleCloseDrawer} className="text-gray-400 hover:bg-red-50 hover:text-red-500 p-2 rounded-lg transition">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <form id="product-form" onSubmit={handleSave} className="space-y-5">
                
                {/* Status Toggle */}
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div>
                    <label className="text-sm font-bold text-gray-900 block">Status do Produto</label>
                    <span className="text-xs text-gray-500">Produtos inativos não aparecem nos pedidos.</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={editingItem?.ativo}
                      onChange={(e) => setEditingItem({...editingItem, ativo: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>

                {/* Campos Básicos */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-2 border-b pb-2">Identificação</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cód. Produto (Item) *</label>
                      <input 
                        type="text" 
                        required
                        value={editingItem?.item || ''}
                        onChange={(e) => setEditingItem({...editingItem, item: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-[#0071b4] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ref. Sistema (ext1) *</label>
                      <input 
                        type="text" 
                        required
                        value={editingItem?.ext1 || ''}
                        onChange={(e) => setEditingItem({...editingItem, ext1: e.target.value})}
                        disabled={!editingItem?.isNew}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-[#0071b4] outline-none disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                  {!editingItem?.isNew && <span className="text-[10px] text-gray-400 block -mt-2">A Referência de Sistema (ext1) não pode ser alterada.</span>}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Completa *</label>
                    <textarea 
                      required
                      rows={2}
                      value={editingItem?.detalhe || ''}
                      onChange={(e) => setEditingItem({...editingItem, detalhe: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0071b4] outline-none resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Linha Categ./Coleção</label>
                    <input 
                      type="text" 
                      value={editingItem?.linha || ''}
                      onChange={(e) => setEditingItem({...editingItem, linha: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0071b4] outline-none"
                    />
                  </div>
                </div>

                {/* Valores & Tributos */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-2 border-b pb-2">Valores</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Preço Base (R$)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editingItem?.vd_preco || 0}
                        onChange={(e) => setEditingItem({...editingItem, vd_preco: parseFloat(e.target.value)})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-[#0071b4] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unidade (UN, CX, KG)</label>
                      <input 
                        type="text" 
                        value={editingItem?.un || ''}
                        onChange={(e) => setEditingItem({...editingItem, un: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0071b4] outline-none uppercase"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Alíquota IPI (%)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editingItem?.al_ipi || 0}
                        onChange={(e) => setEditingItem({...editingItem, al_ipi: parseFloat(e.target.value)})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-[#0071b4] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qtd. Mínima Compra</label>
                      <input 
                        type="number" 
                        step="1"
                        value={editingItem?.qtd_min || 1}
                        onChange={(e) => setEditingItem({...editingItem, qtd_min: parseInt(e.target.value)})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-[#0071b4] outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="h-10"></div> {/* Espaço pro scroll */}
              </form>
            </div>

            {/* Footer de ações do painel */}
            <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)]">
              <button 
                type="button"
                onClick={handleCloseDrawer}
                disabled={saving}
                className="px-5 py-2.5 text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 font-semibold text-sm transition"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                form="product-form"
                disabled={saving}
                className="px-5 py-2.5 bg-[#0071b4] text-white rounded-lg hover:bg-[#005f9e] font-semibold text-sm flex items-center gap-2 transition disabled:opacity-70 shadow-sm"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
