// STUB — owned by DESIGN after .scaffold-ready
import { useEffect, useState } from 'react'
import type { CompanionState } from '../../shared/protocol'

export function App() {
  const [state, setState] = useState<CompanionState | null>(null)
  const [last, setLast] = useState<string>('')

  useEffect(() => {
    void window.alongside.getState().then(setState)
    return window.alongside.onState(setState)
  }, [])

  const pointAt = async () => {
    const result = await window.alongside.live.toolCall({ name: 'point_at', args: { target: 'Start call button' } })
    setLast(JSON.stringify(result))
  }

  return (
    <div style={{ font: '18px system-ui', padding: 12 }}>
      <div style={{ WebkitAppRegion: 'drag', fontWeight: 600, paddingBottom: 8 } as React.CSSProperties}>Alongside (stub)</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => window.alongside.wakeDetected({ personaId: 'marcus', source: 'button' })}>Hey Marcus</button>
        <button onClick={pointAt}>point_at</button>
        <button onClick={() => window.alongside.pressStop()}>Stop</button>
      </div>
      {last && <p>{last}</p>}
      <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto' }}>{JSON.stringify(state, null, 2)}</pre>
    </div>
  )
}
