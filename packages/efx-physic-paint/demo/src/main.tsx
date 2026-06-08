import { render } from 'preact'
import { App } from './App'
import './styles.css'

const ROOT_MOUNT_ERROR = 'Unable to mount standalone paint demo: #app root not found'

function mountDemo() {
  const root = document.getElementById('app')

  if (!root) {
    const error = document.createElement('p')
    error.className = 'demo-error'
    error.textContent = ROOT_MOUNT_ERROR
    document.body.append(error)
    return
  }

  render(<App />, root)
}

mountDemo()
