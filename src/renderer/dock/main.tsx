import { createRoot } from 'react-dom/client'
import { followSystemTheme } from '../design'
import '../design/styles'
import { App } from './App'
import { startController } from './controller'

document.body.classList.add('al-app')
followSystemTheme()
startController()
createRoot(document.getElementById('root') as HTMLElement).render(<App />)
