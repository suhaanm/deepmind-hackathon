// STUB — owned by DESIGN after .scaffold-ready
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { startController } from './controller'

startController()
createRoot(document.getElementById('root') as HTMLElement).render(<App />)
