import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

export default function PlayerQRCode({ playlistId, token, screenName, useScreen = false }) {
  const [show, setShow] = useState(false)

  const param     = useScreen ? 'screen' : 'playlist'
  const playerUrl = `http://localhost:8000/player/index.html?${param}=${playlistId}&token=${token}`

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        style={{
          background: '#f0f2f5', color: '#333',
          padding: '8px 14px', borderRadius: '8px',
          border: 'none', cursor: 'pointer', fontSize: '13px'
        }}>
        📱 QR-Code
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}
      onClick={() => setShow(false)}
    >
      <div style={{
        background: 'white', borderRadius: '16px',
        padding: '32px', textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: '8px', fontSize: '18px' }}>
          📺 {screenName}
        </h3>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
          QR-Code scannen um den Player zu öffnen
        </p>

        <div style={{
          padding: '16px', background: 'white',
          borderRadius: '12px', display: 'inline-block',
          border: '1px solid #eee'
        }}>
          <QRCodeSVG
            value={playerUrl}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>

        <div style={{
          marginTop: '16px', padding: '10px 16px',
          background: '#f0f2f5', borderRadius: '8px',
          fontSize: '11px', color: '#888',
          wordBreak: 'break-all', maxWidth: '280px'
        }}>
          {playerUrl}
        </div>

        <button
          onClick={() => setShow(false)}
          style={{
            marginTop: '20px', background: '#e74c3c',
            color: 'white', padding: '10px 24px',
            borderRadius: '8px', border: 'none',
            cursor: 'pointer', fontSize: '14px'
          }}>
          Schließen
        </button>
      </div>
    </div>
  )
}