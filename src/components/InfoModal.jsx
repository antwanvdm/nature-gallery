import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

function InfoModal({open, onClose}) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="info-modal" role="dialog" aria-modal="true" aria-labelledby="info-title">
      <button ref={closeButtonRef} className="photo-modal-close" onClick={onClose} aria-label="Close information"><X size={21}/></button>
      <h2 id="info-title">About this place</h2>
      <p>I wanted a place to share my nature photography without going back to Instagram. Wonder Field is where the small, beautiful things I notice outside can live together, on their own terms.</p>
      <p className="my-2">It is also a way to bring back my former <strong>#skyporn</strong> collection, alongside a more recent fascination with insects, flowers, and the everyday wonder they hold.</p>
      <p>Every photograph here was taken with my phone: older images with a OnePlus 5 or OnePlus 8T, and newer ones with my current OnePlus 12.</p>
      <p className="tech-note"><strong>A small experiment:</strong> I used the OpenAI Vision API (via gpt-6-luna) to generate the textual details and related tags for each photograph. It is a practical way to organize the photographs, evaluate the quality of AI for this use case, and use matching background colours behind each photograph in CSS.</p>
      <div className="modal-signoff">Wonder Field <span>·</span> <a href="https://antwan.eu" target="_blank" rel="noreferrer" aria-label="Open Antwans portfolio website (opens in a new tab)">Created by Antwan</a></div>
    </section>
  </div>;
}

export default InfoModal;
