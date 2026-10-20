// Evidence snapshot storage. The anonymised JPEGs live in IndexedDB, keyed by alert id (or `after:<ticket id>`
// for after-fix photos), because they are far too large for the localStorage state. Only images the edge
// service has already blurred are stored here.

import type { Alert, AppSettings, Ticket } from '@/lib/types';

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

// After-fix photos share the store with evidence snapshots, keyed by ticket so they never collide with an alert id.
const AFTER_PREFIX = 'after:';
export const afterPhotoKey = (ticketId: string) => `${AFTER_PREFIX}${ticketId}`;
export const ticketIdOfKey = (key: string) => (key.startsWith(AFTER_PREFIX) ? key.slice(AFTER_PREFIX.length) : null);

// When a stored image must be deleted: its retention period after capture, or the shorter period after
// resolution, whichever comes first.
function expiry(capturedAt: string, resolvedAt: string | undefined, settings: AppSettings): Date {
  const captured = new Date(capturedAt).getTime() + settings.snapshotRetentionDays * DAY_MS;
  const resolved = resolvedAt ? new Date(resolvedAt).getTime() + settings.resolvedSnapshotRetentionDays * DAY_MS : Infinity;
  return new Date(Math.min(captured, resolved));
}

export function snapshotExpiry(alert: Alert, settings: AppSettings): Date | null {
  return alert.snapshot ? expiry(alert.snapshot.capturedAt, alert.resolvedAt, settings) : null;
}

// Simulated after photos store no image, so they never expire.
export function afterPhotoExpiry(ticket: Ticket, settings: AppSettings): Date | null {
  const photo = ticket.afterPhoto;
  return photo?.source === 'edge' ? expiry(photo.capturedAt, ticket.resolvedAt, settings) : null;
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
