async function getTabID() {
    return new Promise((resolve) => {
        function handleTabIDMessage(event) {
            if (event.data && event.data.type === 'fetchTabIDResponse') {
                window.removeEventListener('message', handleTabIDMessage);
                resolve(event.data.result);
            }
        }

        window.addEventListener('message', handleTabIDMessage);
        window.parent.postMessage({ type: 'fetchTabID' }, '*');
    });
}

function closeSelf() {
    window.parent.postMessage({ type: 'exitCurent' }, '*');
}

function makeNewTabWithID(tabID) {
    // this function is privlaged and only works at tab id 0
    // so that on the off chance that the ai leans how to
    // script enject it wont open 30 quintilian tabs

    window.parent.postMessage({ type: 'openTabWithID', tabID: tabID }, '*');
}

async function getGlobalJson() {
    // privlaged like makeNewTabWithID

    return new Promise((resolve) => {
        function handleGJSONMessage(event) {
            if (event.data && event.data.type === 'GJsonReturn') {
                window.removeEventListener('message', handleGJSONMessage);
                resolve(event.data.json);
            }
        }

        window.addEventListener('message', handleGJSONMessage);
        window.parent.postMessage({ type: 'getGJson' }, '*');
    });
}

async function getLocalJson() {
    return new Promise((resolve) => {
        function handleLJSONMessage(event) {
            if (event.data && event.data.type === 'LJsonReturn') {
                window.removeEventListener('message', handleLJSONMessage);
                resolve(event.data.json);
            }
        }

        window.addEventListener('message', handleLJSONMessage);
        window.parent.postMessage({ type: 'getLJson' }, '*');
    });
}

function setLocalJson(json) {
    window.parent.postMessage({ type: 'setLJson', json: json }, '*');
}

function setTabTitle(title) {
    window.parent.postMessage({ type: 'setTitle', title: title }, '*');
}

function purgeTabMemory(tabid) {
    // privlaged function reserved for tab id 0

    window.parent.postMessage({ type: 'purge', tabid: tabid }, '*');
}

function chTitleOfTab(tabid, title) {
    // privlaged function reserved for tab id 0

    window.parent.postMessage({ type: 'chtitle', tabid: tabid, title: title}, '*');
}

// Local registry to manage listeners inside this iframe/frame
const _localKeyRegistry = new Map();

function _normalizeKeyForCompare(k) {
    return k && k.length === 1 ? k.toUpperCase() : k;
}

function _modsMatchEvent(requiredMods = [], e) {
    const modsPressed = {
        Control: !!e.ctrlKey,
        Shift: !!e.shiftKey,
        Alt: !!e.altKey,
        Meta: !!e.metaKey,
        Fn: false
    };

    // required mods must all be pressed
    const allRequired = requiredMods.every(m => modsPressed[m]);

    // no extra mods allowed (ignore Fn)
    const noExtras = Object.keys(modsPressed).every(mod => {
        if (mod === 'Fn') return true;
        return requiredMods.includes(mod) === modsPressed[mod];
    });

    return allRequired && noExtras;
}

function _removeLocalListenersForKey(callKey) {
    const entry = _localKeyRegistry.get(callKey);
    if (!entry) return;
    if (entry.messageListener) window.removeEventListener('message', entry.messageListener);
    if (entry.keydownListener) window.removeEventListener('keydown', entry.keydownListener, true);
    _localKeyRegistry.delete(callKey);
}

// Global message handler to support remote removal/clear requests
window.addEventListener('message', (evt) => {
    if (!evt.data || typeof evt.data.type !== 'string') return;
    if (evt.data.type === 'removeKeyCallbackStruct' && evt.data.callKey) {
        _removeLocalListenersForKey(evt.data.callKey);
    }
    if (evt.data.type === 'clearKeyBindings') {
        for (const key of Array.from(_localKeyRegistry.keys())) {
            _removeLocalListenersForKey(key);
        }
    }
});

// Updated setKeyBindingFromStruct: register both parent-side (via postMessage) and a local keydown listener
function setKeyBindingFromStruct(keybindingStruct, callback) {
    if (typeof keybindingStruct !== 'object' || !keybindingStruct.mods || !keybindingStruct.key) {
        console.error("setKeyBindingFromStruct requires a valid keybinding structure with mods and key properties");
        return;
    }

    if (typeof callback !== 'function') {
        console.error("typeof callback in setKeyBindingFromStruct must be function");
        return;
    }

    // Create a unique callback key
    let callbackKey = `key_callback_${Math.random()}${Date.now()}${Math.random()}`.replace(/\./g, "");

    // Send the full keybinding structure to the parent
    window.parent.postMessage({
        type: 'addKeyCallbackStruct',
        callKey: callbackKey,
        keybinding: keybindingStruct
    }, '*');

    // Message listener (parent -> this frame) to trigger callback when parent forwards event
    const messageListener = function(event) {
        if (event.data?.type === "callbackingKey" && event.data.calling === callbackKey) {
            try { callback(); } catch (err) { console.error('Local callback error', err); }
        }
        // also allow parent/other to ask to remove this binding
        if (event.data?.type === 'removeKeyCallbackStruct' && event.data.callKey === callbackKey) {
            _removeLocalListenersForKey(callbackKey);
        }
    };
    window.addEventListener('message', messageListener);

    // Local keydown listener so shortcuts work when this iframe/document is focused
    const targetKey = _normalizeKeyForCompare(keybindingStruct.key);
    const requiredMods = Array.isArray(keybindingStruct.mods) ? keybindingStruct.mods : [];

    const keydownListener = function(e) {
        try {
            const evKey = _normalizeKeyForCompare(e.key);
            if (evKey !== targetKey) return;
            if (!_modsMatchEvent(requiredMods, e)) return;

            // matched: run callback locally
            e.preventDefault();
            e.stopPropagation();
            try { callback(); } catch (err) { console.error('Local callback execution error', err); }

            // Optionally inform parent that the callback occurred (keeps parent registry informed)
            // window.parent.postMessage({ type: 'callbackingKey', calling: callbackKey }, '*');
        } catch (err) {
            console.error('keydown listener error', err);
        }
    };

    // capture phase to reduce interference, and to get events early in nested frames
    window.addEventListener('keydown', keydownListener, true);

    // Store listeners so they can be removed later
    _localKeyRegistry.set(callbackKey, {
        messageListener,
        keydownListener,
        keybinding: keybindingStruct
    });

    // return the call key so callers can remove if needed
    return callbackKey;
}

window.addEventListener('blur', () => {
    window.parent.postMessage({ type: 'chMod', modulis: false}, '*');
});

window.addEventListener('focus', () => {
    window.parent.postMessage({ type: 'chMod', modulis: true}, '*');
});

function setSettablesByJson(json) {
    // reserved to tab of id 7
    window.parent.postMessage({ type: 'setSETTABLES', json: json }, '*');
}

async function getSettablesAsJson() {
    return new Promise(resolve => {
        const handler = (event) => {
            if (event.data?.type === "settablesJsonReturn") {
                window.removeEventListener("message", handler);
                resolve(event.data.json ?? null);
            }
        };

        window.addEventListener("message", handler);
        window.parent.postMessage({ type: "getSETTABLES" }, "*");

        setTimeout(() => {
            window.removeEventListener("message", handler);
            resolve(null);
        }, 2000);
    });
}

function updateTopLevelTheme() {
    window.parent.postMessage({ type: 'updtTheme' }, '*');
}

function toggleBlueDote() {
    window.parent.postMessage({ type: 'toggleAcctiveDot' }, '*');
}
