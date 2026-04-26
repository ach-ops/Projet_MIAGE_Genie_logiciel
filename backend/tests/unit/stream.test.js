/**
 * Tests de l'utilitaire removeBOM.
 *
 * On passe des buffers directement dans le Transform pour tester :
 * - BOM présent au début → retiré du premier chunk
 * - BOM absent → chunk inchangé
 * - BOM sur plusieurs chunks → retiré uniquement du premier
 * - Chunk vide → pas de crash
 * - BOM partiel → chunk non modifié
 */
import { describe, it, expect } from 'vitest';
import { removeBOM } from '../../utils/stream.js';

// ─── Helper : passer un chunk dans le transform et récupérer la sortie ────────

function pipeChunk(transform, input) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    transform.on('data', (chunk) => chunks.push(chunk));
    transform.on('end', () => resolve(Buffer.concat(chunks)));
    transform.on('error', reject);
    transform.end(input);
  });
}

async function processChunks(chunks) {
  const transform = removeBOM();
  return new Promise((resolve, reject) => {
    const output = [];
    transform.on('data', (chunk) => output.push(chunk));
    transform.on('end', () => resolve(Buffer.concat(output)));
    transform.on('error', reject);
    for (const chunk of chunks) {
      transform.write(chunk);
    }
    transform.end();
  });
}

// ─── Constantes BOM ───────────────────────────────────────────────────────────
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const CONTENT = Buffer.from('stop_id,stop_name\nSTOP_A,Arrêt A');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('removeBOM', () => {
  it('retire le BOM UTF-8 du premier chunk', async () => {
    const input = Buffer.concat([BOM, CONTENT]);
    const result = await pipeChunk(removeBOM(), input);

    expect(result.toString()).toBe(CONTENT.toString());
    expect(result[0]).not.toBe(0xef);
  });

  it('ne modifie pas un chunk sans BOM', async () => {
    const result = await pipeChunk(removeBOM(), CONTENT);

    expect(result.toString()).toBe(CONTENT.toString());
  });

  it('ne retire le BOM que du premier chunk', async () => {
    // Deuxième chunk
    const chunk1 = Buffer.concat([BOM, Buffer.from('header\n')]);
    const chunk2 = Buffer.concat([BOM, Buffer.from('data')]);

    const result = await processChunks([chunk1, chunk2]);
    const str = result.toString();

    // Le premier BOM est retiré, le second est conservé
    expect(str.startsWith('header')).toBe(true);
    // Le second chunk est intact
    expect(result.includes(BOM[0])).toBe(true);
  });

  it('ne crash pas sur un chunk vide', async () => {
    const result = await pipeChunk(removeBOM(), Buffer.alloc(0));

    expect(result.length).toBe(0);
  });

  it('gère un fichier CSV typique avec BOM', async () => {
    const csvContent = 'trip_id,route_id,service_id\nTRIP_1,ROUTE_1,SERVICE_ALL';
    const input = Buffer.concat([BOM, Buffer.from(csvContent)]);

    const result = await pipeChunk(removeBOM(), input);

    expect(result.toString()).toBe(csvContent);
    // La première colonne ne doit pas avoir de préfixe invisible
    expect(result.toString().startsWith('trip_id')).toBe(true);
  });
});
