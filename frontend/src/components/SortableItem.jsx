import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export default function SortableItem({ id, item, index, onRemove, onDurationChange, apiUrl, token }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: isDragging ? '#e8f0fe' : '#f8f9fa',
        borderRadius: '8px',
        padding: '10px 14px',
        border: isDragging ? '2px dashed #4f9cf9' : '2px solid transparent',
      }}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab',
          color: '#ccc',
          fontSize: '18px',
          padding: '0 4px',
          userSelect: 'none'
        }}
      >
        ⠿
      </div>

      {/* Thumbnail */}
      <img
        src={`${apiUrl}/drive/media/${item.file_id}?token=${token}`}
        alt={item.name}
        style={{
          width: '60px', height: '40px',
          objectFit: 'cover', borderRadius: '6px'
        }}
      />

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: '500' }}>
          {item.name || item.file_id.slice(0, 12) + '...'}
        </div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
          {item.type === 'video' ? '🎬 Video' : '🖼 Bild'}
        </div>
      </div>

      {/* Anzeigedauer */}
      {item.type !== 'video' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>⏱</span>
          <select
            value={item.duration || 10}
            onChange={e => onDurationChange(index, parseInt(e.target.value))}
            style={{
              border: '1px solid #ddd', borderRadius: '6px',
              padding: '4px 8px', fontSize: '12px',
              background: 'white', cursor: 'pointer'
            }}
          >
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={15}>15s</option>
            <option value={20}>20s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>
        </div>
      )}

      {/* Position */}
      <div style={{
        background: '#e8f0fe', color: '#1a73e8',
        borderRadius: '20px', padding: '2px 10px', fontSize: '12px'
      }}>
        #{index + 1}
      </div>

      {/* Löschen */}
      <button
        onClick={() => onRemove(index)}
        style={{
          background: '#fce4ec', color: '#c62828',
          padding: '6px 10px', borderRadius: '6px',
          border: 'none', cursor: 'pointer'
        }}
      >
        🗑
      </button>
    </div>
  )
}