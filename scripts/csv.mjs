import { createReadStream } from 'node:fs';

// Parseur streaming : guillemets doublés, virgules, CRLF et retours à la ligne cités.
// Le CSV source (368 Mo) n'est jamais chargé entièrement en mémoire.
export async function* parseCsvChunks(chunks) {
  let fields = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;
  let first = true;
  for await (const chunk of chunks) {
    for (const char of chunk) {
      if (first) {
        first = false;
        if (char === '\uFEFF') continue;
      }
      if (quoted) {
        if (afterQuote) {
          if (char === '"') {
            field += '"';
            afterQuote = false;
            continue;
          }
          quoted = false;
          afterQuote = false;
        } else {
          if (char === '"') afterQuote = true;
          else field += char;
          continue;
        }
      }
      if (char === '"' && field === '') quoted = true;
      else if (char === ',') {
        fields.push(field);
        field = '';
      } else if (char === '\n') {
        fields.push(field);
        yield fields;
        fields = [];
        field = '';
      } else if (char !== '\r') field += char;
    }
  }
  if (quoted && !afterQuote) throw new Error('CSV invalide : champ cité non terminé.');
  if (field !== '' || fields.length > 0) {
    fields.push(field);
    yield fields;
  }
}

export async function* readCsv(path, requiredHeaders) {
  const records = parseCsvChunks(createReadStream(path, { encoding: 'utf8' }));
  let headers;
  let line = 0;
  for await (const fields of records) {
    line++;
    if (!headers) {
      headers = fields;
      for (const required of requiredHeaders)
        if (!headers.includes(required))
          throw new Error(`Colonne obligatoire absente : ${required}`);
      continue;
    }
    if (fields.length === 1 && fields[0] === '') continue;
    if (fields.length !== headers.length)
      throw new Error(
        `CSV invalide à l'enregistrement ${line} : ${fields.length} champs pour ${headers.length} colonnes.`,
      );
    yield Object.fromEntries(headers.map((key, index) => [key, fields[index]]));
  }
}
