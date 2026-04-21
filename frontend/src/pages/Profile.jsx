import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function Profile({ token, role, onLogout, onBack }) {
  const [user, setUser]               = useState(null)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [message, setMessage]         = useState('')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [driveConnected, setDriveConnected] = useState(false)
  const [weatherKey, setWeatherKey]   = useState('')
  const [settingsMsg, setSettingsMsg] = useState('')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushMsg, setPushMsg]         = useState('')
  const [members, setMembers]         = useState([])
  const [inviteRole, setInviteRole]   = useState('editor')
  const [inviteLink, setInviteLink]   = useState('')
  const [teamMsg, setTeamMsg]         = useState('')

  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    loadProfile()
    loadSettings()
    checkPushStatus()
    if (role === 'owner') loadMembers()
    if (window.location.search.includes('drive=connected')) {
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const checkPushStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    setPushEnabled(!!sub)
  }

  const togglePush = async () => {
    setPushMsg('')
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushMsg('Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.')
      return
    }
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()

    if (existing) {
      await existing.unsubscribe()
      await axios.delete(`${API}/notifications/unsubscribe`, { headers })
      setPushEnabled(false)
      setPushMsg('Push-Benachrichtigungen deaktiviert.')
    } else {
      const { data } = await axios.get(`${API}/notifications/vapid-public-key`)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.public_key),
      })
      await axios.post(`${API}/notifications/subscribe`, sub.toJSON(), { headers })
      setPushEnabled(true)
      setPushMsg('Push-Benachrichtigungen aktiviert! ✅')
    }
    setTimeout(() => setPushMsg(''), 3000)
  }

  const testPush = async () => {
    try {
      await axios.post(`${API}/notifications/test`, {}, { headers })
      setPushMsg('Testbenachrichtigung gesendet!')
    } catch { setPushMsg('Fehler beim Senden.') }
    setTimeout(() => setPushMsg(''), 3000)
  }

  const loadMembers = async () => {
    try {
      const res = await axios.get(`${API}/team/members`, { headers })
      setMembers(res.data)
    } catch {}
  }

  const createInvite = async () => {
    try {
      const res = await axios.post(`${API}/team/invite`, { role: inviteRole }, { headers })
      setInviteLink(res.data.invite_url)
    } catch { setTeamMsg('Fehler beim Erstellen des Links') }
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
    setTeamMsg('Link kopiert! ✅')
    setTimeout(() => setTeamMsg(''), 3000)
  }

  const changeMemberRole = async (userId, newRole) => {
    try {
      await axios.put(`${API}/team/members/${userId}`, { role: newRole }, { headers })
      setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m))
    } catch {}
  }

  const removeMember = async (userId) => {
    if (!confirm('Mitglied wirklich entfernen?')) return
    try {
      await axios.delete(`${API}/team/members/${userId}`, { headers })
      setMembers(prev => prev.filter(m => m.id !== userId))
    } catch {}
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64)
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
  }

  const loadProfile = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`, { headers })
      setUser(res.data)
    } catch {}
  }

  const loadSettings = async () => {
    try {
      const res = await axios.get(`${API}/auth/me/settings`, { headers })
      setDriveConnected(res.data.drive_connected)
      setWeatherKey(res.data.openweather_key || '')
    } catch {}
  }

  const saveWeatherKey = async () => {
    try {
      await axios.put(`${API}/auth/me/settings`, { openweather_key: weatherKey }, { headers })
      setSettingsMsg('✅ Gespeichert!')
      setTimeout(() => setSettingsMsg(''), 3000)
    } catch { setSettingsMsg('Fehler beim Speichern') }
  }

  const connectDrive = async () => {
    try {
      const res = await axios.get(`${API}/drive/auth`, { headers })
      window.location.href = res.data.auth_url
    } catch {}
  }

  const disconnectDrive = async () => {
    if (!confirm('Google Drive wirklich trennen?')) return
    try {
      await axios.delete(`${API}/drive/disconnect`, { headers })
      setDriveConnected(false)
    } catch {}
  }

  const updatePassword = async () => {
    setError('')
    setMessage('')

    if (!oldPassword || !newPassword) {
      setError('Bitte alle Felder ausfüllen')
      return
    }
    if (newPassword !== confirmPw) {
      setError('Neue Passwörter stimmen nicht überein')
      return
    }
    if (newPassword.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen haben')
      return
    }

    setLoading(true)
    try {
      await axios.put(`${API}/auth/me/password`, {
        old_password: oldPassword,
        new_password: newPassword
      }, { headers })
      setMessage('✅ Passwort erfolgreich geändert!')
      setOldPassword('')
      setNewPassword('')
      setConfirmPw('')
    } catch (e) {
      setError(e.response?.data?.detail || 'Fehler beim Ändern des Passworts')
    } finally {
      setLoading(false)
    }
  }

  const deleteAccount = async () => {
    if (!confirm('Account wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) return
    if (!confirm('Bist du sicher? Alle Screens und Playlists werden gelöscht!')) return
    try {
      await axios.delete(`${API}/auth/me`, { headers })
      onLogout()
    } catch {}
  }

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>

      {/* Navbar */}
      <div style={{
        background: '#1a1a2e', color: 'white',
        padding: '0 30px', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <h1 onClick={onBack} style={{ fontSize: '20px', cursor: 'pointer' }}>📺 Signage CMS</h1>
        <button onClick={onLogout} style={{ background: '#e74c3c', color: 'white' }}>
          Abmelden
        </button>
      </div>

      <div style={{ padding: '30px', maxWidth: '600px', margin: '0 auto' }}>

        {/* Profil Info */}
        <div style={{
          background: 'white', borderRadius: '12px',
          padding: '24px', marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ marginBottom: '20px', fontSize: '18px' }}>👤 Mein Profil</h2>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: '#4f9cf9', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', color: 'white', fontWeight: 'bold'
            }}>
              {user.email[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '16px' }}>{user.email}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ color: '#888', fontSize: '13px' }}>
                  Mitglied seit {new Date(user.created_at).toLocaleDateString('de-DE')}
                </span>
                <span style={{ background: role === 'owner' ? '#e8f5e9' : role === 'editor' ? '#e3f2fd' : '#f3e5f5', color: role === 'owner' ? '#2e7d32' : role === 'editor' ? '#1565c0' : '#6a1b9a', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                  {role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : 'Viewer'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Passwort ändern */}
        <div style={{
          background: 'white', borderRadius: '12px',
          padding: '24px', marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ marginBottom: '20px', fontSize: '18px' }}>🔐 Passwort ändern</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              placeholder="Aktuelles Passwort"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="Neues Passwort (min. 6 Zeichen)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="Neues Passwort bestätigen"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
            />

            {error && <p style={{ color: '#e74c3c', fontSize: '13px' }}>{error}</p>}
            {message && <p style={{ color: '#2e7d32', fontSize: '13px' }}>{message}</p>}

            <button
              onClick={updatePassword}
              disabled={loading}
              style={{
                background: '#4f9cf9', color: 'white',
                padding: '12px', borderRadius: '8px',
                opacity: loading ? 0.7 : 1
              }}>
              {loading ? 'Wird geändert...' : 'Passwort ändern'}
            </button>
          </div>
        </div>

        {/* Google Drive */}
        <div style={{
          background: 'white', borderRadius: '12px',
          padding: '24px', marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ marginBottom: '8px', fontSize: '18px' }}>☁️ Google Drive</h2>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
            Verbinde dein Google Drive um Bilder und Videos zu nutzen.
          </p>
          {driveConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '6px 14px', borderRadius: '20px', fontSize: '13px' }}>
                ✅ Verbunden
              </span>
              <button onClick={disconnectDrive} style={{ background: '#fce4ec', color: '#c62828', padding: '8px 16px', borderRadius: '8px' }}>
                Trennen
              </button>
            </div>
          ) : (
            <button onClick={connectDrive} style={{ background: '#4285f4', color: 'white', padding: '10px 20px', borderRadius: '8px' }}>
              🔗 Google Drive verbinden
            </button>
          )}
        </div>

        {/* OpenWeather API Key */}
        <div style={{
          background: 'white', borderRadius: '12px',
          padding: '24px', marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ marginBottom: '8px', fontSize: '18px' }}>🌤 Wetter API-Key</h2>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
            Kostenlosen Key auf <a href="https://openweathermap.org/api" target="_blank" rel="noreferrer" style={{ color: '#4f9cf9' }}>openweathermap.org</a> erstellen → "Current Weather Data" → API key kopieren.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              placeholder="z.B. a1b2c3d4e5f6..."
              value={weatherKey}
              onChange={e => setWeatherKey(e.target.value)}
              style={{ flex: 1, fontFamily: 'monospace', fontSize: '13px' }}
            />
            <button onClick={saveWeatherKey} style={{ background: '#4f9cf9', color: 'white', padding: '10px 20px', borderRadius: '8px' }}>
              Speichern
            </button>
          </div>
          {settingsMsg && <p style={{ color: '#2e7d32', fontSize: '13px', marginTop: '10px' }}>{settingsMsg}</p>}
        </div>

        {/* Team */}
        {role === 'owner' && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h2 style={{ marginBottom: '8px', fontSize: '18px' }}>👥 Team</h2>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
              Lade Mitglieder ein. Editors können Playlists bearbeiten, Viewers können nur zuschauen.
            </p>

            {/* Einladungslink erstellen */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button onClick={createInvite} style={{ background: '#4f9cf9', color: 'white', padding: '10px 20px', borderRadius: '8px' }}>
                🔗 Einladungslink erstellen
              </button>
            </div>

            {inviteLink && (
              <div style={{ background: '#f0f7ff', border: '1px solid #4f9cf9', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all', color: '#333', marginBottom: '8px' }}>{inviteLink}</div>
                <button onClick={copyInviteLink} style={{ background: '#4f9cf9', color: 'white', padding: '6px 14px', borderRadius: '6px', fontSize: '13px' }}>
                  📋 Kopieren
                </button>
                {teamMsg && <span style={{ color: '#2e7d32', fontSize: '13px', marginLeft: '10px' }}>{teamMsg}</span>}
              </div>
            )}

            {/* Mitgliederliste */}
            {members.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f9f9f9', borderRadius: '8px' }}>
                    <span style={{ fontSize: '14px' }}>{m.email}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select value={m.role} onChange={e => changeMemberRole(m.id, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button onClick={() => removeMember(m.id)} style={{ background: '#fce4ec', color: '#c62828', padding: '4px 10px', borderRadius: '6px', fontSize: '13px' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {members.length === 0 && <p style={{ color: '#aaa', fontSize: '13px' }}>Noch keine Teammitglieder.</p>}
          </div>
        )}

        {/* Push-Benachrichtigungen */}
        <div style={{
          background: 'white', borderRadius: '12px',
          padding: '24px', marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ marginBottom: '8px', fontSize: '18px' }}>🔔 Push-Benachrichtigungen</h2>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
            Erhalte eine Benachrichtigung, wenn ein Player die Verbindung trennt.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={togglePush}
              style={{
                background: pushEnabled ? '#fce4ec' : '#4f9cf9',
                color: pushEnabled ? '#c62828' : 'white',
                padding: '10px 20px', borderRadius: '8px'
              }}>
              {pushEnabled ? '🔕 Deaktivieren' : '🔔 Aktivieren'}
            </button>
            {pushEnabled && (
              <button onClick={testPush} style={{ background: '#f5f5f5', color: '#333', padding: '10px 20px', borderRadius: '8px' }}>
                Test senden
              </button>
            )}
          </div>
          {pushMsg && <p style={{ color: '#2e7d32', fontSize: '13px', marginTop: '10px' }}>{pushMsg}</p>}
        </div>

        {/* Danger Zone */}
        <div style={{
          background: 'white', borderRadius: '12px',
          padding: '24px', border: '1px solid #fce4ec',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ marginBottom: '8px', fontSize: '18px', color: '#c62828' }}>
            ⚠️ Danger Zone
          </h2>
          <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
            Account löschen — diese Aktion kann nicht rückgängig gemacht werden!
          </p>
          <button
            onClick={deleteAccount}
            style={{
              background: '#e74c3c', color: 'white',
              padding: '10px 20px', borderRadius: '8px'
            }}>
            🗑 Account löschen
          </button>
        </div>

      </div>
    </div>
  )
}