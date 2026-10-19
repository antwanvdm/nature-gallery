import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const inputDir = path.join(root, 'input-images');
const outputDir = path.join(root, 'public', 'gallery-images');
const manifestPath = path.join(root, 'src', 'data', 'gallery-images.json');
const gridWidth = 768;
const supported = /\.(jpe?g|png|tiff?|webp|heic|heif)$/i;
const run = promisify(execFile);
const rebuild = process.argv.includes('--rebuild');

const files = (await fs.readdir(inputDir))
  .filter((file) => supported.test(file))
  .sort();
const basenames = files.map((file) =>
  path.basename(file, path.extname(file)).replace(/[^a-z0-9_-]/gi, '-'),
);
if (new Set(basenames).size !== basenames.length)
  throw new Error('Image filenames produce duplicate WebP names');

await fs.mkdir(outputDir, {recursive: true});
const expected = new Set(
  basenames.flatMap((name) => [`${name}-grid.webp`, `${name}.webp`]),
);
const existing = new Set(await fs.readdir(outputDir));
const temporaryDir = await fs.mkdtemp(path.join(root, '.gallery-images-'));
let converted = 0;
try {
  for (const [index, file] of files.entries()) {
    const basename = basenames[index];
    const gridName = `${basename}-grid.webp`;
    const fullName = `${basename}.webp`;
    if (!rebuild && existing.has(gridName) && existing.has(fullName)) continue;

    const source = path.join(inputDir, file);
    let decodedSource = source;
    if (
      /\.(heic|heif)$/i.test(file) &&
      !sharp.format.heif.input.fileSuffix.includes('.heic')
    ) {
      decodedSource = path.join(temporaryDir, `${basename}.png`);
      try {
        await run('sips', [
          '-s',
          'format',
          'png',
          source,
          '--out',
          decodedSource,
        ]);
      } catch (error) {
        throw new Error(
          `Cannot decode ${file}; HEIC support requires macOS sips or a HEIC-enabled Sharp build`,
          {cause: error},
        );
      }
    }

    const metadata = await sharp(decodedSource).metadata();
    await sharp(decodedSource)
      .rotate()
      .resize({width: gridWidth, withoutEnlargement: true})
      .webp({quality: 82, effort: 6})
      .toFile(path.join(temporaryDir, gridName));

    await sharp(decodedSource)
      .rotate()
      .webp({quality: 90, effort: 6})
      .toFile(path.join(temporaryDir, fullName));

    await fs.rename(
      path.join(temporaryDir, gridName),
      path.join(outputDir, gridName),
    );
    await fs.rename(
      path.join(temporaryDir, fullName),
      path.join(outputDir, fullName),
    );
    converted += 1;
    console.log(`Converted ${file} (${metadata.width}×${metadata.height})`);
  }

  for (const name of existing) {
    if (name.endsWith('.webp') && !expected.has(name))
      await fs.rm(path.join(outputDir, name));
  }

  await fs.writeFile(manifestPath, `${JSON.stringify(basenames, null, 2)}\n`);
} finally {
  await fs.rm(temporaryDir, {recursive: true, force: true});
}

console.log(
  `\nConverted ${converted} new or incomplete images; ${files.length} sources, two WebPs each in ${path.relative(root, outputDir)}.`,
);
