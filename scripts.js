let tabs = Array.from(document.querySelectorAll('.tab'));
let closeButtons = document.querySelectorAll('.close');
let tabbar = document.getElementById("tabContainer");
const chungus = document.getElementById("chungusmain");

let draggedTab = null;
let placeholder = null;
let tabRects = [];
let currentIndex = 0;
let isDragging = false;
let grabOffsetX = 0;
let dragStartX = 0;
let dragStartY = 0;
let hasMovedEnough = false;

let isWindowActive = true;
let isIFrameActive = false;

// Add registry for key callbacks (callKey -> { listener, keybinding, source })
const keyCallbackRegistry = new Map();

// Helper: normalize an event key to comparable form
function normalizeEventKey(e) {
    // single-character keys -> uppercase, others use e.key as-is
    return e.key && e.key.length === 1 ? e.key.toUpperCase() : e.key;
}

// Helper: normalize registered binding key for comparison
function normalizeBindingKey(key) {
    return key && key.length === 1 ? key.toUpperCase() : key;
}

// Helper: check exact modifier match (required mods pressed, no extra modifier pressed)
// mods in keybinding expected to be strings like "Control","Shift","Alt","Meta"
function modifiersExactlyMatch(e, requiredMods = []) {
    const modsPressed = {
        Control: !!e.ctrlKey,
        Shift: !!e.shiftKey,
        Alt: !!e.altKey,
        Meta: !!e.metaKey,
        Fn: false
    };

    // Required mods must all be true
    const allRequired = requiredMods.every(m => modsPressed[m]);

    // No extra mods allowed (ignore Fn)
    const noExtras = Object.keys(modsPressed).every(mod => {
        if (mod === 'Fn') return true;
        return requiredMods.includes(mod) === modsPressed[mod];
    });

    return allRequired && noExtras;
}

(() => {
    fixThemeSchemaAtTopLeval();

    const savedTabs = localStorage.getItem("tabArray");
    if (!savedTabs) return;

    tabbar.innerHTML = savedTabs;

    tabs = Array.from(document.querySelectorAll('.tab'));

    tabs.forEach(addTabListeners);
    fixTabCloseEventListeners();

    setActiveTab(document.querySelector(".tab.active"));
})();

tabs.forEach(addTabListeners);

function addTabListeners(tab) {
    tab.addEventListener("mousedown", (e) => {
        draggedTab = tab;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        grabOffsetX = e.clientX - tab.getBoundingClientRect().left;
        hasMovedEnough = false;

        e.preventDefault();
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    tab.addEventListener("click", (e) => {
        if (hasMovedEnough) {
            e.preventDefault();
            return;
        }
        setActiveTab(tab);
    });
}

function setActiveTab(tab) {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    if (!chungus) return;

    const tabid = tab.getAttribute("tabid");
    const dataURL = tab.getAttribute("data-url") || "./chungus/chungus.html";

    if (tabid === "0") {
        chungus.src = "./index/indx.html";
    } else {
        chungus.src = dataURL;
    }
}

function startDrag() {
    isDragging = true;
    document.body.classList.add("dragging-tabs");

    const overlay = document.createElement("div");
    overlay.classList.add("overlay");
    overlay.id = "overlay";
    document.body.appendChild(overlay);

    tabRects = tabs.map(t => t.getBoundingClientRect());
    currentIndex = tabs.indexOf(draggedTab);

    placeholder = document.createElement("div");
    placeholder.className = "tab-placeholder";
    placeholder.style.width = `${draggedTab.offsetWidth}px`;
    tabbar.insertBefore(placeholder, draggedTab.nextSibling);

    let rect = draggedTab.getBoundingClientRect();
    draggedTab.classList.add("dragged");
    draggedTab.style.left = `${rect.left}px`;
}

function onMouseMove(e) {
    if (!draggedTab) return;

    if (!isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 7) {
            hasMovedEnough = true;
            startDrag();
        } else return;
    }

    let newLeft = e.clientX - grabOffsetX;
    draggedTab.style.left = `${newLeft}px`;

    let mouseX = e.clientX;
    let newIndex = 0;
    for (let i = 0; i < tabRects.length; i++) {
        let midpoint = tabRects[i].left + tabRects[i].width / 2;
        if (mouseX > midpoint) newIndex = i + 1;
    }

    if (newIndex !== currentIndex) {
        currentIndex = newIndex;
        placeholder.remove();
        if (currentIndex >= tabs.length) {
            tabbar.appendChild(placeholder);
        } else {
            tabbar.insertBefore(placeholder, tabs[currentIndex]);
        }
    }

    tabs.forEach((t, i) => {
        if (t === draggedTab) return;
        let shift = 0;
        if (i >= currentIndex) shift = draggedTab.offsetWidth / 5;
        t.style.transform = `translateX(${shift}px)`;
    });
}

function onMouseUp() {
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.remove();

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    if (!isDragging || !draggedTab) {
        draggedTab = null;
        return;
    }

    isDragging = false;
    document.body.classList.remove("dragging-tabs");

    let targetRect = placeholder.getBoundingClientRect();
    draggedTab.style.transition = "left 150ms cubic-bezier(.25,.8,.25,1)";
    draggedTab.style.left = `${targetRect.left}px`;

    setTimeout(() => {
        tabbar.insertBefore(draggedTab, placeholder);
        placeholder.remove();
        placeholder = null;

        draggedTab.classList.remove("dragged");
        draggedTab.style.left = "";
        draggedTab.style.transition = "";

        tabs.forEach(t => t.style.transform = "");
        tabs = Array.from(document.querySelectorAll('.tab'));
        draggedTab = null;
    }, 150);
}

function makeNewTabID() {
    let result = '';
    result += Math.floor(Math.random() * 9) + 1;
    for (let i = 0; i < 63; i++) {
        result += Math.floor(Math.random() * 10);
    }
    return result;
}

// Get tab's stored URL or fallback to default
function getTabURLFromID(tabid) {
    const tab = document.querySelector(`.tab[tabid="${tabid}"]`);
    return tab ? tab.getAttribute("data-url") || "./chungus/chungus.html" : "./chungus/chungus.html";
}

function handleCloseClick(tabid) {
    const activeTab = document.querySelector('.tab.active');

    if (activeTab && activeTab.getAttribute("tabid") === tabid) {
        // Active tab -> just send saveQuit
        chungus.contentWindow.postMessage({ type: "saveQuit" }, "*");
    } else {
        // Inactive tab -> load real chungus.html hidden, let it quit gracefully
        const lowZFrame = document.createElement("iframe");
        lowZFrame.classList.add("lowZFrame");
        lowZFrame.setAttribute("data-tabid", tabid);
        lowZFrame.src = `./chungus/chungus.html?tabid=${tabid}`;
        document.body.appendChild(lowZFrame);

        lowZFrame.addEventListener("load", () => {
            lowZFrame.contentWindow.postMessage({ type: "saveQuit" }, "*");
        });
    }
}

function fixTabCloseEventListeners() {
    const closeButtons = document.querySelectorAll('.close');

    closeButtons.forEach((closeBTN) => {
        const tabToClose = closeBTN.parentElement.getAttribute("tabid");

        closeBTN.onclick = (e) => {
            e.stopPropagation();
            handleCloseClick(tabToClose);
        };
    });
}

// Unified new tab creation function
function createNewTab() {
    let newTab = document.createElement("div");
    newTab.classList.add("tab");
    newTab.innerHTML = `
        New Tab
        <div class="close">&nbsp;</div>
    `;
    newTab.setAttribute('tabid', makeNewTabID());
    newTab.setAttribute('data-url', "./chungus/chungus.html");
    tabbar.appendChild(newTab);
    addTabListeners(newTab);
    tabs = Array.from(document.querySelectorAll('.tab'));
    setActiveTab(newTab);
    fixTabCloseEventListeners();
}

tabbar.addEventListener("dblclick", (event) => {
    event.preventDefault();
    createNewTab();
});

tabbar.addEventListener("wheel", (event) => {
    event.preventDefault();
    const activeTab = document.querySelector('.tab.active');

    let currentIndex = tabs.indexOf(activeTab);
    currentIndex += event.deltaY / Math.abs(event.deltaY);
    currentIndex += tabs.length;
    currentIndex %= tabs.length;

    setActiveTab(tabs[currentIndex]);

}, { passive: false });

tabbar.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

fixTabCloseEventListeners();

window.addEventListener("message", (event) => {
    if (!event.data) return;

    if (event.data.type === "fetchTabID") {
        const activeTab = document.querySelector('.tab.active');
        let tabid = activeTab ? activeTab.getAttribute("tabid") : null;

        // Special case: respond with lowZFrame's own tabid if it asks
        const lowZFrame = document.querySelector("iframe.lowZFrame");
        if (lowZFrame && event.source === lowZFrame.contentWindow) {
            tabid = lowZFrame.getAttribute("data-tabid");
        }

        event.source.postMessage({ type: "fetchTabIDResponse", result: tabid }, "*");
    }

    if (event.data.type === "exitCurent") {
        const lowZFrame = document.querySelector("iframe.lowZFrame");
        if (lowZFrame) {
            const tabid = lowZFrame.getAttribute("data-tabid");
            const tabToRemove = document.querySelector(`.tab[tabid="${tabid}"]`);
            if (tabToRemove) tabToRemove.remove();
            lowZFrame.remove();
        } else {
            const activeTab = document.querySelector('.tab.active');
            const indexOfActiveTab = tabs.indexOf(activeTab);
            if (tabs[indexOfActiveTab + 1]) {
                setActiveTab(tabs[indexOfActiveTab + 1]);
            } else if (tabs[indexOfActiveTab - 1]) {
                setActiveTab(tabs[indexOfActiveTab - 1]);
            } else {
                chungus.src = "about:blank";
            }
            activeTab.remove();
        }
        tabs = Array.from(document.querySelectorAll('.tab'));
    }

    if (event.data.type === "openTabWithID") {
        const activeTab = document.querySelector('.tab.active');
        if (!activeTab || activeTab.getAttribute('tabid') !== "0") return;

        let lookingForTab = document.querySelector(`.tab[tabid="${event.data.tabID}"]`);
        if (lookingForTab) {
            setActiveTab(lookingForTab);
            return;
        }

        let newTab = document.createElement("div");
        newTab.classList.add("tab");
        newTab.innerHTML = `
            New Tab
            <div class="close">&nbsp;</div>
        `;
        newTab.setAttribute('tabid', event.data.tabID);
        newTab.setAttribute('data-url', "./chungus/chungus.html");
        tabbar.appendChild(newTab);
        addTabListeners(newTab);
        tabs = Array.from(document.querySelectorAll('.tab'));
        setActiveTab(newTab);
        fixTabCloseEventListeners();
    }

    if (event.data.type === "getGJson") {
        const activeTab = document.querySelector('.tab.active');
        if (!activeTab || activeTab.getAttribute('tabid') !== "0") {
            event.source.postMessage({ type: "GJsonReturn", json: "Error Low Privlage" }, "*");
            return;
        }

        if (localStorage.getItem("ChatJson") !== null) {
            const json = JSON.parse(localStorage.getItem("ChatJson"));
            event.source.postMessage({ type: "GJsonReturn", json: json }, "*");
        } else {
            localStorage.setItem("ChatJson", JSON.stringify({}));
        }
    }

    if (!event.data || typeof event.data.type !== "string") return;

    const type = event.data.type;

    const activeTab = document.querySelector('.tab.active');
    if (!activeTab) return;

    const activeTabID = activeTab.getAttribute('tabid');
    if (!activeTabID) return;

    if (type === "getLJson") {
        let jsonStore = localStorage.getItem("ChatJson");
        if (!jsonStore) {
            jsonStore = "{}";
            localStorage.setItem("ChatJson", jsonStore);
        }

        const json = JSON.parse(jsonStore);
        const response = (activeTabID in json) ? json[activeTabID] : null;

        event.source.postMessage({ type: "LJsonReturn", json: response }, "*");
    }

    if (type === "setLJson") {
        let jsonStore = localStorage.getItem("ChatJson");
        if (!jsonStore) {
            jsonStore = "{}";
        }

        const json = JSON.parse(jsonStore);
        json[activeTabID] = event.data.json;

        localStorage.setItem("ChatJson", JSON.stringify(json));
    }

    if (type === "setTitle") {
        const activeTab = document.querySelector('.tab.active');
        if (!activeTab) return;

        const escapeHTML = str =>
            str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/\>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

        // Update only the text node (assumes firstChild is text)
        activeTab.firstChild.textContent = escapeHTML(event.data.title);
    }

    if (type === "purge") {
        if (!activeTab || activeTab.getAttribute("tabid") !== "0") return;

        const targetTabID = event.data.tabid;
        if (!targetTabID) return;

        let json = localStorage.getItem("ChatJson");
        if (!json) return;

        json = JSON.parse(json);

        if (json[targetTabID]) {
            delete json[targetTabID];
        }

        if (json.activeTabID === targetTabID) {
            delete json.activeTabID;
        }

        localStorage.setItem("ChatJson", JSON.stringify(json));

        const targetTab = document.querySelector(`.tab[tabid="${targetTabID}"]`);
        if (!targetTab) return;
        const wasActive = targetTab.classList.contains("active");

        if (wasActive) {
            const index = tabs.indexOf(targetTab);
            let nextTab = tabs[index + 1] || tabs[index - 1];
            if (nextTab) setActiveTab(nextTab);
        }

        targetTab.remove();
        tabs = Array.from(document.querySelectorAll(".tab"));
    }

    if (type === "chtitle") {
        const activeTab = document.querySelector('.tab.active');
        if (!activeTab || activeTab.getAttribute("tabid") !== "0") return;

        const { tabid, title } = event.data;
        if (!tabid || typeof title !== "string") return;

        const tabInQuestion = document.querySelector(`.tab[tabid="${tabid}"]`);
        if (!tabInQuestion) return;

        // Escape HTML safely
        const escapeHTML = str =>
            str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/\>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

        if (tabInQuestion.firstChild) {
            tabInQuestion.firstChild.textContent = escapeHTML(title);
        }

        // Update local storage JSON
        let json = localStorage.getItem("ChatJson");
        if (!json) return;

        json = JSON.parse(json);

        if (!json[tabid]) json[tabid] = {};
        if (!json[tabid].metadata) json[tabid].metadata = {};

        json[tabid].metadata.title = title;
        localStorage.setItem("ChatJson", JSON.stringify(json));
    }

    // New: register a key callback in a removable/managed way
    if (event.data.type === "addKeyCallbackStruct") {
        const keybinding = event.data.keybinding;
        const call = event.data.callKey;
        const source = event.source;

        if (!keybinding || !call) return;

        // Normalize stored key for comparison
        const targetKey = normalizeBindingKey(keybinding.key);

        // Build listener
        const listener = function(e) {
            try {
                // Normalize and compare key
                const evKey = normalizeEventKey(e);
                if (evKey !== targetKey) return;

                // Verify modifiers exactly match required set
                const requiredMods = Array.isArray(keybinding.mods) ? keybinding.mods : [];
                if (!modifiersExactlyMatch(e, requiredMods)) return;

                // Matched: forward the callback trigger back to the source frame that registered it
                e.preventDefault();
                e.stopPropagation();
                // Ensure source is still available
                if (source && typeof source.postMessage === "function") {
                    source.postMessage({ type: "callbackingKey", calling: call }, "*");
                }
            } catch (err) {
                console.error('Key callback error', err);
            }
        };

        // Attach and store so we can remove later
        document.addEventListener("keydown", listener, true);
        keyCallbackRegistry.set(call, { listener, keybinding, source });
        return;
    }

    // Remove a single registered callback
    if (event.data.type === "removeKeyCallbackStruct") {
        const call = event.data.callKey;
        const entry = keyCallbackRegistry.get(call);
        if (entry) {
            document.removeEventListener("keydown", entry.listener, true);
            keyCallbackRegistry.delete(call);
        }
        return;
    }

    // Clear all registered callbacks (used when a frame reloads to avoid duplicates)
    if (event.data.type === "clearKeyBindings") {
        for (const [call, entry] of keyCallbackRegistry) {
            document.removeEventListener("keydown", entry.listener, true);
        }
        keyCallbackRegistry.clear();
        return;
    }

    if (type == "chMod") {
        const modulis = event.data.modulis;
        const activeTab = document.querySelector('.tab.active');

        if (activeTab && activeTab === document.querySelector(`.tab[tabid="${activeTabID}"]`)) {
            if (modulis) {
                document.body.classList.remove('window-inactive');
                isIFrameActive = true;
            } else {
                isIFrameActive = false;
                setTimeout(
                    () => {
                        if (!isWindowActive) {
                            document.body.classList.add('window-inactive');
                        }
                    },
                    10
                );
            }
        }
    }

    if (type == "setSETTABLES") {
        if (!activeTab || activeTab.getAttribute("tabid") !== "7") return;

        let jsonStore = localStorage.getItem("ChatJson");
        if (!jsonStore) {
            jsonStore = "{}";
        }

        const json = JSON.parse(jsonStore);
        json[7] = event.data.json;

        localStorage.setItem("ChatJson", JSON.stringify(json));
    }

    if (type == "getSETTABLES") {
        let jsonStore = localStorage.getItem("ChatJson");
        if (!jsonStore) {
            jsonStore = "{}";
            localStorage.setItem("ChatJson", jsonStore);
        }

        const json = JSON.parse(jsonStore);
        const response = (7 in json) ? json[7] : null;

        event.source.postMessage({ type: "settablesJsonReturn", json: response }, "*");
    }

    if (type == "updtTheme") {
        fixThemeSchemaAtTopLeval();
    }

    if (type == "newTabEvent") {
        createNewTab();
    }

    if (type == "IndxSWPEvent") {
        let indexTab = document.querySelector('.tab[tabid="0"]');
        if (indexTab) {
            if (!indexTab.textContent.includes("Index")) {
                indexTab.firstChild.textContent = "Index";
            }
            setActiveTab(indexTab);
        } else {
            let newTab = document.createElement("div");
            newTab.classList.add("tab");
            newTab.innerHTML = `\nIndex\n<div class="close">&nbsp;</div>`;
            newTab.setAttribute('tabid', "0");
            newTab.setAttribute('data-url', "./chungus/chungus.html");
            if (tabbar.firstChild) {
                tabbar.insertBefore(newTab, tabbar.firstChild);
            } else {
                tabbar.appendChild(newTab);
            }
            addTabListeners(newTab);
            tabs = Array.from(document.querySelectorAll('.tab'));
            setActiveTab(newTab);
            fixTabCloseEventListeners();
        }
    }
});

document.getElementById("newTabBtn").addEventListener("click", (event) => {
    event.preventDefault();
    createNewTab();
});

document.getElementById("indexSw").addEventListener("click", () => {
    // Look for a tab with tabid "0"
    let indexTab = document.querySelector('.tab[tabid="0"]');

    if (indexTab) {
        // If tab exists but text isn't "index", rename it
        if (!indexTab.textContent.includes("Index")) {
            indexTab.firstChild.textContent = "Index";
        }
        // Switch to the existing tab
        setActiveTab(indexTab);
    } else {
        // Create new "index" tab at the start
        let newTab = document.createElement("div");
        newTab.classList.add("tab");
        newTab.innerHTML = `
            Index
            <div class="close">&nbsp;</div>
        `;
        newTab.setAttribute('tabid', "0");
        newTab.setAttribute('data-url', "./chungus/chungus.html");

        // Insert at the start of tab bar
        if (tabbar.firstChild) {
            tabbar.insertBefore(newTab, tabbar.firstChild);
        } else {
            tabbar.appendChild(newTab);
        }

        addTabListeners(newTab);
        tabs = Array.from(document.querySelectorAll('.tab'));
        setActiveTab(newTab);
        fixTabCloseEventListeners();
    }
});

document.getElementById("settings").addEventListener("click", () => {
    let settingsTab = document.querySelector('.tab[tabid="7"]');

    if (settingsTab) {
        if (!settingsTab.textContent.includes("Settings")) {
            settingsTab.firstChild.textContent = "Settings";
        }
        setActiveTab(settingsTab);
        return;
    }

    let newTab = document.createElement("div");
    newTab.classList.add("tab");
    newTab.innerHTML = `
    Settings
    <div class="close">&nbsp;</div>
    `;
    newTab.setAttribute('tabid', "7");
    newTab.setAttribute('data-url', "./settings/settings.html");

    tabbar.appendChild(newTab);

    addTabListeners(newTab);
    tabs = Array.from(document.querySelectorAll('.tab'));
    setActiveTab(newTab);
    fixTabCloseEventListeners();
});

document.getElementById("documentation").addEventListener("click", () => {
    let settingsTab = document.querySelector('.tab[tabid="4"]');

    if (settingsTab) {
        if (!settingsTab.textContent.includes("Documentation")) {
            settingsTab.firstChild.textContent = "Documentation";
        }
        setActiveTab(settingsTab);
        return;
    }

    let newTab = document.createElement("div");
    newTab.classList.add("tab");
    newTab.innerHTML = `
    Documentation
    <div class="close">&nbsp;</div>
    `;
    newTab.setAttribute('tabid', "4");
    newTab.setAttribute('data-url', "./documentation/docs.html");

    tabbar.appendChild(newTab);

    addTabListeners(newTab);
    tabs = Array.from(document.querySelectorAll('.tab'));
    setActiveTab(newTab);
    fixTabCloseEventListeners();
});

document.getElementById("rmTabBtn").addEventListener("click", () => {
    chungus.contentWindow.postMessage({ type: "saveQuit" }, "*");
});

window.addEventListener('beforeunload', (e) => {
    localStorage.setItem("tabArray", tabbar.innerHTML);
});

window.addEventListener('blur', () => {
    isWindowActive = false;
    setTimeout(
        () => {
            if (!isIFrameActive) {
                document.body.classList.add('window-inactive');
            }
        },
        10
    );
});

window.addEventListener('focus', () => {
    document.body.classList.remove('window-inactive');
    isWindowActive = true;
});
