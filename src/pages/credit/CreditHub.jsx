import { useNavigate } from 'react-router-dom';
import { useUserRole } from '../../hooks/useUserRole';
import { FilePlus, List, CheckSquare, BarChart2 } from 'lucide-react';

const CARDS_BY_ROLE = {
  admin: [
    { icon: FilePlus,     label: 'Nova Solicitação',   path: '/credito/nova-solicitacao',       desc: 'Iniciar pedido de análise de crédito' },
    { icon: List,         label: 'Todas Solicitações', path: '/credito/minhas-solicitacoes',    desc: 'Visualizar e gerenciar todas as solicitações' },
    { icon: CheckSquare,  label: 'Aprovações',         path: '/credito/aprovar-gerente',         desc: 'Pendências de aprovação' },
    { icon: BarChart2,    label: 'Dashboard',          path: '/credito/dashboard',               desc: 'Métricas e visão geral' },
  ],
  comercial: [
    { icon: FilePlus,     label: 'Nova Solicitação',   path: '/credito/nova-solicitacao',       desc: 'Iniciar pedido de análise de crédito' },
    { icon: List,         label: 'Minhas Solicitações', path: '/credito/minhas-solicitacoes',   desc: 'Acompanhar suas solicitações' },
  ],
  financeiro: [
    { icon: List,         label: 'Verificar Crédito',  path: '/credito/verificar-credito',      desc: 'Analisar solicitações aguardando documentação' },
    { icon: BarChart2,    label: 'Dashboard',          path: '/credito/dashboard',               desc: 'Métricas e visão geral' },
  ],
  gerente: [
    { icon: CheckSquare,  label: 'Aprovar (Gerente)',  path: '/credito/aprovar-gerente',         desc: 'Solicitações aguardando aprovação de gerente' },
    { icon: BarChart2,    label: 'Dashboard',          path: '/credito/dashboard',               desc: 'Métricas e visão geral' },
  ],
  diretoria: [
    { icon: CheckSquare,  label: 'Aprovar (Diretoria)', path: '/credito/aprovar-diretoria',     desc: 'Solicitações aguardando aprovação de diretoria' },
    { icon: BarChart2,    label: 'Dashboard',          path: '/credito/dashboard',               desc: 'Métricas e visão geral' },
  ],
};

export default function CreditHub() {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const cards = CARDS_BY_ROLE[role] ?? [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Módulo de Crédito</h1>
        <p className="text-gray-500 mt-1 text-sm">Análise e aprovação de crédito para obras e clientes.</p>
      </div>

      {cards.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Sem ações disponíveis para o seu perfil.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map(({ icon: Icon, label, path, desc }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="bg-white border border-gray-200 rounded-xl p-6 text-left hover:border-[#0071b4]/40 hover:shadow-md transition group"
            >
              <div className="w-10 h-10 rounded-lg bg-[#0071b4]/10 flex items-center justify-center mb-4 group-hover:bg-[#0071b4]/20 transition">
                <Icon size={20} className="text-[#0071b4]" />
              </div>
              <div className="font-semibold text-gray-900 mb-1">{label}</div>
              <div className="text-sm text-gray-500">{desc}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
