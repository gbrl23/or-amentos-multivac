import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  LayoutDashboard,
  FileText,
  Package,
  Upload,
  Users,
  Settings,
  LogOut,
  PlusCircle,
  UserPlus,
  User,
} from 'lucide-react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userMetadata, setUserMetadata] = useState(null);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserMetadata(data.user.user_metadata);
        setUserEmail(data.user.email);
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  const isAdmin = userMetadata?.role === 'admin';

  // Menu items condicionais por role
  const adminMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/orcamentos', icon: FileText, label: 'Criar Orçamentos' },
    { path: '/dashboard/catalogo', icon: Package, label: 'Catálogo de Produtos' },
    { path: '/dashboard/catalogo/upload', icon: Upload, label: 'Importar Lote CSV' },
    { path: '/usuarios', icon: Users, label: 'Gerenciar Equipe' },
  ];

  const repMenuItems = [
    { path: '/orcamentos', icon: FileText, label: 'Novo Orçamento' },
    { path: '/perfil', icon: User, label: 'Meu Perfil' },
  ];

  const finalMenuItems = isAdmin ? adminMenuItems : repMenuItems;

  // Breadcrumb dinâmico
  const breadcrumbs = {
    '/dashboard': 'Visão Geral do Painel',
    '/dashboard/catalogo': 'Catálogo de Produtos',
    '/dashboard/catalogo/upload': 'Importação de Dados',
    '/usuarios': 'Gerenciamento de Equipe',
    '/orcamentos': isAdmin ? 'Criar Orçamentos' : 'Novo Orçamento',
    '/perfil': 'Perfil e Preferências',
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-20 shadow-sm">
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <img src="https://i.imgur.com/8AtT4EC.png" alt="Multivac" className="h-9 w-auto object-contain" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">
            {isAdmin ? 'Navegação Principal' : 'Menu'}
          </div>
          {finalMenuItems.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/dashboard' && item.path !== '/orcamentos' && item.path !== '/dashboard/catalogo');
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path + item.label}
                to={item.path}
                className={() => `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${isActive ? 'bg-[#0071b4]/10 text-[#0071b4]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <Icon size={18} className={isActive ? 'text-[#0071b4]' : 'text-gray-400'} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Profile (Bottom) */}
        <div className="p-4 border-t border-gray-100 mt-auto">
          <div className="flex items-center justify-between group cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition" onClick={() => navigate('/perfil')}>
             <div className="flex items-center gap-3">
               <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-100 to-[#0071b4]/20 flex items-center justify-center text-[#0071b4] font-bold text-sm shadow-sm ring-1 ring-white">
                 {(userMetadata?.name || userMetadata?.full_name || userEmail || 'U').charAt(0).toUpperCase()}
               </div>
               <div className="flex flex-col">
                 <span className="text-sm font-semibold text-gray-900 truncate max-w-[120px]">
                   {userMetadata?.name || userMetadata?.full_name || userEmail?.split('@')[0] || 'Usuário'}
                 </span>
                 <span className="text-xs text-gray-500 capitalize">{userMetadata?.role || 'Representante'}</span>
               </div>
             </div>
             <Settings size={16} className="text-gray-400 group-hover:text-gray-600" />
          </div>
          <button onClick={handleLogout} className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-red-600 font-medium p-2 hover:bg-red-50 rounded-lg transition border border-transparent hover:border-red-100">
            <LogOut size={16} />
            Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col ml-64 min-h-screen relative overflow-x-hidden">

        {/* Topbar */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center text-sm text-gray-500 font-medium">
             {breadcrumbs[location.pathname] || ''}
          </div>
          {isAdmin && location.pathname !== '/orcamentos' && (
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/usuarios')} className="flex items-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm bg-white">
                <UserPlus size={16} />
                Convidar Usuário
              </button>
              <button onClick={() => navigate('/orcamentos')} className="flex items-center gap-2 text-sm font-medium text-white bg-[#0071b4] px-5 py-2 rounded-lg hover:bg-[#005a91] transition shadow-lg shadow-blue-500/20 ring-1 ring-[#005a91]/50">
                <PlusCircle size={16} />
                Criar Proposta
              </button>
            </div>
          )}
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
