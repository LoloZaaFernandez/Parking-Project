import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Monitor from './pages/Monitor'
import Cashier from './pages/Cashier'
import History from './pages/History'
import Reports from './pages/admin/Reports'
import Settings from './pages/admin/Settings'
import Abonados from './pages/admin/Abonados'
import Account from './pages/Account'

// Tab definitions per role
const CASHIER_TABS = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'cashier', label: 'Caja' },
  { id: 'account', label: 'Mi cuenta' },
]

const ADMIN_TABS = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'cashier', label: 'Caja' },
  { id: 'history', label: 'Historial' },
  { id: 'abonados', label: 'Abonados' },
  { id: 'reports', label: 'Reportes' },
  { id: 'settings', label: 'Configuración' },
  { id: 'account', label: 'Mi cuenta' },
]

function MainApp() {
  const { user, isAdmin, logout } = useAuth()
  const tabs = isAdmin ? ADMIN_TABS : CASHIER_TABS
  const [active, setActive] = useState('monitor')

  // If the current active tab is not available for this role, reset to monitor
  const validTab = tabs.find((t) => t.id === active) ? active : 'monitor'

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <nav className="bg-[#1a1d27] border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
          {/* Logo */}
          <span className="text-blue-400 font-bold text-base tracking-tight select-none shrink-0">
            🅿 ParkingLPR
          </span>

          {/* Tabs */}
          <div className="flex gap-1 flex-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                  validTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-white font-medium leading-none">{user?.username}</p>
              <p className="text-xs text-gray-500 leading-none mt-0.5">
                {isAdmin ? 'Administrador' : 'Cajero'}
              </p>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700
                         rounded transition-colors border border-gray-700 hover:border-gray-600"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {validTab === 'monitor'   && <Monitor />}
        {validTab === 'cashier'   && <Cashier />}
        {validTab === 'history'   && isAdmin && <History />}
        {validTab === 'abonados'  && isAdmin && <Abonados />}
        {validTab === 'reports'   && isAdmin && <Reports />}
        {validTab === 'settings'  && isAdmin && <Settings />}
        {validTab === 'account'   && <Account />}
      </main>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Cargando…</div>
      </div>
    )
  }

  if (!user) return <Login />

  return <MainApp />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
