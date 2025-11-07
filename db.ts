const DB_NAME = 'CaisseAhicDB';
const STORE_NAME = 'SettingsStore';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error("IndexedDB error:", request.error);
                reject("IndexedDB error: " + request.error);
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }
    return dbPromise;
}

export async function get<T>(key: IDBValidKey): Promise<T | undefined> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        
        transaction.oncomplete = () => {
            resolve(request.result as T);
        };
        
        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
}

export async function set(key: IDBValidKey, value: any): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(value, key);
        
        transaction.oncomplete = () => {
            resolve();
        };
        
        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
}

export async function del(key: IDBValidKey): Promise<void> {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(key);
        
        transaction.oncomplete = () => {
            resolve();
        };
        
        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
}
