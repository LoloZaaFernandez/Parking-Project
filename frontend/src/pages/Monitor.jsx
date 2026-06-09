import { useEffect, useState } from 'react'
import CameraFeed from '../components/CameraFeed'
import PlateDisplay from '../components/PlateDisplay'
import { usePlateSocket } from '../hooks/usePlateSocket'

const API = 'http://localhost:8000'

function StatusDot({ active }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${active ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className={active ? 'text-green-400' : 'text-red-400'}>
        {active ? 'Sistema activo' : 'Desconectado'}
      </span>
    </span>
  )
}

export default function Monitor() {
  const { connected, lastDetection, recentDetections } = usePlateSocket()
  const [capturing, setCapturing] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (lastDetection) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 1800)
      return () => clearTimeout(t)
    }
  }, [lastDetection])

  const handleCapture = async () => {
    setCapturing(true)
    try {
      const res = await fetch(`${API}/entry/`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.detail ?? 'Error al capturar')
      }
    } catch {
      alert('No se pudo conectar con el servidor')
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* ── Main feed ──────────────────────────────────────────────────── */}
      <section className="lg:col-span-2 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Feed en vivo</h2>
          <StatusDot active={connected} />
        </div>

        <CameraFeed className="aspect-video w-full" />

        <button
          onClick={handleCapture}
          disabled={capturing}
          className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800
                     disabled:opacity-50 font-semibold text-sm transition-colors"
        >
          {capturing ? 'Capturando…' : '📷 Capturar ahora'}
        </button>
      </section>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="flex flex-col gap-6">

        {/* Last detection */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Última detección
          </h3>
          <div
            className={`bg-[#1a1d27] rounded-xl p-5 text-center transition-all duration-300 ${
              flash ? 'ring-2 ring-green-500/70 bg-green-900/10' : ''
            }`}
          >
            {lastDetection ? (
              <>
                <PlateDisplay plate={lastDetection.plate} size="xl" animate={flash} />
                <p className="text-gray-500 text-xs mt-3">
                  {new Date(lastDetection.timestamp + 'Z').toLocaleTimeString('es-PE')}
                </p>
                {lastDetection.confidence && (
                  <p className="text-gray-600 text-xs mt-1">
                    Confianza {Math.round(lastDetection.confidence * 100)}%
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-600 text-sm py-4">Sin detecciones aún</p>
            )}
          </div>
        </div>

        {/* Recent list */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Últimas detecciones
          </h3>
          <div className="flex flex-col gap-2">
            {recentDetections.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-6">—</p>
            ) : (
              recentDetections.map((d, i) => (
                <div
                  key={i}
                  className="bg-[#1a1d27] rounded-lg px-4 py-3 flex items-center justify-between"
                >
                  <span className="bg-yellow-300 text-black font-mono font-black text-sm
                                   px-2 py-0.5 rounded border border-black tracking-wider">
                    {d.plate}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {new Date(d.timestamp + 'Z').toLocaleTimeString('es-PE')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </aside>
    </div>
  )
}
