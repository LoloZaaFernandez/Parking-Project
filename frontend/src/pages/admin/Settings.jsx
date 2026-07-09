import { useEffect, useState } from 'react'
import { apiFetch } from '../../api'

function Feedback({ feedback }) {
  if (!feedback) return null
  return (
    <div className={`rounded-lg px-3 py-2.5 text-sm border ${
      feedback.type === 'success'
        ? 'bg-green-500/10 border-green-500/30 text-green-400'
        : 'bg-red-500/10 border-red-500/30 text-red-400'
    }`}>
      {feedback.msg}
    </div>
  )
}

export default function Settings() {
  const [rate, setRate] = useState('')
  const [savedRate, setSavedRate] = useState(null)

  const [cameraUrl, setCameraUrl] = useState('')
  const [cameraUser, setCameraUser] = useState('')
  const [cameraPass, setCameraPass] = useState('')
  const [savedCamera, setSavedCamera] = useState(null)

  const [printerName, setPrinterName] = useState('')
  const [savedPrinterName, setSavedPrinterName] = useState(null)

  const [loading, setLoading] = useState(true)
  const [savingRate, setSavingRate] = useState(false)
  const [savingCamera, setSavingCamera] = useState(false)
  const [savingPrinter, setSavingPrinter] = useState(false)
  const [testingPrinter, setTestingPrinter] = useState(false)
  const [rateFeedback, setRateFeedback] = useState(null)
  const [cameraFeedback, setCameraFeedback] = useState(null)
  const [printerFeedback, setPrinterFeedback] = useState(null)

  useEffect(() => {
    apiFetch('/settings/')
      .then((data) => {
        setSavedRate(data.rate_per_hour)
        setRate(String(data.rate_per_hour))
        const cam = { url: data.camera_url ?? '', user: data.camera_user ?? '', pass: data.camera_pass ?? '' }
        setSavedCamera(cam)
        setCameraUrl(cam.url)
        setCameraUser(cam.user)
        setCameraPass(cam.pass)
        setSavedPrinterName(data.printer_name ?? '')
        setPrinterName(data.printer_name ?? '')
      })
      .catch(() => setRateFeedback({ type: 'error', msg: 'No se pudo cargar la configuración' }))
      .finally(() => setLoading(false))
  }, [])

  async function handleSaveRate(e) {
    e.preventDefault()
    const parsed = parseFloat(rate)
    if (isNaN(parsed) || parsed <= 0) {
      setRateFeedback({ type: 'error', msg: 'Ingresá un valor válido mayor a 0' })
      return
    }
    setSavingRate(true)
    setRateFeedback(null)
    try {
      const data = await apiFetch('/settings/', {
        method: 'PUT',
        body: JSON.stringify({ rate_per_hour: parsed }),
      })
      setSavedRate(data.rate_per_hour)
      setRate(String(data.rate_per_hour))
      setRateFeedback({ type: 'success', msg: 'Tarifa guardada correctamente' })
    } catch {
      setRateFeedback({ type: 'error', msg: 'No se pudo guardar la tarifa' })
    } finally {
      setSavingRate(false)
    }
  }

  async function handleSaveCamera(e) {
    e.preventDefault()
    if (!cameraUrl.trim()) {
      setCameraFeedback({ type: 'error', msg: 'La URL de la cámara no puede estar vacía' })
      return
    }
    setSavingCamera(true)
    setCameraFeedback(null)
    try {
      const data = await apiFetch('/settings/', {
        method: 'PUT',
        body: JSON.stringify({
          camera_url: cameraUrl.trim(),
          camera_user: cameraUser.trim(),
          camera_pass: cameraPass,
        }),
      })
      const cam = { url: data.camera_url, user: data.camera_user, pass: data.camera_pass }
      setSavedCamera(cam)
      setCameraFeedback({ type: 'success', msg: 'Cámara reconfigurada y reconectada' })
    } catch {
      setCameraFeedback({ type: 'error', msg: 'No se pudo guardar la configuración de cámara' })
    } finally {
      setSavingCamera(false)
    }
  }

  async function handleSavePrinter(e) {
    e.preventDefault()
    setSavingPrinter(true)
    setPrinterFeedback(null)
    try {
      const data = await apiFetch('/settings/', {
        method: 'PUT',
        body: JSON.stringify({ printer_name: printerName.trim() }),
      })
      setSavedPrinterName(data.printer_name)
      setPrinterFeedback({ type: 'success', msg: 'Impresora guardada' })
    } catch {
      setPrinterFeedback({ type: 'error', msg: 'No se pudo guardar la impresora' })
    } finally {
      setSavingPrinter(false)
    }
  }

  async function handleTestPrint() {
    setTestingPrinter(true)
    setPrinterFeedback(null)
    try {
      await apiFetch('/settings/test-print', { method: 'POST' })
      setPrinterFeedback({ type: 'success', msg: 'Ticket de prueba enviado — revisá la impresora' })
    } catch (err) {
      setPrinterFeedback({ type: 'error', msg: err?.detail ?? 'No se pudo imprimir' })
    } finally {
      setTestingPrinter(false)
    }
  }

  const isRateDirty = rate !== String(savedRate)
  const isCameraDirty = savedCamera
    ? cameraUrl !== savedCamera.url || cameraUser !== savedCamera.user || cameraPass !== savedCamera.pass
    : false
  const isPrinterDirty = printerName !== savedPrinterName

  const inputClass = `w-full bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5
    text-sm text-white placeholder-gray-600
    focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors`

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-lg font-semibold">Configuración</h2>

      {loading ? (
        <div className="text-gray-500 text-sm">Cargando…</div>
      ) : (
        <>
          {/* ── Tarifas ── */}
          <div className="bg-[#1a1d27] rounded-xl p-6 border border-gray-800 space-y-5">
            <h3 className="text-sm font-medium text-gray-300">Tarifas</h3>
            <form onSubmit={handleSaveRate} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  Tarifa por hora
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm font-medium select-none">S/</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={rate}
                    onChange={(e) => { setRate(e.target.value); setRateFeedback(null) }}
                    className="w-36 bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2.5
                               text-sm text-white focus:outline-none focus:border-blue-500
                               focus:ring-1 focus:ring-blue-500/30 transition-colors"
                  />
                  <span className="text-gray-500 text-sm">por hora</span>
                </div>
                {savedRate !== null && (
                  <p className="text-gray-600 text-xs mt-1.5">Valor actual: S/ {savedRate.toFixed(2)}</p>
                )}
              </div>
              <Feedback feedback={rateFeedback} />
              <button
                type="submit"
                disabled={savingRate || !isRateDirty}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40
                           text-white text-sm font-semibold rounded-lg transition-colors
                           disabled:cursor-not-allowed"
              >
                {savingRate ? 'Guardando…' : 'Guardar tarifa'}
              </button>
            </form>
          </div>

          {/* ── Cámara ── */}
          <div className="bg-[#1a1d27] rounded-xl p-6 border border-gray-800 space-y-5">
            <h3 className="text-sm font-medium text-gray-300">Cámara IP</h3>
            <form onSubmit={handleSaveCamera} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  URL del stream MJPEG
                </label>
                <input
                  type="text"
                  value={cameraUrl}
                  onChange={(e) => { setCameraUrl(e.target.value); setCameraFeedback(null) }}
                  placeholder="http://192.168.1.100:85/cgi/mjpg/mjpeg.cgi"
                  className={inputClass}
                />
                <p className="text-gray-600 text-xs mt-1">
                  TRENDnet TV-IP121WN: <span className="font-mono">http://IP:85/cgi/mjpg/mjpeg.cgi</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Usuario
                  </label>
                  <input
                    type="text"
                    value={cameraUser}
                    onChange={(e) => { setCameraUser(e.target.value); setCameraFeedback(null) }}
                    placeholder="admin"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={cameraPass}
                    onChange={(e) => { setCameraPass(e.target.value); setCameraFeedback(null) }}
                    placeholder="••••••"
                    className={inputClass}
                  />
                </div>
              </div>
              <Feedback feedback={cameraFeedback} />
              <button
                type="submit"
                disabled={savingCamera || !isCameraDirty}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40
                           text-white text-sm font-semibold rounded-lg transition-colors
                           disabled:cursor-not-allowed"
              >
                {savingCamera ? 'Guardando…' : 'Guardar y reconectar'}
              </button>
            </form>
          </div>

          {/* ── Impresora ── */}
          <div className="bg-[#1a1d27] rounded-xl p-6 border border-gray-800 space-y-5">
            <h3 className="text-sm font-medium text-gray-300">Impresora de tickets</h3>
            <form onSubmit={handleSavePrinter} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  Nombre en Windows
                </label>
                <input
                  type="text"
                  value={printerName}
                  onChange={(e) => { setPrinterName(e.target.value); setPrinterFeedback(null) }}
                  placeholder="EPSON TM-T20II Receipt"
                  className={inputClass}
                />
                <p className="text-gray-600 text-xs mt-1">
                  Tal cual aparece en "Dispositivos e impresoras" de Windows.
                </p>
              </div>
              <Feedback feedback={printerFeedback} />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingPrinter || !isPrinterDirty}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40
                             text-white text-sm font-semibold rounded-lg transition-colors
                             disabled:cursor-not-allowed"
                >
                  {savingPrinter ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={testingPrinter || !savedPrinterName}
                  className="px-5 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700/40
                             text-white text-sm font-semibold rounded-lg transition-colors
                             disabled:cursor-not-allowed"
                >
                  {testingPrinter ? 'Imprimiendo…' : 'Imprimir prueba'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
