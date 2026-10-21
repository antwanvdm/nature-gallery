import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import exifr from 'exifr';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputDir = path.join(root, 'input-images');
const instagramPath = path.join(inputDir, 'instagram.json');
const metadataPath = path.join(root, 'src', 'data', 'image-metadata.json');
const privateLocationPath = path.join(inputDir, 'image-location-metadata.json');
const supported = /\.(jpe?g|png|tiff?|webp|heic|heif)$/i;
const reset = process.argv.includes('--reset');
const refreshPlaces = process.argv.includes('--refresh-places');

const basenameFor = (file) =>
  path.basename(file, path.extname(file)).replace(/[^a-z0-9_-]/gi, '-');

const readJson = async (file, fallback) => {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
};

const loadEnv = async () => {
  try {
    const env = await fs.readFile(path.join(root, '.env'), 'utf8');
    for (const line of env.split(/\r?\n/)) {
      const match = line.match(/^\s*(MAPBOX_ACCESS_TOKEN)\s*=\s*(.*?)\s*$/);
      if (match && !process.env[match[1]])
        process.env[match[1]] = match[2].replace(/^("|')|("|')$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const dateFromExif = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const pad = (number) => String(number).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
};

const dateFromInstagram = (exifData, creationTimestamp) => {
  const original = exifData.find((data) => data.date_time_original)?.date_time_original;
  if (typeof original === 'string') return original.replace(/^([\d]{4}):([\d]{2}):([\d]{2}) /, '$1-$2-$3T');
  if (Number.isFinite(creationTimestamp)) return new Date(creationTimestamp * 1000).toISOString();
  return null;
};

const coordinatesFromInstagram = (exifData) => {
  const location = exifData.find((data) => Number.isFinite(data.latitude) && Number.isFinite(data.longitude));
  return location ? {latitude: location.latitude, longitude: location.longitude} : null;
};

const mapInstagramMedia = (posts) => {
  const mediaByBasename = new Map();
  for (const post of posts) {
    for (const media of post.media ?? []) {
      const uri = typeof media.uri === 'string' ? media.uri : '';
      if (!supported.test(uri)) continue;
      const key = basenameFor(uri);
      if (!mediaByBasename.has(key)) mediaByBasename.set(key, media);
    }
  }
  return mediaByBasename;
};

const publicPoiCategories = new Set([
  'park', 'nature_reserve', 'national_park', 'botanical_garden', 'garden',
  'beach', 'forest', 'waterfall', 'viewpoint', 'scenic_lookout', 'landmark',
  'monument', 'historic_site', 'museum', 'art_gallery', 'zoo', 'aquarium',
  'public_garden', 'tourist_attraction',
]);

const placeNameFromFeature = (feature) => {
  const {name, context = {}, feature_type: type} = feature?.properties ?? {};
  const city = context.place?.name ?? context.city?.name ?? (['place', 'city'].includes(type) ? name : null);
  const country = context.country?.name ?? (type === 'country' ? name : null);
  const landmark = type === 'poi' && !/\d/.test(name ?? '') ? name : null;
  return [landmark, city, country].filter(Boolean).filter((part, index, parts) => parts.indexOf(part) === index).join(', ') || null;
};

const geocode = async (endpoint, coordinates, parameters) => {
  const url = new URL(`https://api.mapbox.com/search/${endpoint}`);
  url.searchParams.set('longitude', coordinates.longitude);
  url.searchParams.set('latitude', coordinates.latitude);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  url.searchParams.set('access_token', process.env.MAPBOX_ACCESS_TOKEN.trim());
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Mapbox reverse geocoding failed: ${response.status} ${await response.text()}`);
  return (await response.json()).features ?? [];
};

const reverseGeocode = async (coordinates) => {
  if (!process.env.MAPBOX_ACCESS_TOKEN?.trim()) return null;
  const pois = await geocode('searchbox/v1/reverse', coordinates, {types: 'poi', limit: '10'});
  const landmark = pois.find((feature) =>
    feature.properties?.feature_type === 'poi' &&
    !/\d/.test(feature.properties?.name ?? '') &&
    feature.properties?.poi_category_ids?.some((category) => publicPoiCategories.has(category)));
  const places = await geocode('geocode/v6/reverse', coordinates, {types: 'place,country', permanent: 'true'});
  const place = places.find((feature) => feature.properties?.feature_type === 'place');
  const country = places.find((feature) => feature.properties?.feature_type === 'country');
  const location = placeNameFromFeature(place ?? country);
  if (!landmark) return location;
  const landmarkName = landmark.properties.name;
  return location ? `${landmarkName}, ${location}` : placeNameFromFeature(landmark);
};

await loadEnv();
if (refreshPlaces && !process.env.MAPBOX_ACCESS_TOKEN?.trim())
  throw new Error('Set MAPBOX_ACCESS_TOKEN in .env before running with --refresh-places');
let metadata = await readJson(metadataPath, {});
metadata = Object.fromEntries(Object.entries(metadata).map(([key, value]) => [basenameFor(key), value]));
let privateLocations = await readJson(privateLocationPath, {});
privateLocations = Object.fromEntries(Object.entries(privateLocations).map(([key, value]) => [basenameFor(key), value]));

for (const [id, entry] of Object.entries(metadata)) {
  if (!entry.location) continue;
  privateLocations[id] = {
    latitude: entry.location.latitude,
    longitude: entry.location.longitude,
    source: entry.captureMetadataSources?.location ?? null,
  };
  entry.placeName = entry.location.placeName ?? null;
  delete entry.location;
  if (entry.captureMetadataSources) delete entry.captureMetadataSources.location;
}

if (reset) {
  for (const entry of Object.values(metadata)) {
    delete entry.capturedAt;
    delete entry.placeName;
    delete entry.captureMetadataSources;
  }
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  await fs.rm(privateLocationPath, {force: true});
  console.log(`Removed capture date and location fields from ${path.relative(root, metadataPath)} and deleted private location metadata.`);
  process.exit(0);
}

const files = (await fs.readdir(inputDir)).filter((file) => supported.test(file)).sort();
const instagramMedia = mapInstagramMedia(await readJson(instagramPath, []));
let updated = 0;
let unresolvedLocations = 0;

for (const file of files) {
  const id = basenameFor(file);
  const existing = metadata[id] ?? {};
  const instagram = instagramMedia.get(id);
  const instagramExif = instagram?.media_metadata?.photo_metadata?.exif_data ?? [];
  let exif;

  const readExif = async () => {
    if (exif === undefined) exif = await exifr.parse(path.join(inputDir, file)).catch(() => null);
    return exif;
  };

  const storedCoordinates = privateLocations[id];
  const manualCoordinates = storedCoordinates?.source === 'manual' &&
    Number.isFinite(storedCoordinates.latitude) && Number.isFinite(storedCoordinates.longitude)
    ? {latitude: storedCoordinates.latitude, longitude: storedCoordinates.longitude}
    : null;
  const instagramCoordinates = manualCoordinates ? null : coordinatesFromInstagram(instagramExif);
  const exifCoordinates = manualCoordinates || instagramCoordinates ? null : await (async () => {
    const data = await readExif();
    return Number.isFinite(data?.latitude) && Number.isFinite(data?.longitude)
      ? {latitude: data.latitude, longitude: data.longitude}
      : null;
  })();
  const coordinates = manualCoordinates ?? instagramCoordinates ?? exifCoordinates;
  const locationSource = manualCoordinates ? 'manual' : instagramCoordinates ? 'instagram' : exifCoordinates ? 'exif' : null;
  const capturedAt = dateFromInstagram(instagramExif, instagram?.creation_timestamp) ?? dateFromExif((await readExif())?.DateTimeOriginal ?? (await readExif())?.CreateDate);
  const dateSource = instagram ? 'instagram' : capturedAt ? 'exif' : null;

  let placeName = existing.placeName ?? null;
  if (coordinates && (refreshPlaces || !placeName)) placeName = await reverseGeocode(coordinates);
  if (coordinates && !placeName) unresolvedLocations += 1;

  const next = {...existing};
  if (capturedAt) next.capturedAt = capturedAt;
  if (placeName) next.placeName = placeName;
  else delete next.placeName;
  if (dateSource) next.captureMetadataSources = {date: dateSource};
  else delete next.captureMetadataSources;

  if (coordinates) {
    privateLocations[id] = {...coordinates, source: locationSource};
  } else {
    delete privateLocations[id];
  }

  if (JSON.stringify(next) !== JSON.stringify(existing)) updated += 1;
  metadata[id] = next;
}

const imageIds = new Set(files.map(basenameFor));
privateLocations = Object.fromEntries(Object.entries(privateLocations)
  .filter(([id]) => imageIds.has(id)));

await Promise.all([
  fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`),
  fs.writeFile(privateLocationPath, `${JSON.stringify(privateLocations, null, 2)}\n`),
]);
console.log(`Updated public capture metadata for ${updated} of ${files.length} images.`);
if (unresolvedLocations)
  console.log(`${unresolvedLocations} locations are awaiting reverse geocoding. Set MAPBOX_ACCESS_TOKEN in .env and rerun this command.`);
