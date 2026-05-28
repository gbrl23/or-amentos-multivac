import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useUserRole() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchRole() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        if (mounted) { setRole(null); setLoading(false); }
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (mounted) {
        setRole(error ? null : data?.role ?? null);
        setLoading(false);
      }
    }

    fetchRole();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isComercial: role === 'comercial',
    isFinanceiro: role === 'financeiro',
    isGerente: role === 'gerente',
    isDiretoria: role === 'diretoria',
    isRepresentative: role === 'representative',
    hasCredit: ['admin', 'comercial', 'financeiro', 'gerente', 'diretoria'].includes(role),
  };
}
