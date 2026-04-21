import { useState } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function Login({ onLogin, onSwitch }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const form = new URLSearchParams()
      form.append('username', email)
      form.append('password', password)
      const res = await axios.post(`${API}/auth/login`, form)
      onLogin(res.data.access_token)
    } catch {
      setError('Falsche E-Mail oder Passwort')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#1a1a2e'
    }}>
      <div style={{
        background: 'white', borderRadius: '12px',
        padding: '40px', width: '360px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2)'
      }}>
        <h1 style={{ marginBottom: '8px', fontSize: '24px' }}>📺 Signage</h1>
        <p style={{ color: '#888', marginBottom: '28px', fontSize: '14px' }}>
          CMS Dashboard
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />

          {error && (
            <p style={{ color: '#e74c3c', fontSize: '13px' }}>{error}</p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              background: '#4f9cf9', color: 'white',
              padding: '12px', fontSize: '15px', borderRadius: '8px',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Einloggen...' : 'Einloggen'}
          </button>

          <button onClick={onSwitch} style={{
            background: 'transparent', color: '#4f9cf9',
            padding: '8px', fontSize: '14px'
          }}>
            Noch kein Konto? Registrieren
          </button>
        </div>
      </div>
    </div>
  )
}