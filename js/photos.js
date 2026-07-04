// ============ Smoker AI — photo journal storage (IndexedDB) ============
// Photos are stored in IndexedDB (not localStorage) so they don't eat the
// 5MB localStorage quota. Cooks reference photos by id via cook.photoIds.

const DB_NAME = 'smoker-ai-photos';
const STORE = 'photos';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const result = fn(store);
    t.oncomplete = () => { db.close(); resolve(result.result !== undefined ? result.result : result); };
    t.onerror = () => { db.close(); reject(t.error); };
  }));
}

/** Compress an image File to a JPEG data URL (max 900px long edge). */
export function compressPhoto(file, maxDim = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width: w, height: h } = img;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
    img.src = url;
  });
}

export async function savePhoto(id, dataUrl, caption = '') {
  await tx('readwrite', s => s.put({ id, dataUrl, caption, ts: Date.now() }));
  return id;
}

export async function getPhotos(ids) {
  if (!ids?.length) return [];
  const out = [];
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    const p = await tx('readonly', s => s.get(id));
    if (p) out.push(p);
  }
  return out;
}

export async function updateCaption(id, caption) {
  const p = await tx('readonly', s => s.get(id));
  if (p) { p.caption = caption; await tx('readwrite', s => s.put(p)); }
}

export async function deletePhoto(id) {
  await tx('readwrite', s => s.delete(id));
}
