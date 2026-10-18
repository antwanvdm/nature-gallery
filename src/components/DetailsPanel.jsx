import { X } from 'lucide-react';

function DetailsPanel({image, onClose}) {
  if (!image) return null;
  return <aside className="details-panel" aria-label="Image details">
    <button className="panel-close" onClick={onClose} aria-label="Close details"><X size={19}/></button>
    <div className="panel-image"><img src={image.fullSrc} alt={image.description}/></div>
    <div className="panel-content">
      <p className="eyebrow">A moment in nature</p>
      <p className="panel-description">{image.description}</p>
      <div className="panel-tags">{image.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
    </div>
  </aside>;
}

export default DetailsPanel;
