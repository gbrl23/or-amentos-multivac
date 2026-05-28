import { useUserRole } from '../../hooks/useUserRole';
import { Clock, Construction } from 'lucide-react';

const STATUS_LABELS = {
  rascunho:                        { label: 'Rascunho',                   color: 'bg-gray-100 text-gray-600' },
  aguardando_documentacao:         { label: 'Ag. Documentação',           color: 'bg-yellow-100 text-yellow-700' },
  documentacao_completa:           { label: 'Doc. Completa',              color: 'bg-blue-100 text-blue-700' },
  em_analise_financeiro:           { label: 'Em Análise',                 color: 'bg-blue-100 text-blue-700' },
  limite_registrado:               { label: 'Limite Registrado',          color: 'bg-teal-100 text-teal-700' },
  aguardando_aprovacao_gerente:    { label: 'Ag. Aprovação Gerente',      color: 'bg-orange-100 text-orange-700' },
  aguardando_aprovacao_diretoria:  { label: 'Ag. Aprovação Diretoria',    color: 'bg-orange-100 text-orange-700' },
  aprovado:                        { label: 'Aprovado',                   color: 'bg-green-100 text-green-700' },
  reprovado:                       { label: 'Reprovado',                  color: 'bg-red-100 text-red-700' },
  contrato_gerado:                 { label: 'Contrato Gerado',            color: 'bg-purple-100 text-purple-700' },
  contrato_enviado:                { label: 'Contrato Enviado',           color: 'bg-purple-100 text-purple-700' },
  contrato_assinado:               { label: 'Contrato Assinado',          color: 'bg-indigo-100 text-indigo-700' },
  pronto_para_faturamento:         { label: 'Pronto p/ Faturamento',      color: 'bg-emerald-100 text-emerald-700' },
  faturado:                        { label: 'Faturado',                   color: 'bg-gray-100 text-gray-700' },
};

export function StatusBadge({ status }) {
  const { label, color } = STATUS_LABELS[status] ?? { label: status, color: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

export default function MyCreditRequests() {
  const { isAdmin, isFinanceiro, isGerente, isDiretoria } = useUserRole();
  const isStaff = isAdmin || isFinanceiro || isGerente || isDiretoria;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isStaff ? 'Todas as Solicitações' : 'Minhas Solicitações'}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {isStaff
            ? 'Visão geral de todas as solicitações de crédito.'
            : 'Acompanhe o andamento das suas solicitações de crédito.'}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
          <Construction size={22} className="text-amber-500" />
        </div>
        <p className="font-semibold text-gray-800">Em construção</p>
        <p className="text-sm text-gray-500 max-w-xs">
          A listagem de solicitações será implementada na Fase 2 do módulo de crédito.
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
          <Clock size={13} />
          <span>Disponível na Semana 3</span>
        </div>
      </div>
    </div>
  );
}
