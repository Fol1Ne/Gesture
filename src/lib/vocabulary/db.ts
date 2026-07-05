import type { PersonalSign, PersonalVocabularyExport } from "./types";

const DB_NAME = "gesture-personal-vocabulary";
const DB_VERSION = 1;
const STORE_NAME = "signs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = run(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadPersonalSigns(): Promise<PersonalSign[]> {
  if (typeof indexedDB === "undefined") return [];
  return transaction("readonly", (store) => store.getAll());
}

export async function savePersonalSign(sign: PersonalSign): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await transaction("readwrite", (store) => store.put(sign));
}

export async function deletePersonalSign(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await transaction("readwrite", (store) => store.delete(id));
}

export async function replacePersonalVocabulary(signs: PersonalSign[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const sign of signs) store.put(sign);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function exportVocabulary(signs: PersonalSign[]): PersonalVocabularyExport {
  return {
    version: 1,
    exportedAt: Date.now(),
    signs,
  };
}
