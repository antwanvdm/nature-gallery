import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

function PhotoModal({ image, onClose }) {
  const [lens, setLens] = useState(null)

  useEffect(() => {
    if (!image) return undefined
    const handleKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [image, onClose])

  if (!image) return null

  const updateLens = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width)
    const y = Math.min(Math.max(event.clientY - bounds.top, 0), bounds.height)
    setLens({ x, y, width: bounds.width, height: bounds.height })
  }

  const startTouchZoom = (event) => {
    if (event.pointerType === 'touch') event.currentTarget.setPointerCapture(event.pointerId)
    updateLens(event)
  }

  const stopTouchZoom = (event) => {
    if (event.pointerType !== 'touch') return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setLens(null)
  }

  return <div className="photo-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="photo-modal" role="dialog" aria-modal="true" aria-label="Photo details">
      <button className="photo-modal-close" onClick={onClose} aria-label="Close photo"><X size={21} /></button>
      <div className="photo-modal-content">
      <div className="photo-modal-image-wrap">
        <div className="photo-zoom-area" onPointerDown={startTouchZoom} onPointerMove={updateLens} onPointerLeave={() => setLens(null)} onPointerUp={stopTouchZoom} onPointerCancel={stopTouchZoom}>
          <img className="photo-modal-image" src={image.fullSrc} alt={image.description} />
          {lens && <div className="photo-magnifier" aria-hidden="true" style={{ left: lens.x, top: lens.y, backgroundImage: `url(${image.fullSrc})`, backgroundPosition: `${(lens.x / lens.width) * 100}% ${(lens.y / lens.height) * 100}%`, backgroundSize: `${lens.width * 2.8}px ${lens.height * 2.8}px` }} />}
          {!lens && <span className="photo-zoom-hint"><Search size={15} /> Hover to zoom</span>}
        </div>
      </div>
      <div className="photo-modal-details">
        <div className="photo-modal-info">
          <p className="photo-modal-description">{image.description}</p>
          {image.subject && <div className="photo-modal-field"><span>Subject</span><strong>{image.subject}</strong></div>}
          {image.mood && <div className="photo-modal-field"><span>Mood &amp; light</span><strong>{image.mood}</strong></div>}
          {image.dominantColors.length > 0 && <div className="photo-modal-field"><span>Colours</span><div className="photo-modal-colors">{image.dominantColors.map((color, index) => <span key={`${color}-${index}`} className="photo-modal-color" style={{ backgroundColor: color }} title={color} aria-label={color} />)}</div></div>}
          <div className="photo-modal-meta">
            <div className="panel-tags">{image.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          </div>
        </div>
        {image.tags.length > 0 && <p className="photo-modal-disclaimer">* Descriptions and details are AI-generated as an experiment and may be inaccurate.</p>}
      </div>
      </div>
    </section>
  </div>
}

export default PhotoModal
