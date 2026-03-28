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
let originalDragIndex = 0;
const dragVerticalTolerancePixels = 60;

function getClosestInsertionIndex(referenceX, tabElements, currentInsertionIndex) {
    if (!Array.isArray(tabElements) || tabElements.length === 0) return 0;

    const rects = tabElements.map(tabElement => tabElement.getBoundingClientRect());
    const gapXs = new Array(rects.length + 1);
    gapXs[0] = rects[0].left;
    for (let index = 1; index < rects.length; index++) {
        gapXs[index] = (rects[index - 1].right + rects[index].left) / 2;
    }
    gapXs[gapXs.length - 1] = rects[rects.length - 1].right;

    let bestIndex = 0;
    let bestDistance = Math.abs(referenceX - gapXs[0]);
    for (let index = 1; index < gapXs.length; index++) {
        const distance = Math.abs(referenceX - gapXs[index]);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    }

    if (typeof currentInsertionIndex !== "number" || currentInsertionIndex < 0 || currentInsertionIndex >= gapXs.length) {
        return bestIndex;
    }

    const currentDistance = Math.abs(referenceX - gapXs[currentInsertionIndex]);
    return bestDistance < currentDistance ? bestIndex : currentInsertionIndex;
}

let isWindowActive = true;
let isIFrameActive = false;

const lowZFrames = new Map();
const lowZPriorityQueue = [];
let loadingTabInSwitching = false;

function getTabElements() {
    tabs = Array.from(document.querySelectorAll(".tab"));
    return tabs;
}

function getActiveTabElement() {
    return document.querySelector(".tab.active");
}

function getTabIndexForElement(tabElement) {
    if (!tabElement) return -1;
    return getTabElements().indexOf(tabElement);
}

function getTabElementById(tabIdentifier) {
    if (!tabIdentifier) return null;
    return document.querySelector(`.tab[tabid="${tabIdentifier}"]`);
}

function applyAriaAttributesToTabbar() {
    if (!tabbar) return;
    tabbar.setAttribute("role", "tablist");
}

function applyAriaAttributesToTab(tabElement) {
    if (!tabElement) return;
    const tabIdentifier = tabElement.getAttribute("tabid") || "";
    tabElement.setAttribute("role", "tab");
    tabElement.setAttribute("aria-selected", tabElement.classList.contains("active") ? "true" : "false");
}

function applyAriaAttributesToAllTabs() {
    const tabElements = getTabElements();
    for (let index = 0; index < tabElements.length; index++) {
        applyAriaAttributesToTab(tabElements[index]);
    }
}

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

(async () => {
    startCorectTabChecksumScedual(100);

    const savedTabs = localStorage.getItem("tabArray");
    if (!savedTabs) {
        chungus.src = "./index/indx.html";
        return;
    }

    tabbar.innerHTML = savedTabs;

    if (savedTabs.trim() == "") {
        chungus.src = "./emptydesk.html";
        return;
    }

    applyAriaAttributesToTabbar();
    tabs = getTabElements();
    tabs.forEach(addTabListeners);
    applyAriaAttributesToAllTabs();
    fixTabCloseEventListeners();

    setActiveTab(document.querySelector(".tab.active"));

    try {
        await localDB.ensureOpen();
    } catch (e) {
        console.warn("localDB ensureOpen failed:", e);
        return;
    }

    let settables = await localDB.getSettables();
    if (!settables || typeof settables !== "object") {
        settables = {};
    }

    if (settables.theme === undefined) {
        settables.theme = window.theme_brz_dark;
        await localDB.setSettables(settables);
    }

    fixThemeSchemaAtTopLeval();
})();

applyAriaAttributesToTabbar();
tabs.forEach(addTabListeners);
applyAriaAttributesToAllTabs();

function addTabListeners(tab) {
    tab.addEventListener("mousedown", (mouseEvent) => {
        if (mouseEvent.button !== 0) return;

        draggedTab = tab;
        dragStartX = mouseEvent.clientX;
        dragStartY = mouseEvent.clientY;
        grabOffsetX = mouseEvent.clientX - tab.getBoundingClientRect().left;
        hasMovedEnough = false;
        originalDragIndex = getTabIndexForElement(tab);

        mouseEvent.preventDefault();
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("keydown", onKeyDownDuringDrag);
    });

    tab.addEventListener("click", (mouseEvent) => {
        if (hasMovedEnough) {
            mouseEvent.preventDefault();
            return;
        }
        setActiveTab(tab);
    });

    tab.addEventListener("auxclick", (mouseEvent) => {
        if (mouseEvent.button !== 1) return;
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();
        const tabIdentifier = tab.getAttribute("tabid");
        if (!tabIdentifier) return;
        handleCloseClick(tabIdentifier);
    });
}

function setActiveTab(tab) {
    if (!tab) return;
    if (!chungus) return;

    let tabsCopy = [...getTabElements()];
    tabsCopy = tabsCopy.filter(t => t !== tab);
    tab.classList.add("active");
    tabsCopy.forEach(t => t.classList.remove("active"));

    applyAriaAttributesToAllTabs();

    if (loadingTabInSwitching) return;
    loadingTabInSwitching = true;

    if (!chungus.src.endsWith("about:blank")) chungus.src = "about:blank";

    const tabid = tab.getAttribute("tabid");
    const dataURL = tab.getAttribute("data-url") || "./chungus/chungus.html";

    chungus.onload = () => {
        loadingTabInSwitching = false;
    };

    // Use requestAnimationFrame to schedule next load safely
    requestAnimationFrame(() => {
        chungus.src = dataURL;
    });
}

function startCorectTabChecksumScedual(interval) {
    setInterval(() => {
        const activeTab = document.querySelector(".tab.active");
        if (!activeTab) return;

        const activeTabURL = new URL(activeTab.dataset.url, document.baseURI).pathname;
        const currentURL = new URL(chungus.src).pathname;

        if (currentURL !== activeTabURL) {
            chungus.src = activeTab.dataset.url;
        }
    }, interval);
}

function startDrag() {
    isDragging = true;
    document.body.classList.add("dragging-tabs");

    const overlay = document.createElement("div");
    overlay.classList.add("overlay");
    overlay.id = "overlay";
    document.body.appendChild(overlay);

    tabRects = getTabElements().map(tabElement => tabElement.getBoundingClientRect());
    currentIndex = getTabIndexForElement(draggedTab);

    placeholder = document.createElement("div");
    placeholder.className = "tab-placeholder";
    placeholder.style.width = `${draggedTab.offsetWidth + 2}px`; // accounting for the borders as well as the body
    tabbar.insertBefore(placeholder, draggedTab.nextSibling);

    let rect = draggedTab.getBoundingClientRect();
    draggedTab.classList.add("dragged");
    draggedTab.style.left = `${rect.left}px`;
}

function onMouseMove(e) {
    if (!draggedTab) return;

    if (!isDragging) {
        const distanceXFromDragStart = e.clientX - dragStartX;
        const distanceYFromDragStart = e.clientY - dragStartY;
        const distanceFromDragStart = Math.sqrt(distanceXFromDragStart * distanceXFromDragStart + distanceYFromDragStart * distanceYFromDragStart);

        if (distanceFromDragStart > 7) {
            hasMovedEnough = true;
            startDrag();
        } else {
            return;
        }
    }

    const newLeftPosition = e.clientX - grabOffsetX;
    draggedTab.style.left = `${newLeftPosition}px`;

    const draggedRect = draggedTab.getBoundingClientRect();
    const referenceX = draggedRect.left + draggedRect.width / 2;

    const tabsBefore = getTabElements();
    const tabsBeforeExcludingDragged = tabsBefore.filter(tab => tab !== draggedTab);

    const newIndex = getClosestInsertionIndex(referenceX, tabsBeforeExcludingDragged, currentIndex);

    if (newIndex !== currentIndex) {
        const firstRects = new Map();
        tabsBeforeExcludingDragged.forEach(tab => {
            firstRects.set(tab, tab.getBoundingClientRect());
        });

        currentIndex = newIndex;

        placeholder.remove();
        if (currentIndex >= tabsBeforeExcludingDragged.length) {
            tabbar.appendChild(placeholder);
        } else {
            tabbar.insertBefore(placeholder, tabsBeforeExcludingDragged[currentIndex]);
        }

        const tabsAfterExcludingDragged = getTabElements().filter(tab => tab !== draggedTab);
        tabsAfterExcludingDragged.forEach(tab => {
            const first = firstRects.get(tab);
            if (!first) return;

            const last = tab.getBoundingClientRect();
            const dx = first.left - last.left;

            if (Math.abs(dx) > 0.5) {
                tab.style.transition = "none";
                tab.style.transform = `translateX(${dx}px)`;

                requestAnimationFrame(() => {
                    tab.style.transition = "transform 150ms ease";
                    tab.style.transform = "";
                });
            }
        });
    }
}

function onMouseUp() {
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.remove();

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("keydown", onKeyDownDuringDrag);

    if (!isDragging || !draggedTab) {
        draggedTab = null;
        return;
    }

    isDragging = false;
    document.body.classList.remove("dragging-tabs");

    const tabsBefore = getTabElements();
    const firstRects = new Map();

    tabsBefore.forEach(tab => {
        firstRects.set(tab, tab.getBoundingClientRect());
    });

    // Move dragged tab into final place
    tabbar.insertBefore(draggedTab, placeholder);
    placeholder.remove();
    placeholder = null;

    draggedTab.classList.remove("dragged");
    draggedTab.style.left = "";

    const tabsAfter = getTabElements();

    tabsAfter.forEach(tab => {
        const first = firstRects.get(tab);
        const last = tab.getBoundingClientRect();

        const dx = first.left - last.left;

        if (Math.abs(dx) > 0.5) {
            tab.classList.add("dragMotion");
            tab.style.transition = "none";
            tab.style.transform = `translateX(${dx}px)`;

            // force layout so browser commits transform
            tab.offsetWidth;

            tab.style.transition = "transform 150ms ease-out";
            tab.style.transform = "";
        }
    });

    setTimeout(() => {
        tabsAfter.forEach(tab => {
            tab.style.transition = "";
            tab.style.transform = "";
            tab.classList.remove("dragMotion");
        });

        draggedTab = null;
        getTabElements();
    }, 150);
}

function cancelCurrentDragOperation() {
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.remove();

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("keydown", onKeyDownDuringDrag);

    if (!isDragging || !draggedTab) {
        draggedTab = null;
        return;
    }

    isDragging = false;
    document.body.classList.remove("dragging-tabs");

    if (placeholder && placeholder.parentNode) {
        placeholder.remove();
    }

    const tabElements = getTabElements();
    const targetIndex = originalDragIndex >= 0 && originalDragIndex < tabElements.length ? originalDragIndex : tabElements.length - 1;
    const targetReferenceNode = tabElements[targetIndex] || null;
    if (targetReferenceNode) {
        tabbar.insertBefore(draggedTab, targetReferenceNode);
    } else {
        tabbar.appendChild(draggedTab);
    }

    draggedTab.classList.remove("dragged");
    draggedTab.style.left = "";
    draggedTab.style.transition = "";

    tabElements.forEach(tabElement => {
        tabElement.style.transform = "";
    });

    draggedTab = null;
    placeholder = null;
}

function onKeyDownDuringDrag(keyboardEvent) {
    if (!isDragging) return;
    if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault();
        cancelCurrentDragOperation();
    }
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
    const tab = getTabElementById(tabid);
    return tab ? tab.getAttribute("data-url") || "./chungus/chungus.html" : "./chungus/chungus.html";
}

function getTabIDFromSource(sourceWindow) {
    const lowZFrameInfo = getLowZFrameBySource(sourceWindow);
    if (lowZFrameInfo) {
        return lowZFrameInfo.tabid;
    }

    if (sourceWindow === chungus.contentWindow) {
        const activeTab = getActiveTabElement();
        return activeTab ? activeTab.getAttribute("tabid") : null;
    }

    return null;
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
    const activeTab = getActiveTabElement();

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
    applyAriaAttributesToTab(newTab);
    addTabListeners(newTab);
    getTabElements();
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

    const nextTab = tabs[currentIndex];
    if (!nextTab) return;

    setActiveTab(nextTab);

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
            const tabToRemove = getTabElementById(tabid);

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
            const activeTab = getActiveTabElement();
            const indexOfActiveTab = getTabIndexForElement(activeTab);

            if (activeTab) {
                activeTab.remove();

                const currentTabsAfterRemoval = getTabElements();

                if (currentTabsAfterRemoval[indexOfActiveTab]) {
                    setActiveTab(currentTabsAfterRemoval[indexOfActiveTab]);
                } else if (currentTabsAfterRemoval[indexOfActiveTab - 1]) {
                    setActiveTab(currentTabsAfterRemoval[indexOfActiveTab - 1]);
                } else {
                    chungus.src = "./emptydesk.html";
                }
            }
        }

        getTabElements();
    }

    if (event.data.type === "openTabWithID") {
        const activeTab = getActiveTabElement();
        if (!activeTab || activeTab.getAttribute('tabid') !== "0") return;

        let lookingForTab = getTabElementById(event.data.tabID);
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
        applyAriaAttributesToTab(newTab);
        addTabListeners(newTab);
        getTabElements();
        setActiveTab(newTab);
        fixTabCloseEventListeners();
    }

    if (event.data.type === "getGlobalNameQuery") {
        const activeTab = getActiveTabElement();
        if (!activeTab || activeTab.getAttribute("tabid") !== "0") {
            try {
                event.source.postMessage({ type: "globalNameQueryReturn", names: null }, "*");
            } catch {}
            return;
        }

        (async () => {
            try {
                await localDB.ensureOpen();
                const names = await localDB.getGlobalNameQuery();
                event.source.postMessage({ type: "globalNameQueryReturn", names }, "*");
            } catch (e) {
                console.warn("getGlobalNameQuery failed:", e);
                try {
                    event.source.postMessage({ type: "globalNameQueryReturn", names: {} }, "*");
                } catch {}
            }
        })();
        return;
    }

    if (!event.data || typeof event.data.type !== "string") return;
    const type = event.data.type;
    const activeTab = getActiveTabElement();
    const activeTabID = activeTab ? activeTab.getAttribute('tabid') : null;

    if (type === "getLJson") {
        (async () => {
            if (!activeTab || !activeTabID) {
                event.source.postMessage({ type: "LJsonReturn", json: null }, "*");
                return;
            }
            try {
                await localDB.ensureOpen();
                const response = await localDB.getSession(activeTabID);
                try {
                    event.source.postMessage({ type: "LJsonReturn", json: response }, "*");
                } catch {}
            } catch (e) {
                console.warn("getLJson failed:", e);
                try {
                    event.source.postMessage({ type: "LJsonReturn", json: null }, "*");
                } catch {}
            }
        })();
    }

    if (type === "setLJson") {
        (async () => {
            if (!activeTab || !activeTabID) return;
            try {
                await localDB.ensureOpen();
                await localDB.setSession(activeTabID, event.data.json);
            } catch (e) {
                console.warn("setLJson failed:", e);
            }
        })();
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

        (async () => {
            try {
                await localDB.ensureOpen();
                await localDB.deleteSession(targetTabID);
                await localDB.clearActiveTabIdIfMatches(targetTabID);
            } catch (e) {
                console.warn("purge localDB failed:", e);
            }

            const targetTab = getTabElementById(targetTabID);
            if (!targetTab) return;
            const wasActive = targetTab.classList.contains("active");

            if (wasActive) {
                const currentTabs = getTabElements();
                const index = currentTabs.indexOf(targetTab);
                let nextTab = currentTabs[index + 1] || currentTabs[index - 1];
                if (nextTab) setActiveTab(nextTab);
            }

            targetTab.remove();
            getTabElements();
        })();
    }

    if (type === "chtitle") {
        const activeTab = getActiveTabElement();
        if (!activeTab || activeTab.getAttribute("tabid") !== "0") return;

        const { tabid, title } = event.data;
        if (!tabid || typeof title !== "string") return;

        const tabInQuestion = getTabElementById(tabid);
        if (tabInQuestion) {
            setTabTitle(tabInQuestion, title);
        }

        (async () => {
            try {
                await localDB.ensureOpen();
                await localDB.patchSessionTitle(tabid, title);
            } catch (e) {
                console.warn("chtitle localDB failed:", e);
            }
        })();
    }

    if (type == "setSETTABLES") {
        if (!activeTab || activeTab.getAttribute("tabid") !== "7") return;

        (async () => {
            try {
                await localDB.ensureOpen();
                await localDB.setSettables(event.data.json);
            } catch (e) {
                console.warn("setSETTABLES failed:", e);
            }
        })();
    }

    if (type == "getSETTABLES") {
        (async () => {
            try {
                await localDB.ensureOpen();
                const response = await localDB.getSettables();
                try {
                    event.source.postMessage(
                        { type: "settablesJsonReturn", json: response },
                        "*"
                    );
                } catch {}
            } catch (e) {
                console.warn("getSETTABLES failed:", e);
                try {
                    event.source.postMessage(
                        { type: "settablesJsonReturn", json: null },
                        "*"
                    );
                } catch {}
            }
        })();
    }

    if (type == "updtTheme") {
        fixThemeSchemaAtTopLeval();
    }

    if (type == "newTabEvent") {
        createNewTab();
    }

    if (type == "IndxSWPEvent") {
        let indexTab = getTabElementById("0");
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
            applyAriaAttributesToTab(newTab);
            addTabListeners(newTab);
            getTabElements();
            setActiveTab(newTab);
            fixTabCloseEventListeners();
        }
    }

    if (type == "toggleAcctiveDot") {
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
    let indexTab = getTabElementById("0");

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
        newTab.setAttribute('data-url', "./index/indx.html");

        if (tabbar.firstChild) {
            tabbar.insertBefore(newTab, tabbar.firstChild);
        } else {
            tabbar.appendChild(newTab);
        }

        applyAriaAttributesToTab(newTab);
        addTabListeners(newTab);
        getTabElements();
        setActiveTab(newTab);
        fixTabCloseEventListeners();
    }
});

document.getElementById("settings").addEventListener("click", () => {
    let settingsTab = getTabElementById("7");

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

    applyAriaAttributesToTab(newTab);
    addTabListeners(newTab);
    getTabElements();
    setActiveTab(newTab);
    fixTabCloseEventListeners();
});

document.getElementById("documentation").addEventListener("click", () => {
    let documentationTab = getTabElementById("4");

    if (documentationTab) {
        if (!documentationTab.textContent.includes("Documentation")) {
            setTabTitle(documentationTab, "Documentation");
        }
        setActiveTab(documentationTab);
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

    applyAriaAttributesToTab(newTab);
    addTabListeners(newTab);
    getTabElements();
    setActiveTab(newTab);
    fixTabCloseEventListeners();
});

document.getElementById("rmTabBtn").addEventListener("click", () => {
    chungus.contentWindow.postMessage({ type: "saveQuit" }, "*");
});

window.addEventListener('beforeunload', (event) => {
    localStorage.setItem("tabArray", tabbar.innerHTML);
    // Clean up all lowZ frames before unloading
    cleanupLowZFrames();
});
