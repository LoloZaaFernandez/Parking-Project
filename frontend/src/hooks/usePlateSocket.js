import { useCallback, useEffect, useRef, useState } from 'react'

const WS_URL = 'ws://localhost:8000/ws/plates'

export function usePlateSocket() {
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [lastDetection, setLastDetection] = useState(null)
  const [recentDetections, setRecentDetections] = useState([])

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
          if (data.event === 'plate_detected') {
            setLastDetection(data)
            setRecentDetections((prev) => [data, ...prev.slice(0, 4)])
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

  return { connected, lastDetection, recentDetections }
}
