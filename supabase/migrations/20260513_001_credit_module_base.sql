-- ============================================================
-- FASE 1: MÓDULO DE CRÉDITO — Fundação
-- Arquivo: 20260513_001_credit_module_base.sql
-- SEGURANÇA: Apenas cria novos objetos. Nada existente é alterado.
-- ============================================================

-- ============================================================
-- SEÇÃO 1: Funções Helper de Role
-- Seguindo o padrão de is_admin() já existente
-- ============================================================

-- Retorna a role do usuário logado
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$;

-- Verifica se o usuário tem alguma das roles passadas
CREATE OR REPLACE FUNCTION public.has_role(roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = ANY(roles)
  );
$$;

-- ============================================================
-- SEÇÃO 2: Tabela Principal — credit_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credit_requests (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              timestamptz DEFAULT now() NOT NULL,
  updated_at              timestamptz DEFAULT now() NOT NULL,
  created_by              uuid REFERENCES auth.users(id) NOT NULL,

  -- Obra / Cliente
  obra_nome               text NOT NULL,
  obra_endereco           text NOT NULL,
  cliente_nome            text NOT NULL,
  cliente_cnpj            text NOT NULL,
  cliente_tipo            text NOT NULL CHECK (cliente_tipo IN ('novo', 'recorrente')),

  -- Valores
  valor_solicitado        numeric NOT NULL CHECK (valor_solicitado > 0),
  condicao_pagamento      text,
  limite_disponivel       numeric,

  -- Intermediários (array de objetos: {nome, papel})
  intermediarios          jsonb,
  responsavel_comercial   uuid REFERENCES auth.users(id),

  -- Análise de Crédito (preenchido pelo financeiro)
  restricoes_serasa       boolean DEFAULT false,
  restricoes_observacoes  text,

  -- Aprovação
  nivel_aprovacao         text CHECK (nivel_aprovacao IN ('direto', 'gerente', 'diretoria')),
  aprovado_por            uuid REFERENCES auth.users(id),
  aprovado_em             timestamptz,
  aprovacao_justificativa text,

  -- Contrato Clicksign
  clicksign_document_key  text,
  contrato_enviado_em     timestamptz,
  contrato_assinado_em    timestamptz,

  -- Status com 14 estados possíveis
  status text DEFAULT 'rascunho' NOT NULL,
  CONSTRAINT check_credit_status CHECK (status IN (
    'rascunho',
    'aguardando_documentacao',
    'documentacao_completa',
    'em_analise_financeiro',
    'limite_registrado',
    'aguardando_aprovacao_gerente',
    'aguardando_aprovacao_diretoria',
    'aprovado',
    'reprovado',
    'contrato_gerado',
    'contrato_enviado',
    'contrato_assinado',
    'pronto_para_faturamento',
    'faturado'
  ))
);

-- ============================================================
-- SEÇÃO 3: Histórico Imutável de Status
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credit_status_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid REFERENCES public.credit_requests(id) ON DELETE CASCADE NOT NULL,
  status_anterior text,
  status_novo    text NOT NULL,
  alterado_por   uuid REFERENCES auth.users(id) NOT NULL,
  alterado_em    timestamptz DEFAULT now() NOT NULL,
  observacao     text
);

-- ============================================================
-- SEÇÃO 4: Documentos Anexados
-- ============================================================

CREATE TABLE IF NOT EXISTS public.credit_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid REFERENCES public.credit_requests(id) ON DELETE CASCADE NOT NULL,
  tipo         text NOT NULL CHECK (tipo IN ('ficha_credito', 'pedido_compra', 'orcamento', 'outro')),
  storage_path text NOT NULL,
  uploaded_by  uuid REFERENCES auth.users(id) NOT NULL,
  uploaded_at  timestamptz DEFAULT now() NOT NULL
);

-- ============================================================
-- SEÇÃO 5: Índices para Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_credit_requests_status
  ON public.credit_requests(status);

CREATE INDEX IF NOT EXISTS idx_credit_requests_created_by
  ON public.credit_requests(created_by);

CREATE INDEX IF NOT EXISTS idx_credit_requests_created_at
  ON public.credit_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_requests_responsavel
  ON public.credit_requests(responsavel_comercial);

CREATE INDEX IF NOT EXISTS idx_credit_history_request
  ON public.credit_status_history(request_id);

CREATE INDEX IF NOT EXISTS idx_credit_history_alterado_em
  ON public.credit_status_history(alterado_em DESC);

CREATE INDEX IF NOT EXISTS idx_credit_documents_request
  ON public.credit_documents(request_id);

-- ============================================================
-- SEÇÃO 6: Triggers
-- ============================================================

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_credit_request_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_requests_updated_at ON public.credit_requests;
CREATE TRIGGER trg_credit_requests_updated_at
  BEFORE UPDATE ON public.credit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_credit_request_timestamp();

-- Registra histórico automaticamente quando status muda
CREATE OR REPLACE FUNCTION public.record_credit_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.credit_status_history (
      request_id,
      status_anterior,
      status_novo,
      alterado_por
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_status_history ON public.credit_requests;
CREATE TRIGGER trg_credit_status_history
  AFTER UPDATE ON public.credit_requests
  FOR EACH ROW EXECUTE FUNCTION public.record_credit_status_history();

-- ============================================================
-- SEÇÃO 7: RLS — credit_requests
-- ============================================================

ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;

-- Admin: acesso total
CREATE POLICY "credit_req_admin_all"
  ON public.credit_requests FOR ALL
  USING (has_role(ARRAY['admin']))
  WITH CHECK (has_role(ARRAY['admin']));

-- Comercial: vê e cria as suas; edita só se rascunho
CREATE POLICY "credit_req_comercial_select"
  ON public.credit_requests FOR SELECT
  USING (has_role(ARRAY['comercial']) AND created_by = auth.uid());

CREATE POLICY "credit_req_comercial_insert"
  ON public.credit_requests FOR INSERT
  WITH CHECK (has_role(ARRAY['comercial']) AND created_by = auth.uid());

CREATE POLICY "credit_req_comercial_update_rascunho"
  ON public.credit_requests FOR UPDATE
  USING (
    has_role(ARRAY['comercial'])
    AND created_by = auth.uid()
    AND status = 'rascunho'
  )
  WITH CHECK (
    has_role(ARRAY['comercial'])
    AND created_by = auth.uid()
  );

-- Financeiro: vê tudo, atualiza campos de análise
CREATE POLICY "credit_req_financeiro_select"
  ON public.credit_requests FOR SELECT
  USING (has_role(ARRAY['financeiro']));

CREATE POLICY "credit_req_financeiro_update"
  ON public.credit_requests FOR UPDATE
  USING (has_role(ARRAY['financeiro']))
  WITH CHECK (has_role(ARRAY['financeiro']));

-- Gerente: vê tudo, aprova nível gerente
CREATE POLICY "credit_req_gerente_select"
  ON public.credit_requests FOR SELECT
  USING (has_role(ARRAY['gerente']));

CREATE POLICY "credit_req_gerente_update"
  ON public.credit_requests FOR UPDATE
  USING (
    has_role(ARRAY['gerente'])
    AND status = 'aguardando_aprovacao_gerente'
  )
  WITH CHECK (has_role(ARRAY['gerente']));

-- Diretoria: vê tudo, aprova qualquer nível
CREATE POLICY "credit_req_diretoria_select"
  ON public.credit_requests FOR SELECT
  USING (has_role(ARRAY['diretoria']));

CREATE POLICY "credit_req_diretoria_update"
  ON public.credit_requests FOR UPDATE
  USING (has_role(ARRAY['diretoria']))
  WITH CHECK (has_role(ARRAY['diretoria']));

-- ============================================================
-- SEÇÃO 8: RLS — credit_status_history (somente leitura para usuários)
-- INSERT só ocorre via trigger SECURITY DEFINER (bypassa RLS)
-- ============================================================

ALTER TABLE public.credit_status_history ENABLE ROW LEVEL SECURITY;

-- Admin: tudo
CREATE POLICY "credit_hist_admin_all"
  ON public.credit_status_history FOR ALL
  USING (has_role(ARRAY['admin']));

-- Financeiro, Gerente, Diretoria: leem todo o histórico
CREATE POLICY "credit_hist_staff_select"
  ON public.credit_status_history FOR SELECT
  USING (has_role(ARRAY['financeiro', 'gerente', 'diretoria']));

-- Comercial: vê histórico apenas das suas solicitações
CREATE POLICY "credit_hist_comercial_select"
  ON public.credit_status_history FOR SELECT
  USING (
    has_role(ARRAY['comercial'])
    AND EXISTS (
      SELECT 1 FROM public.credit_requests cr
      WHERE cr.id = request_id
        AND cr.created_by = auth.uid()
    )
  );

-- ============================================================
-- SEÇÃO 9: RLS — credit_documents
-- ============================================================

ALTER TABLE public.credit_documents ENABLE ROW LEVEL SECURITY;

-- Admin: tudo
CREATE POLICY "credit_doc_admin_all"
  ON public.credit_documents FOR ALL
  USING (has_role(ARRAY['admin']));

-- Financeiro, Gerente, Diretoria: veem todos os documentos
CREATE POLICY "credit_doc_staff_select"
  ON public.credit_documents FOR SELECT
  USING (has_role(ARRAY['financeiro', 'gerente', 'diretoria']));

-- Comercial: gerencia documentos das suas solicitações
CREATE POLICY "credit_doc_comercial_all"
  ON public.credit_documents FOR ALL
  USING (
    has_role(ARRAY['comercial'])
    AND EXISTS (
      SELECT 1 FROM public.credit_requests cr
      WHERE cr.id = request_id
        AND cr.created_by = auth.uid()
    )
  )
  WITH CHECK (
    has_role(ARRAY['comercial'])
    AND uploaded_by = auth.uid()
  );
