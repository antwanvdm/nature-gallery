# Wonder Field

Install dependencies with `npm install`, then run `npm run dev`.

## Images and metadata

Add photos (including HEIC/HEIF on macOS) to `input-images/` and run `npm run images`. This produces one 960px-wide WebP for the grid (`-grid.webp`) and one full-resolution WebP for the modal in `public/gallery-images/`. It also updates `src/data/gallery-images.json`, so new images automatically appear in the gallery—no manual data entry is required. Subsequent runs convert only images missing either WebP; `npm run images -- --rebuild` reconverts all. Stale generated WebPs are removed after a successful run. On macOS, HEIC files are decoded with `sips` if Sharp cannot read them.

For AI-generated descriptions (up to 180 characters), ten reusable hashtags, a tentative subject or visible setting, mood/lighting, and three dominant hex colours per image, copy `.env.example` to `.env`, set `OPENAI_API_KEY`, then run `npm run vision -- --test` to analyze **one randomly selected image missing the new fields** and print its result. Test mode sends one paid API request and saves its metadata. The script sends the full-size modal WebP to OpenAI with high image detail for richer visual metadata. Run `npm run vision` to update the remaining images, including older entries with only descriptions and tags: metadata is saved after each photo in `src/data/image-metadata.json`, so later runs skip entries with all new fields. Metadata is keyed by the generated image base name, independent of the source extension. Use `npm run vision -- --all` only to regenerate metadata for every photo regardless of completion; `--test --all` tests a random photo even if all have metadata. Search covers descriptions, tags, subjects, mood, and hex colours. AI identifications and colour estimates may be inaccurate; review generated metadata before publishing. Never put your API key in client-side Vite environment variables.

Images without AI metadata remain visible with a neutral description and no tags. Additions should be converted with `npm run images` before running `npm run vision`.
