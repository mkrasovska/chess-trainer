import { loadPgnGames, type PgnGame } from './pgnUtils';

const DB_NAME = 'chess-trainer-library';
const DB_VERSION = 1;
const STORE = 'archives';

export type LibraryEntry = {
  id: string;
  name: string;
  size: number;
  addedAt: number;
};

type StoredRecord = LibraryEntry & { blob: Blob };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function runTx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function addArchiveToLibrary(name: string, blob: Blob): Promise<LibraryEntry> {
  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => undefined);
  }
  const db = await openDb();
  try {
    const id = `${name}:${blob.size}`;
    const addedAt = Date.now();
    const record: StoredRecord = { id, name, size: blob.size, addedAt, blob };
    await runTx(db, 'readwrite', (store) => store.put(record));
    return { id, name, size: blob.size, addedAt };
  } finally {
    db.close();
  }
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  const db = await openDb();
  try {
    const records = await runTx<StoredRecord[]>(db, 'readonly', (store) => store.getAll());
    return records
      .map(({ id, name, size, addedAt }) => ({ id, name, size, addedAt }))
      .sort((a, b) => b.addedAt - a.addedAt);
  } finally {
    db.close();
  }
}

export async function removeFromLibrary(id: string): Promise<void> {
  const db = await openDb();
  try {
    await runTx(db, 'readwrite', (store) => store.delete(id));
  } finally {
    db.close();
  }
}

export async function getLibraryBlobs(): Promise<{ id: string; blob: Blob }[]> {
  const db = await openDb();
  try {
    const records = await runTx<StoredRecord[]>(db, 'readonly', (store) => store.getAll());
    return records.map(({ id, blob }) => ({ id, blob }));
  } finally {
    db.close();
  }
}

/**
 * Reads and parses every file in the library into one in-memory game list.
 * Library files are expected to be at most a few MB each, so loading them
 * whole (rather than streaming) is simple and plenty fast.
 */
export async function loadLibraryGames(): Promise<PgnGame[]> {
  const sources = await getLibraryBlobs();
  const games: PgnGame[] = [];
  for (const source of sources) {
    const text = await source.blob.text();
    games.push(...loadPgnGames(text));
  }
  return games;
}
