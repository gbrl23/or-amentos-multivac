-- Migration: Expandir campo status da tabela orcamentos
-- Executar no Supabase SQL Editor antes de deployar o novo dashboard
--
-- Status antigos: 'gerado' (sucesso), 'erro' (falha na geração)
-- Status novos:   'rascunho' (draft/erro), 'enviado' (gerado com sucesso),
--                 'aprovado' (cliente aprovou), 'perdido' (negócio perdido)

BEGIN;

-- 1. Converter registros existentes para a nova taxonomia
UPDATE orcamentos SET status = 'enviado'  WHERE status = 'gerado';
UPDATE orcamentos SET status = 'rascunho' WHERE status = 'erro';

-- 2. (Opcional) Adicionar CHECK constraint para validar valores permitidos
-- Descomente se quiser restringir os valores no banco:
-- ALTER TABLE orcamentos
--   ADD CONSTRAINT orcamentos_status_check
--   CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'perdido'));

COMMIT;
