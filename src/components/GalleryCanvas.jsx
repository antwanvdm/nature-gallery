import { useEffect, useMemo, useRef, useState } from 'react';

const GAP = 12;
const CELL_SIZE = 176;
const MODULE_SIZE = 3;

const modulePatterns = [
  [[0, 0, 2, 2], [2, 0, 1, 2], [0, 2, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1]],
  [[0, 0, 1, 2], [1, 0, 2, 2], [0, 2, 1, 1], [1, 2, 1, 1], [2, 2, 1, 1]],
  [[0, 0, 2, 1], [2, 0, 1, 1], [0, 1, 2, 2], [2, 1, 1, 1], [2, 2, 1, 1]],
  [[0, 0, 1, 1], [1, 0, 2, 1], [0, 1, 1, 1], [1, 1, 2, 2], [0, 2, 1, 1]],
];

const createLayout = (images) => {
  if (!images.length) return {images: [], bounds: null, tileWidth: 0, tileHeight: 0};

  const completeModuleCount = Math.floor(images.length / 5);
  const moduleColumns = Math.max(1, Math.ceil(Math.sqrt(completeModuleCount || 1)));
  const moduleRows = Math.ceil(completeModuleCount / moduleColumns);
  const centerModule = Math.floor(moduleRows / 2) * moduleColumns + Math.floor(moduleColumns / 2);
  const moduleOrder = Array.from({length: completeModuleCount}, (_, index) => index)
    .sort((a, b) => Math.hypot(a % moduleColumns - centerModule % moduleColumns, Math.floor(a / moduleColumns) - Math.floor(centerModule / moduleColumns))
      - Math.hypot(b % moduleColumns - centerModule % moduleColumns, Math.floor(b / moduleColumns) - Math.floor(centerModule / moduleColumns)));
  const positioned = [];

  moduleOrder.forEach((moduleIndex, order) => {
    const moduleX = moduleIndex % moduleColumns;
    const moduleY = Math.floor(moduleIndex / moduleColumns);
    const pattern = modulePatterns[moduleIndex % modulePatterns.length];
    const imagesInModule = images.slice(order * 5, order * 5 + 5);

    pattern.forEach(([x, y, width, height], index) => {
      const image = imagesInModule[index];
      const left = moduleX * MODULE_SIZE * (CELL_SIZE + GAP) + x * (CELL_SIZE + GAP);
      const top = moduleY * MODULE_SIZE * (CELL_SIZE + GAP) + y * (CELL_SIZE + GAP);
      positioned.push({
        ...image,
        left,
        top,
        width: width * CELL_SIZE + (width - 1) * GAP,
        height: height * CELL_SIZE + (height - 1) * GAP,
      });
    });
  });

  // A partial filtered set uses a compact square grid rather than leaving interior holes.
  images.slice(completeModuleCount * 5).forEach((image, index) => {
    const columns = Math.ceil(Math.sqrt(images.length - completeModuleCount * 5));
    positioned.push({
      ...image,
      left: index % columns * (CELL_SIZE + GAP),
      top: moduleRows * MODULE_SIZE * (CELL_SIZE + GAP) + Math.floor(index / columns) * (CELL_SIZE + GAP),
      width: CELL_SIZE,
      height: CELL_SIZE,
    });
  });

  const anchor = positioned[0];
  const centeredImages = positioned.map((image) => ({
    ...image,
    position: {
      x: image.left + image.width / 2 - (anchor.left + anchor.width / 2),
      y: image.top + image.height / 2 - (anchor.top + anchor.height / 2),
    },
  }));
  const bounds = centeredImages.reduce((result, image) => ({
    left: Math.min(result.left, image.position.x - image.width / 2),
    right: Math.max(result.right, image.position.x + image.width / 2),
    top: Math.min(result.top, image.position.y - image.height / 2),
    bottom: Math.max(result.bottom, image.position.y + image.height / 2),
  }), {left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity});

  return {images: centeredImages, bounds, tileWidth: bounds.right - bounds.left, tileHeight: bounds.bottom - bounds.top};
};

function GalleryCanvas({images, onSelect}) {
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const viewRef = useRef({x: 0, y: 0, scale: 0.72});
  const dragRef = useRef(null);
  const homeViewRef = useRef(viewRef.current);
  const frameRef = useRef(null);
  const [view, setView] = useState(viewRef.current);
  const [viewport, setViewport] = useState({width: 0, height: 0});
  const [isPositioned, setIsPositioned] = useState(false);

  const updateView = (nextView) => {
    viewRef.current = nextView;
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setView(viewRef.current);
    });
  };

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return undefined;
    const resize = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setViewport({width, height});
      updateView({...viewRef.current, x: width / 2, y: height / 2});
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, []);

  // Shuffle each gallery instance so every photo can become the center anchor on refresh.
  const shuffledImages = useMemo(() => [...images]
    .map((image) => ({image, order: Math.random()}))
    .sort((a, b) => a.order - b.order)
    .map(({image}) => image), [images]);
  const layout = useMemo(() => createLayout(shuffledImages), [shuffledImages]);
  const positionedImages = layout.images;

  useEffect(() => {
    if (!viewport.width || !viewport.height || !positionedImages.length) return;
    const firstImage = positionedImages[0];
    const centeredView = {
      ...viewRef.current,
      x: viewport.width / 2 - firstImage.position.x * viewRef.current.scale,
      y: viewport.height / 2 - firstImage.position.y * viewRef.current.scale,
    };
    homeViewRef.current = centeredView;
    viewRef.current = centeredView;
    setView(centeredView);
    setIsPositioned(true);
  }, [images, positionedImages, viewport.width, viewport.height]);

  const constrainView = (nextView) => {
    if (!viewport.width || !viewport.height || !positionedImages.length) return nextView;
    const {bounds} = layout;
    const padding = 84;
    const minX = viewport.width - padding - bounds.right * nextView.scale;
    const maxX = padding - bounds.left * nextView.scale;
    const minY = viewport.height - padding - bounds.bottom * nextView.scale;
    const maxY = padding - bounds.top * nextView.scale;
    const home = homeViewRef.current;

    return {
      ...nextView,
      x: minX > maxX ? home.x : Math.min(maxX, Math.max(minX, nextView.x)),
      y: minY > maxY ? home.y : Math.min(maxY, Math.max(minY, nextView.y)),
    };
  };

  const visibleImages = useMemo(() => {
    const padding = 360;
    return positionedImages.filter((image) => {
      const screenX = view.x + image.position.x * view.scale;
      const screenY = view.y + image.position.y * view.scale;
      const halfWidth = (image.width * view.scale) / 2 + padding;
      const halfHeight = (image.height * view.scale) / 2 + padding;
      return screenX > -halfWidth && screenX < viewport.width + halfWidth && screenY > -halfHeight && screenY < viewport.height + halfHeight;
    });
  }, [positionedImages, view, viewport]);

  const onPointerDown = (event) => {
    if (!isPositioned) return;
    const current = viewRef.current;
    dragRef.current = {pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: current.x, startY: current.y, moved: false, captured: false};
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 5) {
      drag.moved = true;
      if (!drag.captured) {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.captured = true;
      }
    }
    if (drag.moved) updateView(constrainView({...viewRef.current, x: drag.startX + deltaX, y: drag.startY + deltaY}));
  };

  const onPointerUp = () => {
    setTimeout(() => {
      dragRef.current = null;
    }, 0);
  };
  const onPointerCancel = () => {
    dragRef.current = null;
  };

  const selectImage = (event, image) => {
    if (dragRef.current?.moved) {
      event.preventDefault();
      return;
    }
    onSelect(image);
  };

  const onWheel = (event) => {
    event.preventDefault();
    const bounds = viewportRef.current.getBoundingClientRect();
    const current = viewRef.current;
    const factor = event.deltaY > 0 ? 0.91 : 1.1;
    const scale = Math.min(1.25, Math.max(0.38, current.scale * factor));
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    updateView(constrainView({scale, x: pointerX - ((pointerX - current.x) / current.scale) * scale, y: pointerY - ((pointerY - current.y) / current.scale) * scale}));
  };

  return <section ref={viewportRef} className="canvas-viewport" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onWheel={onWheel}>
    <div ref={worldRef} className="canvas-world" style={{transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`}}>
      {isPositioned && visibleImages.map((image) => <button key={image.id} className={`photo-card ${image.color}`}
                                                            style={{width: image.width, height: image.height, transform: `translate(${image.position.x - image.width / 2}px, ${image.position.y - image.height / 2}px)`}}
                                                            onClick={(event) => selectImage(event, image)} aria-label={`View photo details: ${image.description}`}>
        <img src={image.src} alt="" loading="lazy" draggable="false"/>
      </button>)}
    </div>
    {images.length === 0 && <p className="empty-state">No moments found. Try another filter.</p>}
  </section>;
}

export default GalleryCanvas;
