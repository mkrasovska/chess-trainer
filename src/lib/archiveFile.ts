import { strFromU8, unzipSync } from 'fflate';

export async function extractPgnFromFile(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());

  if (file.name.toLowerCase().endsWith('.zip')) {
    const files = unzipSync(buffer);
    const pgnEntryName = Object.keys(files).find((name) => name.toLowerCase().endsWith('.pgn'));
    if (!pgnEntryName) throw new Error('No .pgn file found in this archive.');
    return strFromU8(files[pgnEntryName]);
  }

  return strFromU8(buffer);
}
