# Plano de Implementação — Módulo de Análise de Crédito

## Resumo Executivo
Implementação de módulo integrado ao app React existente com 4 fases, 60 dias, estruturado em migração de DB, frontend condicional por role, integrações com n8n/Clicksign e dashboard.

**Status:** Em definição  
**Versão:** 1.0  
**Última atualização:** 2026-05-13

---

## Estrutura do Projeto Atual

### Frontend (React 19 + Vite)
- **Arquitetura:** Router-based com layout compartilhado (DashboardLayout)
- **Rotas:** Todas protegidas por ProtectedRoute
- **Roles atuais:** `admin` | `rep`
- **Autenticação:** Supabase Auth com session check
- **Components:** Renderização condicional baseada em `userMetadata.role`
- **Menu:** adminMenuItems vs repMenuItems

### Backend (Supabase)
- **Banco:** PostgreSQL + RLS policies
- **Auth:** Managed via Supabase Auth
- **Storage:** Supabase Storage para uploads
- **Migrations:** Localizadas em `supabase/migration_*.sql`

### Deploy
- **Frontend:** Vercel
- **Backend:** Supabase (nenhuma mudança)
- **Automações:** n8n (já configurado)

---

## Decisões de Arquitetura

### 1. Integração no mesmo app
- ✅ Novas rotas React sob `/credito/*`
- ✅ Menu lateral renderiza condicionalmente por role
- ✅ RLS policies garantem isolamento de dados
- ❌ Nenhum novo deploy ou subdomínio

### 2. Expansão de Roles
**Antes:**
```
user | admin
```

**Depois:**
```
comercial | financeiro | gerente | diretoria | admin
```

**Estratégia:**
- Alterar tipo `user_role` enum no Supabase
- Criar migration para expandir valores
- Atualizar RLS policies
- Atualizar frontend para 5 roles

### 3. Modelo de Dados
Novas tabelas:
- `credit_requests` — solicitação principal
- `credit_status_history` — histórico imutável
- `credit_documents` — storage de anexos

---

## Fase 1 — Fundação (Semana 1-2)

### 1.1 Banco de Dados
**Tasks:**
- [ ] Criar migration: expansão de `user_role` enum
- [ ] Criar migration: tabela `credit_requests`
- [ ] Criar migration: tabela `credit_status_history`
- [ ] Criar migration: tabela `credit_documents`
- [ ] Criar indices para queries frequentes (status, user, data)
- [ ] Atualizar RLS policies por role

**Arquivo:** `supabase/migrations/001_credit_module_base.sql`

### 1.2 Frontend — Rotas e Roles
**Tasks:**
- [ ] Atualizar DashboardLayout com 5 roles
- [ ] Criar mapeamento role → menuItems
- [ ] Criar página `/credito/inicio` (hub do módulo)
- [ ] Criar página `/credito/minhas-solicitacoes` (tabela lista)
- [ ] Proteger rotas com role check
- [ ] Breadcrumb para rotas de crédito

**Arquivos:**
- `src/components/DashboardLayout.jsx` (atualizar)
- `src/pages/CreditHub.jsx` (nova)
- `src/pages/MyCreditRequests.jsx` (nova)

### 1.3 Autenticação e Permissões
**Tasks:**
- [ ] Adicionar helper `useUserRole()`
- [ ] Criar componente `<RoleGuard role={['comercial', 'admin']} />`
- [ ] Testar renderização condicional

**Arquivo:** `src/hooks/useUserRole.js`

---

## Fase 2 — Fluxo Principal (Semana 3-4)

### 2.1 Formulário de Solicitação
**Tasks:**
- [ ] Criar página `/credito/nova-solicitacao`
- [ ] Campos: obra, cliente, valor, pagamento, intermediários
- [ ] Validação front + back
- [ ] Upload obrigatório (ficha crédito)
- [ ] Salvar em `credit_requests` com status `rascunho`
- [ ] Permitir edição se status = `rascunho`

**Arquivo:** `src/pages/CreditNewRequest.jsx`

### 2.2 Verificação de Crédito (Financeiro)
**Tasks:**
- [ ] Criar página `/credito/verificar-credito` (financeiro only)
- [ ] Listar solicitações em status `aguardando_documentacao`
- [ ] Campo: registrar limite disponível
- [ ] Validação: `valor_solicitado <= limite_disponivel`
- [ ] Transição automática: `documentacao_completa` após validação
- [ ] Bloquear avanço se documentação incompleta

**Arquivo:** `src/pages/CreditVerification.jsx`

### 2.3 Regras de Aprovação por Alçada
**Tasks:**
- [ ] Definir faixas de valor com cliente ⚠️ **DEPENDÊNCIA EXTERNA**
- [ ] Implementar lógica: `valor → aprovador`
- [ ] Transições automáticas de status:
  - `documentacao_completa` → `aguardando_aprovacao_gerente` (ou diretoria)
- [ ] Páginas de aprovação por role:
  - `/credito/aprovar-gerente` (gerente, diretoria, admin)
  - `/credito/aprovar-diretoria` (diretoria, admin)

**Arquivo:** `src/utils/creditRules.js`

### 2.4 Histórico Imutável
**Tasks:**
- [ ] Trigger SQL para registrar em `credit_status_history` a cada mudança
- [ ] Endpoint para listar histórico (read-only)
- [ ] UI: Timeline de status

**Arquivo:** `src/components/credit/StatusTimeline.jsx`

---

## Fase 3 — Integrações (Semana 5)

### 3.1 WhatsApp via n8n
**Tasks:**
- [ ] Criar webhook n8n: trigger = mudança de status relevante
- [ ] Gerar PDF da solicitação automaticamente
- [ ] Enviar ao grupo WhatsApp com link de aprovação
- [ ] Registrar aprovação com data + responsável

**Documentação:** n8n workflow config

### 3.2 Clicksign
**Tasks:**
- [ ] Implementar integração Clicksign API
- [ ] Template contrato com variáveis dinâmicas
- [ ] Endpoint: POST `/api/credito/gerar-contrato`
- [ ] Registrar `clicksign_document_key`
- [ ] Webhook Clicksign: atualizar status após assinatura
- [ ] Transição: `contrato_assinado` → `pronto_para_faturamento`

**Arquivo:** `src/services/clicksignClient.js`

### 3.3 Upload de Documentos
**Tasks:**
- [ ] Componente upload (ficha crédito, pedido compra, orcamento)
- [ ] Integrar Supabase Storage
- [ ] RLS para acesso baseado em role + ownership
- [ ] Visualizar previews no histórico

**Arquivo:** `src/components/credit/DocumentUpload.jsx`

---

## Fase 4 — Dashboard e Refinamento (Semana 6)

### 4.1 Dashboard
**Tasks:**
- [ ] Página `/credito/dashboard` (financeiro, gerente, diretoria, admin)
- [ ] Métricas:
  - Total por status
  - Pendências por responsável
  - Valor em análise / aprovado
  - Tempo médio aprovação
  - Reprovações (com motivo)
- [ ] Gráficos (charts library: considerar recharts ou chart.js)

**Arquivo:** `src/pages/CreditDashboard.jsx`

### 4.2 Testes End-to-End
**Tasks:**
- [ ] Fluxo completo: rascunho → aprovado → contrato → faturado
- [ ] Validações de regra
- [ ] Permissões por role
- [ ] Webhooks n8n + Clicksign

### 4.3 Refinamento UX
**Tasks:**
- [ ] Feedback visual (toasts de sucesso/erro)
- [ ] Validações inline
- [ ] Responsividade mobile
- [ ] Acessibilidade (WCAG)

---

## Dependências e Bloqueadores

### 🔴 CRÍTICA — Definir faixas de valor
**Issue:** PRD diz "A definir com cliente"  
**Resolução necessária antes de Fase 2.3**  
**Valores esperados:**
```
R$ 0 — XXX: Liberação direta
R$ XXX — YYY: Gerente
R$ YYY+: Diretoria
```

### 🟡 IMPORTANTE — Configurar Clicksign API
**Necessário:** API key, webhook URL, template  
**Responsável:** Kakua (cliente)  
**Timeline:** Antes de Fase 3.2

### 🟡 IMPORTANTE — Configurar n8n
**Necessário:** Webhook endpoint, credentials para WhatsApp  
**Responsável:** Kakua / Multivac Ops  
**Timeline:** Antes de Fase 3.1

---

## Modelo de Dados (Esquema SQL)

```sql
-- Expansão de enum (migration 001)
ALTER TYPE user_role ADD VALUE 'comercial';
ALTER TYPE user_role ADD VALUE 'financeiro';
ALTER TYPE user_role ADD VALUE 'gerente';
ALTER TYPE user_role ADD VALUE 'diretoria';

-- Nova tabela principal
CREATE TABLE public.credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL,

  -- Obra / Cliente
  obra_nome text NOT NULL,
  obra_endereco text NOT NULL,
  cliente_nome text NOT NULL,
  cliente_cnpj text NOT NULL,
  cliente_tipo text NOT NULL CHECK (cliente_tipo IN ('novo', 'recorrente')),

  -- Valores
  valor_solicitado numeric NOT NULL,
  condicao_pagamento text,
  limite_disponivel numeric,

  -- Intermediários
  intermediarios jsonb,
  responsavel_comercial uuid REFERENCES auth.users(id),

  -- Análise de Crédito
  restricoes_serasa boolean DEFAULT false,
  restricoes_observacoes text,

  -- Aprovação
  nivel_aprovacao text CHECK (nivel_aprovacao IN ('direto', 'gerente', 'diretoria')),
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  aprovacao_justificativa text,

  -- Contrato (Clicksign)
  clicksign_document_key text,
  contrato_enviado_em timestamptz,
  contrato_assinado_em timestamptz,

  -- Status (13 estados)
  status text DEFAULT 'rascunho' NOT NULL,

  CONSTRAINT check_status CHECK (status IN (
    'rascunho', 'aguardando_documentacao', 'documentacao_completa',
    'em_analise_financeiro', 'limite_registrado', 
    'aguardando_aprovacao_gerente', 'aguardando_aprovacao_diretoria',
    'aprovado', 'reprovado', 'contrato_gerado', 'contrato_enviado',
    'contrato_assinado', 'pronto_para_faturamento', 'faturado'
  ))
);

-- Histórico imutável (audit log)
CREATE TABLE public.credit_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES credit_requests(id) NOT NULL,
  status_anterior text,
  status_novo text NOT NULL,
  alterado_por uuid REFERENCES auth.users(id) NOT NULL,
  alterado_em timestamptz DEFAULT now(),
  observacao text
);

-- Documentos anexados
CREATE TABLE public.credit_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES credit_requests(id) NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ficha_credito', 'pedido_compra', 'orcamento', 'outro')),
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

-- RLS Policies (por role)
-- Admin: acesso total
-- Financeiro: lê todas, registra limite, aprova
-- Gerente: lê atribuídas, aprova nível gerente
-- Diretoria: lê todas, aprova nível diretoria
-- Comercial: cria, vê próprias
```

---

## Checklist de Entregáveis

- [ ] Fase 1: Banco + Rotas + Roles
  - [ ] Migrations aplicadas
  - [ ] Menu lateral renderiza corretamente
  - [ ] RLS policies em place
  - [ ] Rotas de crédito acessíveis

- [ ] Fase 2: Fluxo Principal
  - [ ] Formulário de solicitação funcional
  - [ ] Verificação de crédito (financeiro)
  - [ ] Aprovações por alçada
  - [ ] Histórico de status

- [ ] Fase 3: Integrações
  - [ ] WhatsApp via n8n
  - [ ] Clicksign geração + assinatura
  - [ ] Upload de documentos

- [ ] Fase 4: Dashboard + Refinamento
  - [ ] Dashboard com métricas
  - [ ] Testes end-to-end
  - [ ] Ajustes UX/acessibilidade

---

## Timeline

| Fase | Duração | Início | Fim |
|------|---------|--------|-----|
| 1 | 2 sem | Semana 1 | Semana 2 |
| 2 | 2 sem | Semana 3 | Semana 4 |
| 3 | 1 sem | Semana 5 | Semana 5 |
| 4 | 1 sem | Semana 6 | Semana 6 |
| **Total** | **6 sem** | | **60 dias** |

---

## Próximas Ações

1. ✅ Documento de planejamento (FEITO)
2. 🔄 **Iniciar Fase 1**: Migrations e estrutura de roles
3. ⏳ Validar faixas de aprovação com cliente
4. ⏳ Configurar Clicksign + n8n
