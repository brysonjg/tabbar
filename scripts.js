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

const lowZFrames = new Map();
const lowZPriorityQueue = [];

// Add lowZ frame to registry with semantic ordering
function addLowZFrame(tabid, frame) {
    // Remove existing frame for this tabid if it exists
    removeLowZFrame(tabid);

    // Add to registry
    lowZFrames.set(tabid, frame);

    // Add to priority queue (sorted by tabid as semantic ordering)
    lowZPriorityQueue.push({
        tabid,
        frame,
        addedAt: Date.now(),
        priority: getTabPriority(tabid)
    });

    // Sort queue by priority then by addition time
    lowZPriorityQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
            return b.priority - a.priority; // Higher priority first
        }
        return a.addedAt - b.addedAt; // Older first if same priority
    });

    // Update DOM order to match priority
    updateLowZFramesDOMOrder();
}

// Remove lowZ frame from registry
function removeLowZFrame(tabid) {
    const frame = lowZFrames.get(tabid);
    if (frame) {
        // Remove from DOM
        if (frame.parentNode) {
            frame.remove();
        }

        // Remove from registry
        lowZFrames.delete(tabid);

        // Remove from priority queue
        const index = lowZPriorityQueue.findIndex(item => item.tabid === tabid);
        if (index !== -1) {
            lowZPriorityQueue.splice(index, 1);
        }
    }
}

// Get priority for a tabid (higher number = higher priority)
function getTabPriority(tabid) {
    // Special tabs get higher priority
    if (tabid === "0") return 100; // Index tab
    if (tabid === "7") return 90;  // Settings tab
    if (tabid === "4") return 80;  // Documentation tab

    // Regular tabs get priority based on their numeric value
    const num = parseInt(tabid); // note: this will alway
    return isNaN(num) ? 50 : Math.min(num, 70); // Cap at 70 for regular tabs
}

// Update DOM order to match priority queue
function updateLowZFramesDOMOrder() {
    // Remove all frames from DOM
    lowZPriorityQueue.forEach(item => {
        if (item.frame.parentNode) {
            item.frame.parentNode.removeChild(item.frame);
        }
    });

    // Re-add in priority order (highest priority last = highest z-index in stacking context)
    lowZPriorityQueue.forEach(item => {
        document.body.appendChild(item.frame);
    });
}

// Get lowZ frame by tabid
function getLowZFrame(tabid) {
    return lowZFrames.get(tabid);
}

// Get lowZ frame by source window
function getLowZFrameBySource(sourceWindow) {
    for (const [tabid, frame] of lowZFrames.entries()) {
        if (frame.contentWindow === sourceWindow) {
            return { tabid, frame };
        }
    }
    return null;
}

// Clean up all lowZ frames
function cleanupLowZFrames() {
    lowZFrames.forEach((frame, tabid) => {
        if (frame.parentNode) {
            frame.remove();
        }
    });
    lowZFrames.clear();
    lowZPriorityQueue.length = 0;
}

(() => {
    fixThemeSchemaAtTopLeval();

    const savedTabs = localStorage.getItem("tabArray");
    if (!savedTabs) return;

    tabbar.innerHTML = savedTabs;

    if (savedTabs.trim() == "") {
        chungus.src = "./emptydesk.html";
        return;
    }

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
    for (let i = 0; i < 999; i++) {
        result += Math.floor(Math.random() * 10);
    }
    return result;
}

function getTabURLFromID(tabid) {
    const tab = document.querySelector(`.tab[tabid="${tabid}"]`);
    return tab ? tab.getAttribute("data-url") || "./chungus/chungus.html" : "./chungus/chungus.html";
}

// Helper function to set tab title, skipping the active dot if present
function setTabTitle(tab, title) {
    if (!tab) return;
    
    // Find the title text node, skipping the active dot if present
    let titleNode = tab.firstChild;
    
    // Skip the active dot if it's the first child
    if (titleNode && titleNode.classList && titleNode.classList.contains('active-dot')) {
        titleNode = titleNode.nextSibling;
    }
    
    // If we found a text node, update it directly
    if (titleNode && titleNode.nodeType === Node.TEXT_NODE) {
        titleNode.textContent = title;
    } else if (titleNode && titleNode.nodeType === Node.ELEMENT_NODE) {
        // If it's an element, update its textContent
        titleNode.textContent = title;
    } else {
        // Fallback: find first non-dot, non-close child
        for (let child = tab.firstChild; child; child = child.nextSibling) {
            if (child.nodeType === Node.TEXT_NODE) {
                child.textContent = title;
                break;
            } else if (child.nodeType === Node.ELEMENT_NODE &&
                      !child.classList.contains('active-dot') &&
                      !child.classList.contains('close')) {
                child.textContent = title;
                break;
            }
        }
    }
}

function handleCloseClick(tabid) {
    const activeTab = document.querySelector('.tab.active');

    if (activeTab && activeTab.getAttribute("tabid") === tabid) {
        // Active tab -> just send saveQuit
        chungus.contentWindow.postMessage({ type: "saveQuit" }, "*");
    } else {
        // Inactive tab -> create or reuse lowZFrame for this tabid
        let lowZFrame = getLowZFrame(tabid);

        if (!lowZFrame) {
            lowZFrame = document.createElement("iframe");
            lowZFrame.classList.add("lowZFrame");
            lowZFrame.setAttribute("data-tabid", tabid);
            lowZFrame.src = `./chungus/chungus.html?tabid=${tabid}`;
            document.body.appendChild(lowZFrame);

            // Add to registry with semantic ordering
            addLowZFrame(tabid, lowZFrame);

            lowZFrame.addEventListener("load", () => {
                lowZFrame.contentWindow.postMessage({ type: "saveQuit" }, "*");
            });

            // Cleanup on error
            lowZFrame.addEventListener("error", () => {
                removeLowZFrame(tabid);
            });
        } else {
            // Frame already exists, trigger saveQuit
            lowZFrame.contentWindow.postMessage({ type: "saveQuit" }, "*");
        }
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

    if (!activeTab) return;
    if (tabs.length == 1) return;

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
        let tabid = null;

        // Check if message comes from a lowZFrame
        const lowZFrameInfo = getLowZFrameBySource(event.source);
        if (lowZFrameInfo) {
            tabid = lowZFrameInfo.tabid;
        } else if (event.source === chungus.contentWindow) {
            // Message from main iframe
            const activeTab = document.querySelector('.tab.active');
            tabid = activeTab ? activeTab.getAttribute("tabid") : null;
        }

        event.source.postMessage({ type: "fetchTabIDResponse", result: tabid }, "*");
    }

    if (event.data.type === "exitCurent") {
        // Find which frame sent this message
        const lowZFrameInfo = getLowZFrameBySource(event.source);

        if (lowZFrameInfo) {
            // Message from lowZFrame
            const { tabid, frame } = lowZFrameInfo;
            const tabToRemove = document.querySelector(`.tab[tabid="${tabid}"]`);

            if (tabToRemove) {
                const wasActive = tabToRemove.classList.contains("active");
                tabToRemove.remove();

                if (wasActive) {
                    // Switch to another tab if available
                    const remainingTabs = Array.from(document.querySelectorAll('.tab'));
                    if (remainingTabs.length > 0) {
                        setActiveTab(remainingTabs[0]);
                    } else {
                        chungus.src = "./emptydesk.html";
                    }
                }
            }

            // Remove the lowZFrame
            removeLowZFrame(tabid);
        } else if (event.source === chungus.contentWindow) {
            // Message from main iframe (active tab closing)
            const activeTab = document.querySelector('.tab.active');
            const indexOfActiveTab = tabs.indexOf(activeTab);

            if (activeTab) {
                activeTab.remove();

                if (tabs[indexOfActiveTab + 1]) {
                    setActiveTab(tabs[indexOfActiveTab + 1]);
                } else if (tabs[indexOfActiveTab - 1]) {
                    setActiveTab(tabs[indexOfActiveTab - 1]);
                } else {
                    chungus.src = "./emptydesk.html";
                }
            }
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
    const activeTabID = activeTab ? activeTab.getAttribute('tabid') : null;

    if (type === "getLJson") {
        if (!activeTab || !activeTabID) {
            event.source.postMessage({ type: "LJsonReturn", json: null }, "*");
            return;
        }
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
        if (!activeTab || !activeTabID) return;
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
        setTabTitle(activeTab, event.data.title);
    }

    if (type === "purge") {
        if (!activeTab || activeTab.getAttribute("tabid") !== "0") return;

        const targetTabID = event.data.tabid;
        if (!targetTabID) return;

        // Remove lowZFrame if it exists
        removeLowZFrame(targetTabID);

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

        setTabTitle(tabInQuestion, title);

        let json = localStorage.getItem("ChatJson");
        if (!json) return;

        json = JSON.parse(json);

        if (!json[tabid]) json[tabid] = {};
        if (!json[tabid].metadata) json[tabid].metadata = {};

        json[tabid].metadata.title = title;
        localStorage.setItem("ChatJson", JSON.stringify(json));
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
                setTabTitle(indexTab, "Index");
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

    if (type == "toggleAcctiveDot") {
        function getTabIDFromSource(sourceWindow) {
            // Check if it's a lowZFrame
            const lowZFrameInfo = getLowZFrameBySource(sourceWindow);
            if (lowZFrameInfo) {
                return lowZFrameInfo.tabid;
            }

            // Check if it's the main iframe (chungus)
            if (sourceWindow === chungus.contentWindow) {
                const activeTab = document.querySelector('.tab.active');
                return activeTab ? activeTab.getAttribute("tabid") : null;
            }

            // Not from a known source
            return null;
        }

        let tabid = getTabIDFromSource(event.source);
        let tabdiv = document.querySelector(`div.tab[tabid="${tabid}"]`);

        if (!tabdiv) return;

        // Check if the dot already exists
        let existingDot = tabdiv.querySelector('.active-dot');

        if (existingDot) {
            // If dot exists, remove it
            existingDot.remove();
        } else {
            // Create new dot element
            let dot = document.createElement('div');
            dot.className = 'active-dot';
            dot.textContent = '●';

            if (tabdiv.firstChild && tabdiv.firstChild.nodeType === Node.TEXT_NODE) {
                tabdiv.insertBefore(dot, tabdiv.firstChild);
            } else {
                // Otherwise insert at the beginning
                tabdiv.insertBefore(dot, tabdiv.firstElementChild || tabdiv.firstChild);
            }
        }
    }

    if (type == "setAcctiveDot") {
        function getTabIDFromSource(sourceWindow) {
            // Check if it's a lowZFrame
            const lowZFrameInfo = getLowZFrameBySource(sourceWindow);
            if (lowZFrameInfo) {
                return lowZFrameInfo.tabid;
            }

            // Check if it's the main iframe (chungus)
            if (sourceWindow === chungus.contentWindow) {
                const activeTab = document.querySelector('.tab.active');
                return activeTab ? activeTab.getAttribute("tabid") : null;
            }

            // Not from a known source
            return null;
        }

        let tabid = getTabIDFromSource(event.source);
        let tabdiv = document.querySelector(`div.tab[tabid="${tabid}"]`);

        if (!tabdiv) return;

        let wantsBlueDot = (event.data.do == "true");

        if (!(typeof wantsBlueDot == "boolean")) return;

        // Check if the dot already exists
        let existingDot = tabdiv.querySelector('.active-dot');

        if (!wantsBlueDot) {
            if (existingDot) {
                existingDot.remove();
            }
        } else {
            if (!existingDot) {
                // Create new dot element
                let dot = document.createElement('div');
                dot.className = 'active-dot';
                dot.textContent = '●';

                if (tabdiv.firstChild && tabdiv.firstChild.nodeType === Node.TEXT_NODE) {
                    tabdiv.insertBefore(dot, tabdiv.firstChild);
                } else {
                    // Otherwise insert at the beginning
                    tabdiv.insertBefore(dot, tabdiv.firstElementChild || tabdiv.firstChild);
                }
            }
        }
    }

    if (type == "getAcctiveDot") {
        function getTabIDFromSource(sourceWindow) {
            // Check if it's a lowZFrame
            const lowZFrameInfo = getLowZFrameBySource(sourceWindow);
            if (lowZFrameInfo) {
                return lowZFrameInfo.tabid;
            }

            // Check if it's the main iframe (chungus)
            if (sourceWindow === chungus.contentWindow) {
                const activeTab = document.querySelector('.tab.active');
                return activeTab ? activeTab.getAttribute("tabid") : null;
            }

            // Not from a known source
            return null;
        }

        let tabid = getTabIDFromSource(event.source);
        let tabdiv = document.querySelector(`div.tab[tabid="${tabid}"]`);

        if (!tabdiv) return;

        // Check if the dot already exists
        let existingDot = tabdiv.querySelector('.active-dot');

        event.source.postMessage({type: "getBlueDotReturn", result: String(!!existingDot)}, "*");
    }
});

document.getElementById("newTabBtn").addEventListener("click", (event) => {
    event.preventDefault();
    createNewTab();
});

document.getElementById("indexSw").addEventListener("click", () => {
    let indexTab = document.querySelector('.tab[tabid="0"]');

    if (indexTab) {
        if (!indexTab.textContent.includes("Index")) {
            indexTab.firstChild.textContent = "Index";
        }
        setActiveTab(indexTab);
    } else {
        let newTab = document.createElement("div");
        newTab.classList.add("tab");
        newTab.innerHTML = `
            Index
            <div class="close">&nbsp;</div>
        `;
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
});

document.getElementById("settings").addEventListener("click", () => {
    let settingsTab = document.querySelector('.tab[tabid="7"]');

    if (settingsTab) {
        if (!settingsTab.textContent.includes("Settings")) {
            setTabTitle(settingsTab, "Settings");
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
            setTabTitle(settingsTab, "Documentation");
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
    // Clean up all lowZ frames before unloading
    cleanupLowZFrames();
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
