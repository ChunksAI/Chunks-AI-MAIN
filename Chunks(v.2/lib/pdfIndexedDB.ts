/**
 * lib/pdfIndexedDB.ts — IndexedDB helpers for persisting the uploaded PDF file.
 *
 * URL.createObjectURL() produces a memory-only blob URL that is destroyed on
 * page refresh. IndexedDB survives refresh and supports binary data (File /
 * Blob), making it the right storage layer for the raw PDF file.
 *
 * Key used: chunks_v2_pdf_file
 * Store name: files (inside db: chunks_v2)
 */

const DB_NAME = 'chunks_v2';
const STORE_NAME = 'files';
const FILE_KEY = 'chunks_v2_pdf_file';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persist the raw File object so it can be recovered after a page refresh. */
export async function storePdfFile(file: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(file, FILE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Retrieve the previously stored File, or null if nothing is stored. */
export async function loadPdfFile(): Promise<File | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(FILE_KEY);
    req.onsuccess = () => {
      db.close();
      const result = req.result as File | undefined;
      resolve(result ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/** Remove the stored PDF file (e.g. when the user clears the session). */
export async function clearPdfFile(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(FILE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
