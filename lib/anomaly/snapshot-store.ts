// Evidence snapshot storage. The anonymised JPEGs live in IndexedDB, keyed by alert id, because they are
// far too large for the localStorage state. Only images the edge service has already blurred are stored here.

import type { Alert, AppSettings } from '@/lib/types';

const DB_NAME = 'anomalyguard-snapshots';
const STORE = 'snapshots';
const DAY_MS = 86400000;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const putSnapshot = (alertId: string, jpeg: Blob) => run('readwrite', s => s.put(jpeg, alertId)).then(() => undefined);
export const getSnapshot = (alertId: string) => run<Blob | undefined>('readonly', s => s.get(alertId));
export const deleteSnapshot = (alertId: string) => run('readwrite', s => s.delete(alertId)).then(() => undefined);
export const storedSnapshotIds = () => run('readonly', s => s.getAllKeys()).then(keys => keys.map(String));

// When a stored snapshot must be deleted: its retention period after capture, or the shorter period after
// the alert is resolved, whichever comes first.
export function snapshotExpiry(alert: Alert, settings: AppSettings): Date | null {
  if (!alert.snapshot) return null;
  const captured = new Date(alert.snapshot.capturedAt).getTime() + settings.snapshotRetentionDays * DAY_MS;
  const resolved = alert.resolvedAt ? new Date(alert.resolvedAt).getTime() + settings.resolvedSnapshotRetentionDays * DAY_MS : Infinity;
  return new Date(Math.min(captured, resolved));
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
