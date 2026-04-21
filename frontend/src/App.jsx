import { useState, useEffect } from 'react'
import axios from 'axios'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'

const API = 'http://localhost:8000'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [role, setRole]   = useState(localStorage.getItem('role') || 'owner')
  const [page, setPage]   = useState(
    window.location.search.includes('from=profile') ? 'profile' : 'dashboard'
  )

  const inviteToken = new URLSearchParams(window.location.search).get('invite')

  useEffect(() => {
    if (token) {
      axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          setRole(res.data.role)
          localStorage.setItem('role', res.data.role)
        })
        .catch(() => handleLogout())
    }
  }, [token])

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setPage('dashboard')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    setToken(null)
    setRole('owner')
    setPage('login')
  }

  if (!token) {
    if (inviteToken) return <Register onSwitch={() => setPage('login')} inviteToken={inviteToken} onLogin={handleLogin} />
    if (page === 'register') return <Register onSwitch={() => setPage('login')} onLogin={handleLogin} />
    return <Login onLogin={handleLogin} onSwitch={() => setPage('register')} />
  }

  if (page === 'profile') return <Profile token={token} role={role} onLogout={handleLogout} onBack={() => setPage('dashboard')} />
  return <Dashboard token={token} role={role} onLogout={handleLogout} onProfile={() => setPage('profile')} />
}

export default App
