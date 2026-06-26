import { useCallback, useEffect, useRef, useState } from 'react'

const WS_URL = import.meta.env.DEV
  ? 'ws://localhost:8000/ws/plates'
  : `ws://${window.location.host}/ws/plates`

export function usePlateSocket() {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [lastDetection, setLastDetection] = useState(null)
  const [recentDetections, setRecentDetections] = useState([])
  const [lastAction, setLastAction] = useState(null)
  const [recentEntries, setRecentEntries] = useState([])

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)

      ws.onclose = () => {
        setConnected(false)
        setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Existing plate detection messages
          if (data.event === 'plate_detected') {
            setLastDetection(data)
            setRecentDetections((prev) => [data, ...prev.slice(0, 4)])
            return
          }

          // New action message types
          switch (data.type) {
            case 'auto_entry': {
              const entry = {
                type: 'auto_entry',
                plate: data.plate,
                is_abonado: data.is_abonado ?? false,
                ticket_id: data.ticket_id,
                timestamp: new Date().toISOString(),
              }
              setLastAction(entry)
              setRecentEntries((prev) => [entry, ...prev.slice(0, 4)])
              break
            }

            case 'exit_confirmed': {
              const action = {
                type: 'exit_confirmed',
                plate: data.plate,
                ticket_id: data.ticket_id,
                amount: data.amount,
                timestamp: new Date().toISOString(),
              }
              setLastAction(action)
              break
            }

            case 'payment_expired': {
              const action = {
                type: 'payment_expired',
                plate: data.plate,
                ticket_id: data.ticket_id,
                timestamp: new Date().toISOString(),
              }
              setLastAction(action)
              break
            }

            default:
              break
          }
        } catch {
          // ignore malformed messages
        }
      }
    } catch {
      setTimeout(connect, 3000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  return { connected, lastDetection, recentDetections, lastAction, recentEntries }
}
