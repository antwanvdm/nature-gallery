# Wonder Field

Wonder Field is a personal collection of nature photography created by me. It is a place for the small, beautiful things noticed outside to live together on their own terms, without going back to Instagram. Visit the live site
at [wonder-field.antwan.eu](https://wonder-field.antwan.eu/).

The collection brings back my former **#skyporn** series alongside a more recent fascination with insects, flowers, and the everyday wonder they hold. Every photograph was taken with a phone: older images with a OnePlus 5 or OnePlus 8T, and newer
ones with a OnePlus 12.

## Features

- An exploratory, zoomable gallery with a shuffled layout on each visit and a configurable centre spotlight.
- Tag filtering and full-text search across generated metadata.
- Photo detail modals with touch-friendly magnification and a background gradient derived from each image's dominant colours.
- Keyboard-accessible controls, focus management for modals, and a skip-to-content link.
- Responsive layouts for desktop and mobile.

## Technology

The application is a React single-page app built with Vite. Gallery positioning, pan and zoom interactions, filtering, and modal behaviour are implemented client-side. Styling is provided by Tailwind CSS, with additional responsive styles maintained in a single CSS file.

Images are processed locally with Sharp. Each source photo produces:

- a grid-optimised WebP used by the gallery;
- a full-resolution WebP used in the photo modal.

The optional metadata workflow uses the OpenAI Vision API to generate descriptions, reusable tags, a tentative subject or setting, mood and lighting notes, and three dominant hex colours. This metadata powers filtering, search, colour swatches, and
the photo-specific modal backgrounds. AI-generated details may be inaccurate and should be reviewed before publishing.

### Packages

- [React](https://www.npmjs.com/package/react) — component-based user interface library.
- [React DOM](https://www.npmjs.com/package/react-dom) — React renderer for the web.
- [Vite](https://www.npmjs.com/package/vite) — development server and production build tool.
- [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) — React support for Vite.
- [Tailwind CSS](https://www.npmjs.com/package/tailwindcss) and [@tailwindcss/vite](https://www.npmjs.com/package/@tailwindcss/vite) — utility-first CSS framework and Vite integration.
- [Lucide React](https://www.npmjs.com/package/lucide-react) — SVG icon components.
- [Sharp](https://www.npmjs.com/package/sharp) — local image processing and WebP generation.
- [exifr](https://www.npmjs.com/package/exifr) — local EXIF capture-date and coordinate extraction.

## Getting started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

## Adding images

Add photos to [`input-images/`](./input-images), then generate the gallery assets:

```bash
npm run images
```

The generator accepts common image formats, including HEIC/HEIF on macOS. It creates a grid WebP (`-grid.webp`) and a full-resolution modal WebP in [`public/gallery-images/`](./public/gallery-images), then updates [
`src/data/gallery-images.json`](./src/data/gallery-images.json). New images therefore appear automatically, without manual data entry.

Subsequent runs only convert images missing an output file. Regenerate all assets with:

```bash
npm run images -- --rebuild
```

Stale generated WebPs are removed after a successful run. If Sharp cannot decode HEIC files on macOS, the script falls back to `sips`.

## Generating metadata

To use the optional AI metadata workflow, copy `.env.example` to `.env` and set `OPENAI_API_KEY`. Never expose this key through client-side Vite environment variables.

Test the workflow with one randomly selected incomplete image:

```bash
npm run vision -- --test
```

This makes one paid API request and saves the resulting metadata. The script sends the full-resolution modal WebP with high image detail for richer results.

Generate metadata for all incomplete images with:

```bash
npm run vision
```

Metadata is written incrementally to [`src/data/image-metadata.json`](./src/data/image-metadata.json), so completed entries are skipped in later runs. Entries are keyed by the generated image base name, independently of the source extension. To
regenerate every entry, use `npm run vision -- --all`; `npm run vision -- --test --all` tests a random image even when all metadata is complete.

## Extracting capture dates and locations

Extract each photo's original capture date and coordinates with:

```bash
npm run metadata
```

The extractor uses a matching [`input-images/instagram.json`](./input-images/instagram.json) export first, then falls back to source-photo EXIF. It writes only the public-safe `capturedAt`, `placeName`, and capture-date source to [`src/data/image-metadata.json`](./src/data/image-metadata.json), which is bundled into the site. Exact coordinates and their source are written separately to the ignored private file `input-images/image-location-metadata.json`; it must never be imported by client code or copied into `public/`. Add `MAPBOX_ACCESS_TOKEN` to `.env` before running to resolve place names; dates and private coordinates are still saved without it.

Place names prefer a nearby Mapbox park, natural site, monument, museum, or other public attraction when its category identifies it as such. Otherwise, only city and country are stored; street addresses and unrelated businesses are never saved as place names. To replace previously stored place names, run `npm run metadata -- --refresh-places`. This makes new Mapbox lookups for every photo with private coordinates, including manual locations, so review Mapbox usage and your POI storage rights first. The regular command retains existing place names. Review generated names before publishing: proximity alone cannot confirm that a photo was taken inside a named site.

To remove only the extracted date, location, and provenance fields while preserving AI metadata, run:

```bash
npm run metadata -- --reset
```

Photos without metadata still appear in the gallery with a neutral description and no tags. Convert additions with `npm run images` before generating their metadata.

## Choosing the centre spotlight

Set `spotlightImageId` in [`src/data/gallery.js`](./src/data/gallery.js) to the generated base name of the photo that should stay in the centre. The remaining photos continue to shuffle on each visit. The configured photo remains in the collection normally and is only pinned when it is present in the current filters. Also update the preload URL in [`index.html`](./index.html) to match so the browser can discover and prioritise the initial centre image before JavaScript runs.
