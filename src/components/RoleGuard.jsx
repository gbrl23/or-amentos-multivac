import { Navigate } from 'react-router-dom';
import { useUserRole } from '../hooks/useUserRole';

/**
 * Protege um componente por role.
 * roles: array de roles permitidas, ex: ['admin', 'financeiro']
 * fallback: onde redirecionar se a role não tiver acesso (default: /perfil)
 */
export default function RoleGuard({ roles, fallback = '/perfil', children }) {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-gray-400 text-sm">
        Verificando permissões…
      </div>
    );
  }

  if (!role || !roles.includes(role)) {
    return <Navigate to={fallback} replace />;
  }

  return children;
}
