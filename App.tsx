import React, { useState, createContext, useContext, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import StarBackground from './components/StarBackground';
import Dashboard from './pages/Dashboard';
import SignalBot from './pages/SignalBot';
import TradeLog from './pages/TradeLog';
import Performance from './pages/Performance';
import Auth from './pages/Auth';
import { authService, User } from './services/authService';
import { Home, Bot, ClipboardList, Settings, BarChart2, Menu, X, Bell, User as UserIcon, LogOut, Calendar } from 'lucide-react';

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// --- Components ---

const NavItem = ({ to, icon: Icon, label, active, mobile = false }: any) => (
  <Link 
    to={to} 
    className={`
      flex items-center transition-all duration-200
      ${mobile 
        ? 'flex-col justify-center gap-1 p-2 text-[10px]' 
        : 'gap-3 px-4 py-3 rounded-lg'
      }
      ${active 
        ? (mobile ? 'text-accent-primary' : 'bg-accent-primary text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]') 
        : 'text-text-secondary hover:text-white'
      }
      ${!mobile && !active ? 'hover:bg-navy-800' : ''}
    `}
  >
    <Icon size={mobile ? 24 : 20} className={mobile && active ? 'filter drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]' : ''} />
    <span className={`font-medium ${mobile ? '' : ''}`}>{label}</span>
    {mobile && active && <div className="w-1 h-1 rounded-full bg-accent-primary mt-1"></div>}
  </Link>
);

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  // If on auth pages, render children directly without dashboard layout
  if (location.pathname === '/signin' || location.pathname === '/signup') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex bg-navy-800 text-white font-sans relative pb-20 lg:pb-0">
      <StarBackground />
      
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-50 w-64 bg-navy-900 border-r border-border`}>
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-accent-primary bg-clip-text text-transparent">Yota</h1>
        </div>
        
        <nav className="p-4 space-y-2 flex-1">
          <NavItem to="/" label="Dashboard" icon={Home} active={location.pathname === '/'} />
          <NavItem to="/bot" label="Yota Agent" icon={Bot} active={location.pathname === '/bot'} />
          <NavItem to="/log" label="Trade Log" icon={ClipboardList} active={location.pathname === '/log'} />
          <NavItem to="/performance" label="Performance" icon={BarChart2} active={location.pathname === '/performance'} />
          <NavItem to="/settings" label="Settings" icon={Settings} active={location.pathname === '/settings'} />
        </nav>

        <div className="p-6 border-t border-border">
          <div className="bg-navy-800 rounded-xl p-4 border border-border mb-4">
            <p className="text-xs text-text-muted mb-2">My Plan</p>
            <div className="flex justify-between items-end">
               <span className="font-bold text-accent-primary">{user?.plan || 'PRO'} Tier</span>
               <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded">Active</span>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-sm px-2">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Slide-out Menu */}
      <div className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)}>
        <div className={`absolute left-0 top-0 bottom-0 w-[80%] max-w-[320px] bg-navy-900 shadow-2xl transition-transform duration-300 transform flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
           <div className="p-6 border-b border-border flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white">Yota</h1>
              <button onClick={() => setSidebarOpen(false)} className="text-text-secondary"><X size={24}/></button>
           </div>
           <nav className="p-4 space-y-4 flex-1">
              <NavItem to="/" label="Dashboard" icon={Home} active={location.pathname === '/'} />
              <NavItem to="/bot" label="Yota Agent" icon={Bot} active={location.pathname === '/bot'} />
              <NavItem to="/log" label="Trade Log" icon={ClipboardList} active={location.pathname === '/log'} />
              <NavItem to="/performance" label="Performance" icon={BarChart2} active={location.pathname === '/performance'} />
              <NavItem to="/settings" label="Settings" icon={Settings} active={location.pathname === '/settings'} />
           </nav>
           <div className="p-6 border-t border-border">
              <button onClick={logout} className="flex items-center gap-2 text-danger font-medium">
                <LogOut size={20} /> Sign Out
              </button>
           </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 relative z-10 flex flex-col min-h-screen transition-all duration-300">
        {/* Responsive Header */}
        <header className="h-16 bg-navy-900/80 backdrop-blur-md border-b border-border sticky top-0 px-4 md:px-6 flex justify-between items-center z-40">
           <div className="flex items-center gap-4">
             <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-text-secondary p-1"><Menu size={24} /></button>
             <div className="lg:hidden text-lg font-bold bg-gradient-to-r from-white to-accent-primary bg-clip-text text-transparent">Yota</div>
             <div className="hidden lg:flex items-center gap-2 text-sm text-text-muted">
               <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
               Solana Network Active
             </div>
           </div>

           <div className="flex items-center gap-4 md:gap-6">
              <div className="relative cursor-pointer p-1">
                 <Bell size={20} className="text-text-secondary hover:text-white transition-colors" />
                 <span className="absolute top-0 right-0 w-2 h-2 bg-accent-primary rounded-full"></span>
              </div>
              <div className="hidden md:flex items-center gap-3 border-l border-border pl-6">
                 <div className="text-right">
                    <p className="text-sm font-bold">{user?.name || 'User'}</p>
                    <p className="text-xs text-text-muted">{user?.email || 'user@yota.app'}</p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg border-2 border-navy-800">
                    <UserIcon size={20} />
                 </div>
              </div>
              <div className="md:hidden w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg">
                  <UserIcon size={16} />
              </div>
           </div>
        </header>

        <div className="flex-1 overflow-x-hidden">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-navy-900/95 backdrop-blur-lg border-t border-border h-16 pb-safe z-50 lg:hidden flex justify-around items-center px-2">
         <NavItem to="/" label="Home" icon={Home} active={location.pathname === '/'} mobile />
         <NavItem to="/bot" label="Agent" icon={Bot} active={location.pathname === '/bot'} mobile />
         <NavItem to="/log" label="Logs" icon={ClipboardList} active={location.pathname === '/log'} mobile />
         <NavItem to="/performance" label="Stats" icon={BarChart2} active={location.pathname === '/performance'} mobile />
         <NavItem to="/settings" label="Profile" icon={UserIcon} active={location.pathname === '/settings'} mobile />
      </div>
    </div>
  );
};

// Placeholder for missing pages
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="p-10 text-center flex flex-col items-center justify-center h-full text-text-muted min-h-[60vh]">
    <div className="w-24 h-24 bg-navy-700 rounded-full flex items-center justify-center mb-6 border border-border">
      <Settings className="animate-spin-slow" size={40}/>
    </div>
    <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
    <p>This module is currently under development.</p>
  </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/signin" element={<Auth />} />
        <Route path="/signup" element={<Auth />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/bot" element={
          <ProtectedRoute>
            <SignalBot />
          </ProtectedRoute>
        } />
        <Route path="/log" element={
          <ProtectedRoute>
            <TradeLog />
          </ProtectedRoute>
        } />
        <Route path="/performance" element={
          <ProtectedRoute>
            <Performance />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <PlaceholderPage title="Settings" />
          </ProtectedRoute>
        } />
      </Routes>
    </AppLayout>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(authService.getCurrentUser());

  const login = (newUser: User) => {
    setUser(newUser);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      <Router>
        <AppContent />
      </Router>
    </AuthContext.Provider>
  );
};

export default App;
