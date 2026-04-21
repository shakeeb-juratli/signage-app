import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function Register({ onSwitch, inviteToken, onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [inviteInfo, setInviteInfo] = useState(null)
  const [inviteInvalid, setInviteInvalid] = useState(false)

  useEffect(() => {
    if (!inviteToken) return
    axios.get(`${API}/team/invite/${inviteToken}`)
      .then(res => setInviteInfo(res.data))
      .catch(() => setInviteInvalid(true))
  }, [inviteToken])

  const roleLabel = { editor: 'Editor', viewer: 'Viewer' }

  const handleRegister = async () => {
    setError('')
    if (!email || !password) { setError('Bitte alle Felder ausfüllen'); return }
    if (password !== confirm) { setError('Passwörter stimmen nicht überein'); return }
    if (password.length < 6) { setError('Passwort muss mindestens 6 Zeichen haben'); return }

    setLoading(true)
    try {
      if (inviteToken) {
        await axios.post(`${API}/team/invite/${inviteToken}/accept`, { email, password })
        const form = new URLSearchParams()
        form.append('username', email)
        form.append('password', password)
        const res = await axios.post(`${API}/auth/login`, form)
        window.history.replaceState({}, '', '/')
        onLogin(res.data.access_token)
      } else {
        await axios.post(`${API}/auth/register`, { email, password })
        setSuccess(true)
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'Registrierung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  if (inviteInvalid) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1a1a2e' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', width: '360px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <h2 style={{ marginBottom: '8px' }}>Einladung ungültig</h2>
          <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>Der Link ist abgelaufen oder bereits verwendet worden.</p>
          <button onClick={onSwitch} style={{ background: '#4f9cf9', color: 'white', width: '100%', padding: '12px', borderRadius: '8px' }}>Zum Login</button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1a1a2e' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', width: '360px', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <h2 style={{ marginBottom: '8px' }}>Registrierung erfolgreich!</h2>
          <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>Du kannst dich jetzt einloggen.</p>
          <button onClick={onSwitch} style={{ background: '#4f9cf9', color: 'white', width: '100%', padding: '12px', borderRadius: '8px', fontSize: '15px' }}>Zum Login</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1a1a2e' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '40px', width: '360px', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }}>
        <h1 style={{ marginBottom: '8px', fontSize: '24px' }}>📺 Signage</h1>
        {inviteInfo ? (
          <p style={{ color: '#888', marginBottom: '28px', fontSize: '14px' }}>
            Du wurdest von <strong>{inviteInfo.owner_email}</strong> als <strong>{roleLabel[inviteInfo.role] || inviteInfo.role}</strong> eingeladen.
          </p>
        ) : (
          <p style={{ color: '#888', marginBottom: '28px', fontSize: '14px' }}>Neues Konto erstellen</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input type="email" placeholder="E-Mail" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Passwort (min. 6 Zeichen)" value={password} onChange={e => setPassword(e.target.value)} />
          <input type="password" placeholder="Passwort bestätigen" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRegister()} />

          {error && <p style={{ color: '#e74c3c', fontSize: '13px' }}>{error}</p>}

          <button onClick={handleRegister} disabled={loading} style={{ background: '#4f9cf9', color: 'white', padding: '12px', fontSize: '15px', borderRadius: '8px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Wird registriert...' : (inviteToken ? 'Einladung annehmen' : 'Registrieren')}
          </button>

          {!inviteToken && (
            <button onClick={onSwitch} style={{ background: 'transparent', color: '#4f9cf9', padding: '8px', fontSize: '14px' }}>
              Bereits ein Konto? Einloggen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
