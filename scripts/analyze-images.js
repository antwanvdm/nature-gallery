import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputDir = path.join(root, 'input-images');
const imageDir = path.join(root, 'public', 'gallery-images');
const metadataPath = path.join(root, 'src', 'data', 'image-metadata.json');
const supported = /\.(jpe?g|png|tiff?|webp|heic|heif)$/i;
const model = 'gpt-6-luna';
const descriptionLimit = 180;
const subjectLimit = 80;
const moodLimit = 60;

const envPath = path.join(root, '.env');
try {
  const env = await fs.readFile(envPath, 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*(OPENAI_API_KEY)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^("|')|("|')$/g, '');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.trim()) throw new Error('Set OPENAI_API_KEY in .env before running npm run vision');
const analyzeAll = process.argv.includes('--all');
const testMode = process.argv.includes('--test');
let metadata = {};
try {
  metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const basenameFor = (file) => path.basename(file, path.extname(file)).replace(/[^a-z0-9_-]/gi, '-');
metadata = Object.fromEntries(Object.entries(metadata).map(([key, value]) => [
  basenameFor(key),
  value,
]));
const files = (await fs.readdir(inputDir)).filter((file) => supported.test(file)).sort();
const basenames = files.map(basenameFor);
if (new Set(basenames).size !== basenames.length) throw new Error('Image filenames produce duplicate metadata keys');
const hasNewFields = (entry) => typeof entry?.subject === 'string' && typeof entry?.mood === 'string' && Array.isArray(entry?.colors) && entry.colors.length === 3;
const pending = files.filter((file) => analyzeAll || !hasNewFields(metadata[basenameFor(file)]));
const selected = testMode && pending.length ? [pending[Math.floor(Math.random() * pending.length)]] : pending;
console.log(`Analyzing ${selected.length} of ${files.length} images with ${model}${testMode ? ' (test mode)' : ''}.`);

const validate = (result) => {
  const description = result.description?.trim();
  const tags = result.tags;
  if (typeof description !== 'string' || !description) throw new Error('description is missing');
  if (description.length > descriptionLimit) throw new Error(`description has ${description.length} characters; maximum is ${descriptionLimit}`);
  if (!Array.isArray(tags) || tags.length !== 10) throw new Error(`expected 10 tags; received ${Array.isArray(tags) ? tags.length : 'a non-array value'}`);
  const invalidTag = tags.find((tag) => typeof tag !== 'string' || !/^[a-z][a-z -]{1,24}$/.test(tag));
  if (invalidTag !== undefined) throw new Error(`invalid tag: ${JSON.stringify(invalidTag)}`);
  if (new Set(tags).size !== 10) throw new Error('tags are not distinct');
  const subject = result.subject?.trim();
  const mood = result.mood?.trim();
  const colors = result.colors;
  if (!subject || subject.length > subjectLimit) throw new Error(`subject must be 1–${subjectLimit} characters`);
  if (!mood || mood.length > moodLimit) throw new Error(`mood must be 1–${moodLimit} characters`);
  if (!Array.isArray(colors) || colors.length !== 3 || colors.some((color) => typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color))) throw new Error('colors must contain exactly three hex RGB values');
  return {description, tags, subject, mood, colors};
};

for (const file of selected) {
  const basename = basenameFor(file);
  const fullImage = path.join(imageDir, `${basename}.webp`);
  let imageData;
  try {
    imageData = await fs.readFile(fullImage);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`Missing ${fullImage}; run npm run images first`);
    throw error;
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model,
      max_output_tokens: 1000,
      input: [{
        role: 'user', content: [
          {
            type: 'input_text',
            text: `Describe this photograph using only what is visible. Return a natural description (max ${descriptionLimit} characters), exactly 10 distinct reusable lowercase tags (no #), a concise subject identification (max ${subjectLimit} characters), a short mood or lighting description (max ${moodLimit} characters), and three dominant image colours as #RRGGBB hex values ordered by prominence. For animals or plants, identify the species only when visually supported; otherwise use a broader subject (e.g. bee, flowering plant). For sky photographs, name the visible setting or environment (e.g. sunset over a city skyline). Never invent a location, date, or circumstances. Include "skyporn", "insects", and "flowers" as tags whenever each is relevant.`
          },
          {type: 'input_image', image_url: `data:image/webp;base64,${imageData.toString('base64')}`, detail: 'high'},
        ]
      }],
      text: {
        format: {
          type: 'json_schema', name: 'gallery_metadata', strict: true, schema: {
            type: 'object', additionalProperties: false,
            properties: {
              description: {type: 'string', minLength: 1, maxLength: descriptionLimit},
              subject: {type: 'string', minLength: 1, maxLength: subjectLimit},
              mood: {type: 'string', minLength: 1, maxLength: moodLimit},
              colors: {type: 'array', minItems: 3, maxItems: 3, items: {type: 'string', pattern: '^#[0-9a-fA-F]{6}$'}},
              tags: {
                type: 'array',
                minItems: 10,
                maxItems: 10,
                items: {type: 'string', pattern: '^[a-z][a-z -]{1,24}$'},
              },
            },
            required: ['description', 'tags', 'subject', 'mood', 'colors'],
          }
        }
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed for ${file}: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const output = payload.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
  if (!output) throw new Error(`No text returned for ${file}: ${payload.status ?? 'unknown status'}${payload.incomplete_details?.reason ? ` (${payload.incomplete_details.reason})` : ''}`);
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (error) {
    throw new Error(`Invalid or truncated JSON returned for ${file}; no metadata was saved. Rerun the command to retry it.`, {cause: error});
  }
  let result;
  try {
    result = validate(parsed);
  } catch (error) {
    throw new Error(`Invalid metadata returned for ${file}: ${error.message}. No metadata was saved; rerun without --all to retry it.`, {cause: error});
  }
  metadata[basename] = result;
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Analyzed ${file}`);
  if (testMode) console.log(JSON.stringify({file, ...result}, null, 2));
}

console.log(`Done. Metadata saved to ${path.relative(root, metadataPath)}.`);
