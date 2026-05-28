import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Package,
  Upload,
  Users,
  Settings,
  LogOut,
  PlusCircle,
  UserPlus,
  User,
  Menu,
  X,
} from 'lucide-react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userMetadata, setUserMetadata] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserMetadata(data.user.user_metadata);
        setUserEmail(data.user.email);
      }
    });
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  const isAdmin = userMetadata?.role === 'admin';

  const adminMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/orcamentos', icon: FileText, label: 'Criar Orçamentos' },
    { path: '/propostas', icon: ClipboardList, label: 'Todos os Orçamentos' },
    { path: '/dashboard/catalogo', icon: Package, label: 'Catálogo de Produtos' },
    { path: '/dashboard/catalogo/upload', icon: Upload, label: 'Importar Lote CSV' },
    { path: '/usuarios', icon: Users, label: 'Gerenciar Equipe' },
  ];

  const repMenuItems = [
    { path: '/orcamentos', icon: FileText, label: 'Novo Orçamento' },
    { path: '/propostas', icon: ClipboardList, label: 'Meus Orçamentos' },
    { path: '/perfil', icon: User, label: 'Meu Perfil' },
  ];

  const finalMenuItems = isAdmin ? adminMenuItems : repMenuItems;

  const breadcrumbs = {
    '/dashboard': 'Visão Geral do Painel',
    '/dashboard/catalogo': 'Catálogo de Produtos',
    '/dashboard/catalogo/upload': 'Importação de Dados',
    '/usuarios': 'Gerenciamento de Equipe',
    '/orcamentos': isAdmin ? 'Criar Orçamentos' : 'Novo Orçamento',
    '/propostas': isAdmin ? 'Todos os Orçamentos' : 'Meus Orçamentos',
    '/perfil': 'Perfil e Preferências',
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-gray-900">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-40 shadow-sm
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <img src="https://i.imgur.com/8AtT4EC.png" alt="Multivac" className="h-9 w-auto object-contain" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">
            {isAdmin ? 'Navegação Principal' : 'Menu'}
          </div>
          {finalMenuItems.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/dashboard' && item.path !== '/orcamentos' && item.path !== '/propostas' && item.path !== '/dashboard/catalogo');
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
          <p className="mt-3 text-center text-[11px] text-gray-300 select-none">v1.3.0</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:ml-64 min-h-screen relative overflow-x-hidden">

        {/* Topbar */}
        <header className="h-14 lg:h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <span className="text-sm text-gray-500 font-medium truncate">
              {breadcrumbs[location.pathname] || ''}
            </span>
          </div>
          {isAdmin && location.pathname !== '/orcamentos' && (
            <div className="flex items-center gap-2 lg:gap-4">
              <button onClick={() => navigate('/usuarios')} className="flex items-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 px-3 lg:px-4 py-2 rounded-lg hover:bg-gray-50 transition shadow-sm bg-white">
                <UserPlus size={16} />
                <span className="hidden sm:inline">Convidar Usuário</span>
              </button>
              <button onClick={() => navigate('/orcamentos')} className="flex items-center gap-2 text-sm font-medium text-white bg-[#0071b4] px-3 lg:px-5 py-2 rounded-lg hover:bg-[#005a91] transition shadow-lg shadow-blue-500/20 ring-1 ring-[#005a91]/50">
                <PlusCircle size={16} />
                <span className="hidden sm:inline">Criar Proposta</span>
              </button>
            </div>
          )}
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
