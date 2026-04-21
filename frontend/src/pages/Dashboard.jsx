import { useState, useEffect, useRef } from 'react'
import PlayerQRCode from '../components/QRCode'
import axios from 'axios'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import SortableItem from '../components/SortableItem'

const API = 'http://localhost:8000'
const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export default function Dashboard({ token, role, onLogout, onProfile }) {
  const [screens, setScreens]             = useState([])
  const [playlists, setPlaylists]         = useState([])
  const [driveFiles, setDriveFiles]       = useState([])
  const [driveConnected, setDriveConnected] = useState(false)
  const [selectedScreen, setSelectedScreen] = useState(null)
  const [newScreen, setNewScreen] = useState({ name: '', location: '', city: '' })
  const [weather, setWeather]             = useState(null)
  const [activeTab, setActiveTab]         = useState('screens')
  const [loading, setLoading]             = useState(false)
  const [schedules, setSchedules]         = useState({})
  const [openScheduleForm, setOpenScheduleForm] = useState(null)
  const [scheduleInput, setScheduleInput] = useState({ days: [], start_time: '08:00', end_time: '17:00' })
  const [groups, setGroups]               = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [newGroupName, setNewGroupName]   = useState('')
  const [citySuggestions, setCitySuggestions] = useState([])
  const [onlineScreens, setOnlineScreens]     = useState([])
  const citySearchTimer = useRef(null)

  const headers = { Authorization: `Bearer ${token}` }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  useEffect(() => {
    loadScreens()
    checkDriveStatus()
    if (window.location.search.includes('drive=connected')) {
      loadDriveFiles()
      window.history.replaceState({}, '', '/')
    }
    const pollOnline = async () => {
      try {
        const res = await axios.get(`${API}/screens/online-status`, { headers })
        setOnlineScreens(res.data.online)
      } catch {}
    }
    pollOnline()
    const interval = setInterval(pollOnline, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadScreens = async () => {
    try {
      const res = await axios.get(`${API}/screens/`, { headers })
      setScreens(res.data)
      const screenWithCity = res.data.find(s => s.city)
      if (screenWithCity) loadWeather(screenWithCity.city)
      else setWeather(null)
    } catch (err) {
      if (err.response?.status === 401) onLogout()
    }
  }

  const loadPlaylists = async () => {
    try {
      const res = await axios.get(`${API}/playlists/`, { headers })
      setPlaylists(res.data)
    } catch {}
  }

  const loadSchedules = async (playlistId) => {
    try {
      const res = await axios.get(`${API}/schedules/playlist/${playlistId}`, { headers })
      setSchedules(prev => ({ ...prev, [playlistId]: res.data }))
    } catch {}
  }

  const createSchedule = async (playlistId) => {
    if (scheduleInput.days.length === 0) return alert('Bitte mindestens einen Tag wählen.')
    try {
      await axios.post(`${API}/schedules/`, { playlist_id: playlistId, ...scheduleInput }, { headers })
      setOpenScheduleForm(null)
      setScheduleInput({ days: [], start_time: '08:00', end_time: '17:00' })
      loadSchedules(playlistId)
    } catch {}
  }

  const deleteSchedule = async (scheduleId, playlistId) => {
    await axios.delete(`${API}/schedules/${scheduleId}`, { headers })
    loadSchedules(playlistId)
  }

  const toggleScheduleDay = (day) => {
    setScheduleInput(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]
    }))
  }

  const searchCity = (value) => {
    setNewScreen(prev => ({ ...prev, city: value }))
    clearTimeout(citySearchTimer.current)
    if (value.length < 2) { setCitySuggestions([]); return }
    citySearchTimer.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/weather/search?q=${encodeURIComponent(value)}`, { headers })
        setCitySuggestions(res.data)
      } catch { setCitySuggestions([]) }
    }, 300)
  }

  const openPlaylistsTab = async () => {
    setActiveTab('playlists')
    const res = await axios.get(`${API}/playlists/`, { headers })
    setPlaylists(res.data)
    res.data.forEach(p => loadSchedules(p.id))
  }

  const loadGroups = async () => {
    try {
      const res = await axios.get(`${API}/groups/`, { headers })
      setGroups(res.data)
    } catch {}
  }

  const createGroup = async () => {
    if (!newGroupName.trim()) return
    await axios.post(`${API}/groups/`, { name: newGroupName }, { headers })
    setNewGroupName('')
    loadGroups()
  }

  const deleteGroup = async (id) => {
    if (!confirm('Gruppe löschen?')) return
    await axios.delete(`${API}/groups/${id}`, { headers })
    loadGroups()
    loadScreens()
  }

  const toggleScreenInGroup = async (groupId, screen) => {
    if (screen.group_id === groupId) {
      await axios.delete(`${API}/groups/${groupId}/screens/${screen.id}`, { headers })
    } else {
      await axios.post(`${API}/groups/${groupId}/screens/${screen.id}`, {}, { headers })
    }
    await Promise.all([loadGroups(), loadScreens()])
  }

  const createPlaylistWithFile = async (screenId, file, groupId = null) => {
    try {
      const existing = groupId
        ? playlists.find(p => p.group_id === groupId)
        : playlists.find(p => p.screen_id === screenId)

      if (existing) {
        await axios.post(`${API}/playlists/${existing.id}/items`, {
          file_id: file.file_id, name: file.name, duration: 10, type: file.type
        }, { headers })
        loadPlaylists()
        alert(`✅ "${file.name}" hinzugefügt!`)
      } else {
        const targetName = groupId
          ? groups.find(g => g.id === groupId)?.name
          : screens.find(s => s.id === screenId)?.name
        await axios.post(`${API}/playlists/`, {
          name: `Playlist - ${targetName}`,
          screen_id: groupId ? null : screenId,
          group_id: groupId || null,
          items: [{ file_id: file.file_id, name: file.name, duration: 10, type: file.type }]
        }, { headers })
        loadPlaylists()
        alert(`✅ Playlist erstellt mit "${file.name}"!`)
      }
    } catch {}
  }

      const loadWeather = async (city = null) => {
      if (!city) {
        setWeather(null)
        return
      }
      try {
        const res = await axios.get(`${API}/weather/${city}`, { headers })
        setWeather(res.data)
      } catch {}
    }

  const checkDriveStatus = async () => {
    try {
      const res = await axios.get(`${API}/drive/status`, { headers })
      setDriveConnected(res.data.connected)
      if (res.data.connected) loadDriveFiles()
    } catch {}
  }

  const loadDriveFiles = async () => {
    try {
      const res = await axios.get(`${API}/drive/files`, { headers })
      setDriveFiles(res.data)
      setDriveConnected(true)
    } catch {}
  }

  const connectDrive = async () => {
    try {
      const res = await axios.get(`${API}/drive/auth`, { headers })
      window.location.href = res.data.auth_url
    } catch {}
  }

  const createScreen = async () => {
    if (!newScreen.name) return
    setLoading(true)
    try {
      await axios.post(`${API}/screens/`, newScreen, { headers })
      setNewScreen({ name: '', location: '' })
      loadScreens()
    } finally { setLoading(false) }
  }

  const deleteScreen = async (id) => {
    if (!confirm('Screen löschen?')) return
    await axios.delete(`${API}/screens/${id}`, { headers })
    loadScreens()
  }



  const removeItem = async (playlistId, index) => {
    if (!confirm('Datei aus Playlist entfernen?')) return
    await axios.delete(`${API}/playlists/${playlistId}/items/${index}`, { headers })
    loadPlaylists()
  }

  const deletePlaylist = async (id) => {
    if (!confirm('Playlist löschen?')) return
    await axios.delete(`${API}/playlists/${id}`, { headers })
    loadPlaylists()
  }

  const handleDragEnd = async (event, playlist) => {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const oldIndex = playlist.items.findIndex((_, i) => `item-${i}` === active.id)
  const newIndex = playlist.items.findIndex((_, i) => `item-${i}` === over.id)

  if (oldIndex === -1 || newIndex === -1) return

  const newItems = arrayMove(playlist.items, oldIndex, newIndex)

  // SOFORT UI aktualisieren — ohne auf Backend zu warten
  setPlaylists(prev => prev.map(p =>
    p.id === playlist.id ? { ...p, items: newItems } : p
  ))

  // Backend im Hintergrund aktualisieren — kein await!
  axios.put(
    `${API}/playlists/${playlist.id}/items/reorder`,
    newItems,
    { headers }
  ).catch(() => {
    // Nur bei Fehler zurücksetzen
    loadPlaylists()
  })
}

const handleDurationChange = async (playlistId, itemIndex, duration) => {
  const playlist = playlists.find(p => p.id === playlistId)
  if (!playlist) return

  const newItems = playlist.items.map((item, i) =>
    i === itemIndex ? { ...item, duration } : item
  )

  // Sofort UI aktualisieren
  setPlaylists(prev => prev.map(p =>
    p.id === playlistId ? { ...p, items: newItems } : p
  ))

  // Backend aktualisieren
  axios.put(
    `${API}/playlists/${playlistId}/items/reorder`,
    newItems,
    { headers }
  ).catch(() => loadPlaylists())
}

  const tabStyle = (tab) => ({
    padding: '10px 20px',
    borderRadius: '8px',
    background: activeTab === tab ? '#4f9cf9' : 'transparent',
    color: activeTab === tab ? 'white' : '#666',
    cursor: 'pointer',
    border: 'none',
    fontWeight: activeTab === tab ? '600' : '400'
  })

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>

      {/* Navbar */}
      <div style={{
        background: '#1a1a2e', color: 'white',
        padding: '0 30px', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <h1 style={{ fontSize: '20px' }}>📺 Signage CMS</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {weather && weather.city && (
          <span style={{ fontSize: '14px', color: '#aaa' }}>
            🌤 {weather.city} {weather.temperature}°C {weather.description}
          </span>
        )}
          {role !== 'owner' && (
            <span style={{ background: role === 'editor' ? '#1565c0' : '#6a1b9a', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
              {role === 'editor' ? 'Editor' : 'Viewer'}
            </span>
          )}
          <button onClick={onProfile} style={{ background: '#4f9cf9', color: 'white' }}>
            👤 Profil
          </button>
          <button onClick={onLogout} style={{ background: '#e74c3c', color: 'white' }}>
            Abmelden
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        background: 'white', padding: '0 30px',
        display: 'flex', gap: '8px', alignItems: 'center',
        borderBottom: '1px solid #eee', height: '52px'
      }}>
        <button style={tabStyle('screens')} onClick={() => { setActiveTab('screens'); loadScreens(); }}>
          📺 Screens
        </button>
        <button style={tabStyle('drive')} onClick={() => { setActiveTab('drive'); loadDriveFiles(); }}>
          ☁️ Google Drive {driveConnected ? '✅' : ''}
        </button>
        <button style={tabStyle('playlists')} onClick={openPlaylistsTab}>
          🎬 Playlists
        </button>
        <button style={tabStyle('groups')} onClick={() => { setActiveTab('groups'); loadGroups(); loadScreens(); }}>
          👥 Gruppen
        </button>
      </div>

      <div style={{ padding: '30px', maxWidth: '960px', margin: '0 auto' }}>

        {/* ── SCREENS TAB ── */}
        {activeTab === 'screens' && (
          <>
            {role === 'viewer' && (
              <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '12px 18px', marginBottom: '20px', fontSize: '14px', color: '#795548' }}>
                👁 Du hast Viewer-Zugriff — du kannst Inhalte ansehen, aber nicht bearbeiten.
              </div>
            )}
            <div style={{
              background: 'white', borderRadius: '12px',
              padding: '24px', marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>➕ Neuen Screen anlegen</h2>
              {role !== 'owner' ? <p style={{ color: '#aaa', fontSize: '13px' }}>Nur der Owner kann Screens anlegen.</p> : null}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', display: role !== 'owner' ? 'none' : 'flex' }}>
                <input
                  placeholder="Name (z.B. Eingang)"
                  value={newScreen.name}
                  onChange={e => setNewScreen({ ...newScreen, name: e.target.value })}
                  style={{ flex: 1, minWidth: '180px' }}
                />
                <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
                  <input
                    placeholder="Stadt für Wetter (z.B. Wuppertal)"
                    value={newScreen.city}
                    onChange={e => searchCity(e.target.value)}
                    onBlur={() => setTimeout(() => setCitySuggestions([]), 150)}
                    style={{ width: '100%' }}
                  />
                  {citySuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: 'white', border: '1px solid #ddd', borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px'
                    }}>
                      {citySuggestions.map((c, i) => (
                        <div key={i}
                          onMouseDown={() => {
                            setNewScreen(prev => ({ ...prev, city: c.name }))
                            setCitySuggestions([])
                          }}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', fontSize: '14px',
                            borderBottom: i < citySuggestions.length - 1 ? '1px solid #f0f0f0' : 'none'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f5f8ff'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          <strong>{c.name}</strong>
                          <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>
                            {[c.state, c.country].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  placeholder="Standort (optional)"
                  value={newScreen.location}
                  onChange={e => setNewScreen({ ...newScreen, location: e.target.value })}
                  style={{ flex: 1, minWidth: '180px' }}
                />
                <button onClick={createScreen} disabled={loading}
                  style={{ background: '#4f9cf9', color: 'white', padding: '10px 20px' }}>
                  {loading ? '...' : 'Anlegen'}
                </button>
              </div>
            </div>

            <div style={{
              background: 'white', borderRadius: '12px',
              padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>
                📺 Meine Screens ({screens.length})
              </h2>
              {screens.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>
                  Noch keine Screens. Lege deinen ersten Screen an!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {screens.map(screen => (
                    <div key={screen.id} style={{
                      border: '1px solid #eee', borderRadius: '8px',
                      padding: '16px', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between'
                    }}>
                      <div>
                      <div style={{ fontWeight: '500', fontSize: '16px' }}>{screen.name}</div>
                      {screen.location && (
                        <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>
                          📍 {screen.location}
                        </div>
                      )}
                      {screen.city && (
                        <div style={{ color: '#888', fontSize: '13px', marginTop: '2px' }}>
                          🌤 {screen.city}
                        </div>
                      )}
                      {onlineScreens.includes(screen.id)
                        ? <span style={{ marginTop: '8px', display: 'inline-block', background: '#e8f5e9', color: '#2e7d32', padding: '2px 10px', borderRadius: '20px', fontSize: '12px' }}>● Online</span>
                        : <span style={{ marginTop: '8px', display: 'inline-block', background: '#f5f5f5', color: '#999', padding: '2px 10px', borderRadius: '20px', fontSize: '12px' }}>● Offline</span>
                      }
                    </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {role !== 'viewer' && (
                          <button
                            onClick={() => { setSelectedScreen(screen); setActiveTab('drive'); }}
                            style={{ background: '#4f9cf9', color: 'white' }}>
                            ➕ Inhalt hinzufügen
                          </button>
                        )}
                        {role === 'owner' && (
                          <button onClick={() => deleteScreen(screen.id)}
                            style={{ background: '#fce4ec', color: '#c62828' }}>🗑</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── GOOGLE DRIVE TAB ── */}
        {activeTab === 'drive' && (
          <div style={{
            background: 'white', borderRadius: '12px',
            padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px' }}>☁️ Google Drive Dateien</h2>
              {!driveConnected ? (
                <button onClick={connectDrive}
                  style={{ background: '#4285f4', color: 'white', padding: '10px 20px' }}>
                  🔗 Google Drive verbinden
                </button>
              ) : (
                <button onClick={loadDriveFiles}
                  style={{ background: '#e8f5e9', color: '#2e7d32', padding: '10px 20px' }}>
                  🔄 Aktualisieren
                </button>
              )}
            </div>

            {(selectedScreen || selectedGroup) && (
              <div style={{
                background: '#e8f5e9', borderRadius: '8px',
                padding: '12px 16px', marginBottom: '16px', fontSize: '14px'
              }}>
                {selectedGroup
                  ? <>👥 Dateien werden zu Gruppe <strong>"{selectedGroup.name}"</strong> hinzugefügt.</>
                  : <>✅ Dateien werden zu Screen <strong>"{selectedScreen.name}"</strong> hinzugefügt.</>
                }
                <button onClick={() => { setSelectedScreen(null); setSelectedGroup(null) }}
                  style={{ marginLeft: '12px', background: 'none', color: '#e74c3c', padding: '2px 8px' }}>
                  ✕ Abbrechen
                </button>
              </div>
            )}

            {!driveConnected ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>
                Verbinde dein Google Drive um Bilder und Videos zu nutzen.
              </p>
            ) : driveFiles.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>
                Keine Bilder oder Videos in Google Drive gefunden.
              </p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '16px'
              }}>
                {driveFiles.map(file => (
                  <div key={file.file_id} style={{
                    border: '1px solid #eee', borderRadius: '10px',
                    overflow: 'hidden', cursor: 'pointer',
                    transition: 'transform 0.2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {file.type === 'image' ? (
                      <img
                        src={`${API}/drive/media/${file.file_id}?token=${localStorage.getItem('token')}`}
                        alt={file.name}
                        style={{ width: '100%', height: '120px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '120px', background: '#f5f5f5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '40px'
                      }}>🎬</div>
                    )}
                    <div style={{ padding: '10px' }}>
                      <div style={{
                        fontSize: '12px', fontWeight: '500',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>{file.name}</div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                        {file.type === 'video' ? '🎬 Video' : '🖼 Bild'}
                      </div>
                      {(selectedScreen || selectedGroup) && (
                        <button
                          onClick={() => selectedGroup
                            ? createPlaylistWithFile(null, file, selectedGroup.id)
                            : createPlaylistWithFile(selectedScreen.id, file)
                          }
                          style={{
                            marginTop: '8px', width: '100%',
                            background: '#4f9cf9', color: 'white',
                            padding: '6px', borderRadius: '6px', fontSize: '12px'
                          }}>
                          ➕ Hinzufügen
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PLAYLISTS TAB ── */}
        {activeTab === 'playlists' && (
          <div style={{
            background: 'white', borderRadius: '12px',
            padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>🎬 Playlists</h2>
            {playlists.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>
                Noch keine Playlists. Gehe zu Screens → "Inhalt hinzufügen".
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {playlists.map(pl => (
                  <div key={pl.id} style={{
                    border: '1px solid #eee', borderRadius: '10px', padding: '20px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontWeight: '600', fontSize: '16px' }}>{pl.name}</div>
                          {pl.group_id && (
                            <span style={{ background: '#e8f0ff', color: '#4f9cf9', fontSize: '11px', padding: '2px 8px', borderRadius: '10px' }}>
                              👥 {pl.group_name}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
                          {pl.items.length} Datei(en)
                          {pl.screen_name && ` · ${pl.screen_name}`}
                          {pl.group_name && !pl.screen_name && ` · Gruppe: ${pl.group_name}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => {
                            if (pl.group_id) { setSelectedGroup(groups.find(g => g.id === pl.group_id)); setSelectedScreen(null) }
                            else { setSelectedScreen({ id: pl.screen_id }); setSelectedGroup(null) }
                            setActiveTab('drive')
                          }}
                          style={{ background: '#e8f5e9', color: '#2e7d32', padding: '8px 14px' }}>
                          ➕ Datei hinzufügen
                        </button>
                        {!pl.group_id && (
                          <button
                            onClick={() => {
                              const token = localStorage.getItem('token')
                              window.open(`http://localhost:8000/player/index.html?screen=${pl.screen_id}&token=${token}`, '_blank')
                            }}
                            style={{ background: '#4f9cf9', color: 'white', padding: '8px 14px' }}>
                            ▶ Player
                          </button>
                        )}
                        {pl.group_id && (
                          <button
                            onClick={() => {
                              const token = localStorage.getItem('token')
                              const group = groups.find(g => g.id === pl.group_id)
                              if (!group) return
                              group.screens.forEach(s =>
                                window.open(`http://localhost:8000/player/index.html?screen=${s.id}&token=${token}`, '_blank')
                              )
                            }}
                            style={{ background: '#4f9cf9', color: 'white', padding: '8px 14px' }}>
                            ▶ Alle Player
                          </button>
                        )}
                        {!pl.group_id && (
                          <PlayerQRCode
                            playlistId={pl.screen_id}
                            useScreen={true}
                            token={localStorage.getItem('token')}
                            screenName={pl.screen_name || pl.name}
                          />
                        )}
                        <button onClick={() => deletePlaylist(pl.id)}
                          style={{ background: '#fce4ec', color: '#c62828', padding: '8px 14px' }}>
                          🗑
                        </button>
                      </div>
                    </div>
                    {pl.items.length === 0 ? (
                      <p style={{ color: '#aaa', fontSize: '13px' }}>Keine Dateien in dieser Playlist.</p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => handleDragEnd(event, pl)}
                      >
                        <SortableContext
                          items={pl.items.map((_, i) => `item-${i}`)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {pl.items.map((item, index) => (
                              <SortableItem
                              key={`item-${index}`}
                              id={`item-${index}`}
                              item={item}
                              index={index}
                              onRemove={(i) => removeItem(pl.id, i)}
                              onDurationChange={(i, duration) => handleDurationChange(pl.id, i, duration)}
                              apiUrl={API}
                              token={localStorage.getItem('token')}
                            />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}

                    {/* ── Zeitplan ── */}
                    <div style={{ marginTop: '20px', borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>🕐 Zeitplan</span>
                        <button
                          onClick={() => { setOpenScheduleForm(pl.id); setScheduleInput({ days: [], start_time: '08:00', end_time: '17:00' }) }}
                          style={{ background: '#f0f4ff', color: '#4f9cf9', padding: '4px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #d0e4ff' }}>
                          ➕ Zeitplan hinzufügen
                        </button>
                      </div>

                      {/* Bestehende Zeitpläne */}
                      {(schedules[pl.id] || []).length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#aaa' }}>Kein Zeitplan – Playlist läuft immer (Standard).</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(schedules[pl.id] || []).map(s => (
                            <div key={s.id} style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              background: s.is_active ? '#f0f9ff' : '#f9f9f9',
                              borderRadius: '8px', padding: '8px 12px', fontSize: '13px'
                            }}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {DAY_LABELS.map((d, i) => (
                                  <span key={i} style={{
                                    padding: '2px 7px', borderRadius: '4px', fontSize: '11px',
                                    background: s.days.includes(i) ? '#4f9cf9' : '#eee',
                                    color: s.days.includes(i) ? 'white' : '#999'
                                  }}>{d}</span>
                                ))}
                              </div>
                              <span style={{ color: '#444' }}>{s.start_time} – {s.end_time}</span>
                              <button
                                onClick={() => deleteSchedule(s.id, pl.id)}
                                style={{ marginLeft: 'auto', background: 'none', color: '#e74c3c', padding: '2px 8px', fontSize: '13px' }}>
                                🗑
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Neuer Zeitplan Form */}
                      {openScheduleForm === pl.id && (
                        <div style={{
                          marginTop: '12px', background: '#f8f9ff',
                          borderRadius: '10px', padding: '16px',
                          border: '1px solid #e0e8ff'
                        }}>
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>Wochentage</div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {DAY_LABELS.map((d, i) => (
                                <button key={i} onClick={() => toggleScheduleDay(i)} style={{
                                  padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                                  background: scheduleInput.days.includes(i) ? '#4f9cf9' : '#eee',
                                  color: scheduleInput.days.includes(i) ? 'white' : '#555',
                                  border: 'none'
                                }}>{d}</button>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Von</div>
                              <input type="time" value={scheduleInput.start_time}
                                onChange={e => setScheduleInput(prev => ({ ...prev, start_time: e.target.value }))}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd' }} />
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Bis</div>
                              <input type="time" value={scheduleInput.end_time}
                                onChange={e => setScheduleInput(prev => ({ ...prev, end_time: e.target.value }))}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                              <button onClick={() => createSchedule(pl.id)}
                                style={{ background: '#4f9cf9', color: 'white', padding: '7px 16px', borderRadius: '6px', fontSize: '13px' }}>
                                Speichern
                              </button>
                              <button onClick={() => setOpenScheduleForm(null)}
                                style={{ background: '#eee', color: '#555', padding: '7px 16px', borderRadius: '6px', fontSize: '13px' }}>
                                Abbrechen
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── GRUPPEN TAB ── */}
        {activeTab === 'groups' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Gruppe erstellen */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>➕ Neue Gruppe</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  placeholder="Gruppenname (z.B. Alle Filialen)"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createGroup()}
                  style={{ flex: 1 }}
                />
                <button onClick={createGroup} style={{ background: '#4f9cf9', color: 'white', padding: '10px 20px' }}>
                  Erstellen
                </button>
              </div>
            </div>

            {/* Gruppen-Liste */}
            {groups.length === 0 ? (
              <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#888', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                Noch keine Gruppen. Erstelle deine erste Gruppe!
              </div>
            ) : groups.map(group => (
              <div key={group.id} style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

                {/* Gruppen-Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '18px' }}>👥 {group.name}</div>
                    <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>
                      {group.screens.length} Screen(s)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => { setSelectedGroup(group); setSelectedScreen(null); setActiveTab('drive'); }}
                      style={{ background: '#4f9cf9', color: 'white', padding: '8px 14px' }}>
                      ➕ Inhalt hinzufügen
                    </button>
                    <button onClick={() => deleteGroup(group.id)}
                      style={{ background: '#fce4ec', color: '#c62828', padding: '8px 14px' }}>
                      🗑
                    </button>
                  </div>
                </div>

                {/* Screen-Zuweisung */}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#444' }}>
                    Screens in dieser Gruppe:
                  </div>
                  {screens.length === 0 ? (
                    <p style={{ color: '#aaa', fontSize: '13px' }}>Keine Screens vorhanden.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {screens.map(screen => {
                        const inGroup = screen.group_id === group.id
                        return (
                          <div key={screen.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', borderRadius: '8px',
                            background: inGroup ? '#f0f9ff' : '#f9f9f9',
                            border: `1px solid ${inGroup ? '#bde0ff' : '#eee'}`
                          }}>
                            <div>
                              <span style={{ fontWeight: '500' }}>{screen.name}</span>
                              {screen.location && <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>📍 {screen.location}</span>}
                              {inGroup && <span style={{ marginLeft: '8px', background: '#4f9cf9', color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '10px' }}>✓ In Gruppe</span>}
                              {screen.group_id && screen.group_id !== group.id && (
                                <span style={{ marginLeft: '8px', color: '#f39c12', fontSize: '12px' }}>
                                  (in Gruppe "{groups.find(g => g.id === screen.group_id)?.name ?? '...'}")
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => toggleScreenInGroup(group.id, screen)}
                              style={{
                                background: inGroup ? '#fce4ec' : '#e8f5e9',
                                color: inGroup ? '#c62828' : '#2e7d32',
                                padding: '5px 12px', borderRadius: '6px', fontSize: '12px'
                              }}>
                              {inGroup ? 'Entfernen' : 'Hinzufügen'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}