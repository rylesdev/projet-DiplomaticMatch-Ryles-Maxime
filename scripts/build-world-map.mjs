import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Natural Earth is public-domain geographic data. Pin both revision and bytes.
const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_110m_admin_0_countries.geojson';
const SOURCE_SHA256 = '6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f';
const LICENSE_URL = 'https://www.naturalearthdata.com/about/terms-of-use/';
const width = 1200;
const height = 500;

// An optional local source file allows rebuilding without network access.
let source;
if (process.argv[2]) {
  source = await readFile(resolve(process.argv[2]));
} else {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Natural Earth download failed: ${response.status}`);
  source = Buffer.from(await response.arrayBuffer());
}
if (createHash('sha256').update(source).digest('hex') !== SOURCE_SHA256)
  throw new Error('The Natural Earth source checksum does not match the pinned version.');

const geographicData = JSON.parse(source.toString('utf8'));
const dataset = JSON.parse(await readFile(new URL('../data/dataset.json', import.meta.url), 'utf8'));
const datasetIds = new Set(dataset.countries.map((country) => country.id));
const round = (value) => Number(value.toFixed(2));

function ringPath(ring) {
  if (ring.length < 4) throw new Error('Invalid country ring.');
  const first = ring[0];
  const last = ring.at(-1);
  if (first[0] !== last[0] || first[1] !== last[1]) throw new Error('Unclosed country ring.');
  // This source already splits Fiji and Russia at the antimeridian. Check the
  // assumption explicitly rather than drawing a line across the whole map.
  for (let index = 1; index < ring.length; index++) {
    if (Math.abs(ring[index][0] - ring[index - 1][0]) > 180)
      throw new Error('A polygon must be split at the antimeridian before projection.');
  }
  return (
    ring
      .slice(0, -1)
      .map(([longitude, latitude], index) => {
        const x = round(((longitude + 180) / 360) * width);
        const y = round(((90 - latitude) / 360) * width);
        if (x < 0 || x > width || y < 0 || y > height)
          throw new Error('Projected coordinates fall outside the map bounds.');
        return `${index ? 'L' : 'M'}${x},${y}`;
      })
      .join('') + 'Z'
  );
}

const countries = geographicData.features
  .filter((feature) => feature.properties.ADM0_A3 !== 'ATA')
  .map((feature) => {
    const properties = feature.properties;
    const id = properties.ISO_A3_EH !== '-99' ? properties.ISO_A3_EH : properties.ADM0_A3;
    const geometry = feature.geometry;
    if (!['Polygon', 'MultiPolygon'].includes(geometry.type))
      throw new Error(`Unsupported country geometry: ${geometry.type}`);
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    return {
      id,
      name: properties.NAME_FR || properties.ADMIN,
      path: polygons.flatMap((polygon) => polygon.map(ringPath)).join(''),
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id, 'en'));

const geographicIds = new Set(countries.map((country) => country.id));
if (geographicIds.size !== countries.length) throw new Error('Duplicate geographic IDs.');
const mappedCount = countries.filter((country) => datasetIds.has(country.id)).length;
const missingCountries = dataset.countries.filter((country) => !geographicIds.has(country.id));
const map = {
  schemaVersion: 1,
  width,
  height,
  projection: 'equirectangular',
  source: {
    name: 'Natural Earth, Admin 0 — Countries, 1:110m',
    url: SOURCE_URL,
    sha256: SOURCE_SHA256,
    license: 'Public domain',
    licenseUrl: LICENSE_URL,
  },
  countries,
};

const outputDirectory = new URL('../public/maps/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });
await writeFile(new URL('world.json', outputDirectory), JSON.stringify(map) + '\n');
await writeFile(
  new URL('README.md', outputDirectory),
  `# Fond de carte mondial\n\n` +
    `Fond simplifié **Natural Earth, Admin 0 — Countries, 1:110m**, dans le domaine public.\n\n` +
    `- [Source GeoJSON figée](${SOURCE_URL})\n` +
    `- [Conditions d’utilisation](${LICENSE_URL})\n` +
    `- SHA-256 : \`${SOURCE_SHA256}\`\n\n` +
    `## Format\n\n` +
    `\`world.json\` contient \`width\`, \`height\` et \`countries: [{ id, name, path }]\`. ` +
    `Le champ \`path\` est un chemin SVG dans un viewBox \`0 0 ${width} ${height}\`. ` +
    `Utiliser \`fill-rule="evenodd"\` pour conserver les trous des polygones.\n\n` +
    `Projection équirectangulaire, longitudes −180 à 180 et latitudes 90 à −60. ` +
    `L’Antarctique est exclu. Les polygones sont déjà découpés à l’antiméridien ; ` +
    `le générateur vérifie l’absence de segments traversant toute la carte. ` +
    `Les coordonnées sont arrondies au centième pour alléger l’asset. ` +
    `Aucune bibliothèque géographique ni requête externe n’est nécessaire à l’exécution.\n\n` +
    `## Correspondance avec les votes\n\n` +
    `${countries.length} contours sont présents, dont ${mappedCount} correspondent directement ` +
    `aux ${dataset.countries.length} codes du jeu de votes livré. ` +
    `Les identifiants proviennent de \`ISO_A3_EH\`, ou de \`ADM0_A3\` lorsque le premier vaut −99 ` +
    `(notamment pour les entités sans code ISO). France et Norvège conservent ainsi FRA et NOR. ` +
    `Les contours sans correspondance restent sans données ; aucune correspondance politique ` +
    `ou historique n’est inventée. Les frontières sont celles de ce fond contemporain simplifié ` +
    `et ne reconstituent pas les frontières historiques des années filtrées.\n\n` +
    `Les ${missingCountries.length} codes de votes sans contour sont surtout des petites îles, ` +
    `micro-États et entités historiques :\n\n` +
    missingCountries.map((country) => `- ${country.id} — ${country.name}`).join('\n') +
    `\n\n## Régénération\n\n` +
    `Depuis la racine du dépôt, avec Node.js :\n\n` +
    `\`\`\`sh\nnode scripts/build-world-map.mjs\n\`\`\`\n\n` +
    `Le script télécharge la source figée et contrôle son empreinte. Pour un fichier déjà ` +
    `téléchargé : \`node scripts/build-world-map.mjs chemin/vers/source.geojson\`.\n`,
);
console.log(`World map: ${countries.length} shapes, ${mappedCount} matching vote countries.`);
