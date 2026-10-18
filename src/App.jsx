import { useMemo, useState } from 'react';
import { Bug, Info, Search, SlidersHorizontal, X } from 'lucide-react';
import { galleryImages, popularTags } from './data/gallery';
import GalleryCanvas from './components/GalleryCanvas';
import PhotoModal from './components/PhotoModal';
import InfoModal from './components/InfoModal';

const featuredTags = ['sky', 'insects', 'flowers'];

function App() {
  const [activeTag, setActiveTag] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredImages = useMemo(() => galleryImages.filter((image) => {
    const tagMatch = !activeTag || image.tags.includes(activeTag);
    const searchMatch = !query || `${image.description} ${image.tags.join(' ')} ${image.subject ?? ''} ${image.mood ?? ''} ${image.dominantColors.join(' ')}`.toLowerCase().includes(query.toLowerCase());
    return tagMatch && searchMatch;
  }), [activeTag, query]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="header-left">
          <div className="brand-block">
            <div className="brand-mark"><Bug size={16} strokeWidth={2.25}/></div>
            <h1>Wonder Field</h1>
          </div>
          <section className="filterbar" aria-label="Gallery filters">
            <div className="popular-filters">
              <div className="category-filters">
                <button className={!activeTag ? 'filter-chip active' : 'filter-chip'} onClick={() => setActiveTag(null)}>All moments</button>
                {featuredTags.filter((tag) => popularTags.includes(tag)).map((tag) => <button key={tag} className={activeTag === tag ? 'filter-chip active' : 'filter-chip'} onClick={() => setActiveTag(tag)}>#{tag}</button>)}
              </div>
            </div>
            <button className={`filter-toggle ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="all-tag-filters">
              <SlidersHorizontal size={15}/> Filters{activeTag ? ` · #${activeTag}` : ''}
            </button>
            {filtersOpen && <div id="all-tag-filters" className="filter-popover">
              <div className="filter-popover-heading"><span>All tags</span>
                <button onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={16}/></button>
              </div>
              <div className="all-tag-filters">
                <button className={!activeTag ? 'filter-chip active' : 'filter-chip'} onClick={() => {
                  setActiveTag(null);
                  setFiltersOpen(false);
                }}>All moments
                </button>
                {popularTags.map((tag) => <button key={tag} className={activeTag === tag ? 'filter-chip active' : 'filter-chip'} onClick={() => {
                  setActiveTag(tag);
                  setFiltersOpen(false);
                }}>#{tag}</button>)}
              </div>
            </div>}
          </section>
        </div>

        <div className="header-actions">
          <div className={`search-wrap ${searchOpen ? 'is-open' : ''}`}>
            {searchOpen && <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search moments" aria-label="Search moments"/>}
            <button className="icon-button" onClick={() => {
              setSearchOpen(!searchOpen);
              if (searchOpen) setQuery('');
            }} aria-label={searchOpen ? 'Close search' : 'Search'}>
              {searchOpen ? <X size={18}/> : <Search size={18}/>}
            </button>
          </div>
          <button className="info-button" onClick={() => setInfoOpen(true)}><Info size={17}/> <span>About this place</span></button>
        </div>
      </header>

      <GalleryCanvas images={filteredImages} onSelect={setSelectedImage}/>
      <footer className="canvas-caption"><span><strong>{filteredImages.length}</strong> moments</span><span>drag to explore <i>·</i> scroll to zoom</span><a href="https://antwan.eu" target="_blank" rel="noreferrer">Created by Antwan</a></footer>
      <PhotoModal image={selectedImage} onClose={() => setSelectedImage(null)}/>
      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)}/>
    </main>
  );
}

export default App;
