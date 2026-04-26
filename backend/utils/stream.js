import { Transform } from 'stream';

/**
 * Stream Transform pour supprimer le BOM UTF-8 d'un flux de données.
 * Certains exports GTFS incluent un BOM qui fait planter csv-parser ou produit des noms de colonnes avec un préfixe invisible.
 */
export function removeBOM() {
  let checked = false;
  return new Transform({
    transform(chunk, _encoding, callback) {
      if (!checked) {
        checked = true;
        if (chunk[0] === 0xef && chunk[1] === 0xbb && chunk[2] === 0xbf) {
          chunk = chunk.slice(3);
        }
      }
      callback(null, chunk);
    },
  });
}
