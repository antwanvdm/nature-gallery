import imageBases from './gallery-images.json';
import metadata from './image-metadata.json';

const colors = ['sun', 'ember', 'leaf', 'sky', 'coral', 'honey'];
const pendingDescription = 'A moment from the natural world.';

export const galleryImages = imageBases.map((base, index) => {
  const details = metadata[base] ?? {description: pendingDescription, tags: []};

  return {
    id: base,
    src: `/gallery-images/${base}-grid.webp`,
    fullSrc: `/gallery-images/${base}.webp`,
    tags: details.tags,
    description: details.description,
    subject: details.subject ?? null,
    mood: details.mood ?? null,
    dominantColors: details.colors ?? [],
    color: colors[index % colors.length],
    width: index % 5 === 0 ? 310 : index % 3 === 0 ? 230 : 270,
    height: index % 4 === 0 ? 390 : index % 3 === 0 ? 280 : 330,
  };
});

const tagCounts = new Map();
for (const image of galleryImages) {
  for (const tag of image.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
}
export const popularTags = [...tagCounts]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([tag]) => tag);
