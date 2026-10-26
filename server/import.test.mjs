import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvChunks } from '../scripts/csv.mjs';
import { normalizeResolution, validDate } from '../scripts/import-data.mjs';

test('CSV : virgules citées, guillemets doublés et découpe entre chunks', async () => {
  const chunks = ['\uFEFFid,title\r\n1,"a,b"\r\n2,"a"', '"b"\r\n3,"line\n', 'next"\r\n'];
  const rows = [];
  for await (const row of parseCsvChunks(chunks)) rows.push(row);
  assert.deepEqual(rows, [
    ['id', 'title'],
    ['1', 'a,b'],
    ['2', 'a"b'],
    ['3', 'line\nnext'],
  ]);
});
test('CSV : le champ cité non fermé échoue explicitement', async () => {
  await assert.rejects(async () => {
    for await (const row of parseCsvChunks(['a,b\n1,"non ferme'])) void row;
  }, /non terminé/);
});
test('les dates impossibles ne sont pas normalisées silencieusement', () => {
  assert.equal(validDate('2020-02-29'), true);
  assert.equal(validDate('2021-02-29'), false);
  assert.equal(validDate('2020-13-01'), false);
  assert.equal(validDate('01/01/2020'), false);
});
test('le mapping des résolutions garde la clé, les titres et le lien source exacts', () => {
  const row = {
    undl_id: '280722',
    resolution: 'A/RES/41/60A',
    title: 'Titre officiel',
    date: '1986-12-03',
    undl_link: 'https://digitallibrary.un.org/record/280722',
  };
  const normalized = normalizeResolution(row);
  assert.equal(normalized.id, row.undl_id);
  assert.equal(normalized.sourceUrl, row.undl_link);
  assert.deepEqual(normalized.votes, []);
  assert.throws(
    () => normalizeResolution({ ...row, undl_link: 'https://unofficial.example/280722' }),
    /officielle/,
  );
});
