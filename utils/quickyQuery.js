const DB_NAME = "tabbar-chat-db";
const DB_VERSION = 1;
const STORE_SESSIONS = "sessions";
const STORE_TITLES = "chatTitles";
const STORE_META = "meta";

const titleFromSession = (value) => {
    if (!value || typeof value !== "object") return "";
    const t = value.metadata?.title;
    return typeof t === "string" ? t : "";
};

const shouldSyncTitleRow = (sessionId) => sessionId !== "7";

/** Faster commits where supported; falls back to default durability. */
let _readWriteRelaxedOk = null;

const openReadWriteTx = (db, storeNames) => {
    if (_readWriteRelaxedOk !== false) {
        try {
            const tx = db.transaction(storeNames, "readwrite", { durability: "relaxed" });
            _readWriteRelaxedOk = true;
            return tx;
        } catch {
            _readWriteRelaxedOk = false;
        }
    }
    return db.transaction(storeNames, "readwrite");
};

const emptyNameMap = () => Object.create(null);

const localDB = {
    _db: null,
    _openPromise: null,

    ensureOpen() {
        if (this._openPromise) {
            return this._openPromise;
        }
        this._openPromise = this._openInner();
        return this._openPromise;
    },

    _openInner() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error(
                    "The IndexedDB API was not found. Try running the app in a modern browser."
                ));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
                    db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains(STORE_TITLES)) {
                    db.createObjectStore(STORE_TITLES, { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains(STORE_META)) {
                    db.createObjectStore(STORE_META, { keyPath: "key" });
                }
            };

            request.onerror = () => {
                reject(request.error || new Error("IndexedDB open failed"));
            };

            request.onsuccess = () => {
                this._db = request.result;
                resolve(this._db);
            };
        });
    },

    async getSession(id) {
        await this.ensureOpen();
        const sid = String(id);
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(STORE_SESSIONS, "readonly");
            const req = tx.objectStore(STORE_SESSIONS).get(sid);
            req.onsuccess = () => {
                const row = req.result;
                resolve(row ? row.payload : null);
            };
            req.onerror = () => reject(req.error);
        });
    },

    async setSession(id, payload) {
        await this.ensureOpen();
        const sid = String(id);
        return new Promise((resolve, reject) => {
            const syncTitle = shouldSyncTitleRow(sid);
            const stores = syncTitle
                ? [STORE_SESSIONS, STORE_TITLES]
                : [STORE_SESSIONS];
            const tx = openReadWriteTx(this._db, stores);
            tx.objectStore(STORE_SESSIONS).put({ id: sid, payload });
            if (syncTitle) {
                const t = titleFromSession(payload);
                tx.objectStore(STORE_TITLES).put({ id: sid, title: t });
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async deleteSession(id) {
        await this.ensureOpen();
        const sid = String(id);
        return new Promise((resolve, reject) => {
            const tx = openReadWriteTx(this._db, [STORE_SESSIONS, STORE_TITLES]);
            tx.objectStore(STORE_SESSIONS).delete(sid);
            tx.objectStore(STORE_TITLES).delete(sid);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async patchSessionTitle(id, title) {
        await this.ensureOpen();
        const sid = String(id);
        const syncTitle = shouldSyncTitleRow(sid);
        const storeNames = syncTitle
            ? [STORE_SESSIONS, STORE_TITLES]
            : [STORE_SESSIONS];
        return new Promise((resolve, reject) => {
            const tx = openReadWriteTx(this._db, storeNames);
            const sessions = tx.objectStore(STORE_SESSIONS);
            const getReq = sessions.get(sid);
            getReq.onsuccess = () => {
                const row = getReq.result;
                const existing = row ? row.payload : null;
                const base = existing && typeof existing === "object" ? existing : {};
                const merged = Object.assign({}, base);
                merged.metadata = Object.assign({}, base.metadata || {}, { title });
                sessions.put({ id: sid, payload: merged });
                if (syncTitle) {
                    tx.objectStore(STORE_TITLES).put({ id: sid, title });
                }
            };
            getReq.onerror = () => reject(getReq.error);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async getActiveTabIdMeta() {
        await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(STORE_META, "readonly");
            const req = tx.objectStore(STORE_META).get("activeTabID");
            req.onsuccess = () => {
                const row = req.result;
                resolve(row ? row.value : undefined);
            };
            req.onerror = () => reject(req.error);
        });
    },

    async clearActiveTabIdIfMatches(tabId) {
        await this.ensureOpen();
        const tid = String(tabId);
        return new Promise((resolve, reject) => {
            const tx = openReadWriteTx(this._db, [STORE_META]);
            const meta = tx.objectStore(STORE_META);
            const getReq = meta.get("activeTabID");
            getReq.onsuccess = () => {
                const row = getReq.result;
                const cur = row ? row.value : undefined;
                if (cur !== undefined && cur !== null && String(cur) === tid) {
                    meta.delete("activeTabID");
                }
            };
            getReq.onerror = () => reject(getReq.error);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async getGlobalNameQuery() {
        await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(STORE_TITLES, "readonly");
            const store = tx.objectStore(STORE_TITLES);
            if (typeof store.getAll !== "function") {
                const out = emptyNameMap();
                const req = store.openCursor();
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (!cursor) {
                        resolve(out);
                        return;
                    }
                    const row = cursor.value;
                    out[row.id] = row.title != null ? String(row.title) : "";
                    cursor.continue();
                };
                req.onerror = () => reject(req.error);
                return;
            }

            const req = store.getAll();
            req.onsuccess = () => {
                const rows = req.result;
                const out = emptyNameMap();
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    out[row.id] = row.title != null ? String(row.title) : "";
                }
                resolve(out);
            };
            req.onerror = () => reject(req.error);
        });
    },

    async getSettables() {
        return this.getSession("7");
    },

    async setSettables(json) {
        return this.setSession("7", json);
    },
};
