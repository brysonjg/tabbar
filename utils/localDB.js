const DB_NAME = "tabbar-chat-db";
const DB_VERSION = 2;
const STORE_SESSIONS = "sessions";
const STORE_METADATA = "metadata";

const metadataFromSession = (value) => {
    if (!value || typeof value !== "object") return null;
    const metadata = value.metadata;
    return metadata && typeof metadata === "object" ? metadata : null;
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

const readAllRows = (store) => {
    return new Promise((resolve, reject) => {
        if (typeof store.getAll === "function") {
            const req = store.getAll();
            req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
            req.onerror = () => reject(req.error);
            return;
        }

        const rows = [];
        const req = store.openCursor();
        req.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
                resolve(rows);
                return;
            }
            rows.push(cursor.value);
            cursor.continue();
        };
        req.onerror = () => reject(req.error);
    });
};

const mergeMetadataPayload = (sessionPayload, metadataPayload) => {
    const sessionMetadata = sessionPayload && typeof sessionPayload === "object" && sessionPayload.metadata && typeof sessionPayload.metadata === "object"
        ? sessionPayload.metadata
        : {};
    const storeMetadata = metadataPayload && typeof metadataPayload === "object"
        ? metadataPayload
        : {};
    return Object.assign({}, sessionMetadata, storeMetadata);
};

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

                if (db.objectStoreNames.contains("chatTitles")) {
                    db.deleteObjectStore("chatTitles");
                }
                if (db.objectStoreNames.contains("meta")) {
                    db.deleteObjectStore("meta");
                }

                if (!db.objectStoreNames.contains(STORE_METADATA)) {
                    db.createObjectStore(STORE_METADATA, { keyPath: "id" });
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
                ? [STORE_SESSIONS, STORE_METADATA]
                : [STORE_SESSIONS, STORE_METADATA];
            const tx = openReadWriteTx(this._db, stores);
            tx.objectStore(STORE_SESSIONS).put({ id: sid, payload });
            const metadata = metadataFromSession(payload);
            if (syncTitle && metadata) {
                tx.objectStore(STORE_METADATA).put({ id: sid, payload: metadata });
            } else {
                tx.objectStore(STORE_METADATA).delete(sid);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async deleteSession(id) {
        await this.ensureOpen();
        const sid = String(id);
        return new Promise((resolve, reject) => {
            const tx = openReadWriteTx(this._db, [STORE_SESSIONS, STORE_METADATA]);
            tx.objectStore(STORE_SESSIONS).delete(sid);
            tx.objectStore(STORE_METADATA).delete(sid);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async patchSessionTitle(id, title) {
        await this.ensureOpen();
        const sid = String(id);
        const syncTitle = shouldSyncTitleRow(sid);
        const storeNames = syncTitle
            ? [STORE_SESSIONS, STORE_METADATA]
            : [STORE_SESSIONS, STORE_METADATA];
        return new Promise((resolve, reject) => {
            const tx = openReadWriteTx(this._db, storeNames);
            const sessions = tx.objectStore(STORE_SESSIONS);
            const getReq = sessions.get(sid);
            getReq.onsuccess = () => {
                const row = getReq.result;
                const existing = row ? row.payload : null;
                const base = existing && typeof existing === "object" ? existing : {};
                const merged = Object.assign({}, base);
                const baseMetadata = base.metadata && typeof base.metadata === "object"
                    ? base.metadata
                    : {};
                merged.metadata = Object.assign({}, baseMetadata, { title });
                sessions.put({ id: sid, payload: merged });
                if (syncTitle) {
                    tx.objectStore(STORE_METADATA).put({ id: sid, payload: merged.metadata });
                } else {
                    tx.objectStore(STORE_METADATA).delete(sid);
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
            const tx = this._db.transaction(STORE_METADATA, "readonly");
            const req = tx.objectStore(STORE_METADATA).get("activeTabID");
            req.onsuccess = () => {
                const row = req.result;
                resolve(row ? row.payload : undefined);
            };
            req.onerror = () => reject(req.error);
        });
    },

    async clearActiveTabIdIfMatches(tabId) {
        await this.ensureOpen();
        const tid = String(tabId);
        return new Promise((resolve, reject) => {
            const tx = openReadWriteTx(this._db, [STORE_METADATA]);
            const meta = tx.objectStore(STORE_METADATA);
            const getReq = meta.get("activeTabID");
            getReq.onsuccess = () => {
                const row = getReq.result;
                const cur = row ? row.payload : undefined;
                if (cur !== undefined && cur !== null && String(cur) === tid) {
                    meta.delete("activeTabID");
                }
            };
            getReq.onerror = () => reject(getReq.error);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async getGlobalMetadata() {
        await this.ensureOpen();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([STORE_SESSIONS, STORE_METADATA], "readonly");
            const sessionsStore = tx.objectStore(STORE_SESSIONS);
            const metadataStore = tx.objectStore(STORE_METADATA);

            Promise.all([
                readAllRows(sessionsStore),
                readAllRows(metadataStore),
            ]).then(([sessionRows, metadataRows]) => {
                const metadataById = Object.create(null);
                for (const row of metadataRows) {
                    if (!row || typeof row !== "object") continue;
                    const id = row.id != null ? String(row.id) : "";
                    if (!id) continue;
                    metadataById[id] = row.payload;
                }

                const out = [];
                for (const row of sessionRows) {
                    if (!row || typeof row !== "object") continue;
                    const id = row.id != null ? String(row.id) : "";
                    if (!id) continue;

                    const sessionPayload = row.payload && typeof row.payload === "object"
                        ? row.payload
                        : {};
                    out.push({
                        id,
                        payload: mergeMetadataPayload(sessionPayload, metadataById[id]),
                    });
                }

                resolve(out);
            }).catch(reject);
        });
    },

    async getSettables() {
        return this.getSession("7");
    },

    async setSettables(json) {
        return this.setSession("7", json);
    },
};
