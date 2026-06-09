import { useState } from 'react'
import Monitor from './pages/Monitor'
import Cashier from './pages/Cashier'
import History from './pages/History'

const TABS = [
  { id: 'monitor', label: 'Monitor' },
  { id: 'cashier', label: 'Caja' },
  { id: 'history', label: 'Historial' },
]

export default function App() {
  const [active, setActive] = useState('monitor')

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      <nav className="bg-[#1a1d27] border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
          <span className="text-blue-400 font-bold text-base tracking-tight select-none">
            🅿 ParkingLPR
          </span>
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  active === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {active === 'monitor' && <Monitor />}
        {active === 'cashier' && <Cashier />}
        {active === 'history' && <History />}
      </main>
    </div>
  )
}
