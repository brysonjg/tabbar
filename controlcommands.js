async function getTabID() {
    return new Promise((resolve) => {
        function handleTabIDMessage(event) {
            if (event.data && event.data.type === 'fetchTabIDResponse') {
                window.removeEventListener('message', handleTabIDMessage);
                resolve(event.data.result);
            }
        }

        window.addEventListener('message', handleTabIDMessage);
        window.top.postMessage({ type: 'fetchTabID' }, '*');
    });
}

function closeSelf() {
    window.top.postMessage({ type: 'exitCurrent' }, '*');
}

function makeNewTabWithID(tabID) {
    // this function is privileged and only works at tab id 0
    // so that on the off chance that the ai learns how to
    // script inject it wont open 30 quintilian tabs

    window.top.postMessage({ type: 'openTabWithID', tabID: tabID }, '*');
}

async function getGlobalMetadata() {
    return new Promise((resolve) => {
        const handleGlobalMetadataMessage = (event) => {
            if (event.data && event.data.type === "globalMetadataReturn") {
                window.removeEventListener("message", handleGlobalMetadataMessage);
                const rows = event.data.rows;
                resolve(Array.isArray(rows) ? rows : []);
            }
        };

        window.addEventListener("message", handleGlobalMetadataMessage);
        window.top.postMessage({ type: "getGlobalMetadata" }, "*");
    });
}

async function getLocalJson() {
    return new Promise((resolve) => {
        function handleLocalJSONMessage(event) {
            if (event.data && event.data.type === 'LJsonReturn') {
                window.removeEventListener('message', handleLocalJSONMessage);
                resolve(event.data.json);
            }
        }

        window.addEventListener('message', handleLocalJSONMessage);
        window.top.postMessage({ type: 'getLJson' }, '*');
    });
}

function setLocalJson(json) {
    window.top.postMessage({ type: 'setLJson', json: json }, '*');
}

function setTabTitle(title) {
    window.top.postMessage({ type: 'setTitle', title: title }, '*');
}

function purgeTabMemory(tabid) {
    // privileged function reserved for tab id 0

    window.top.postMessage({ type: 'purge', tabid: tabid }, '*');
}

function chTitleOfTab(tabid, title) {
    // privileged function reserved for tab id 0

    window.top.postMessage({ type: 'changeTitle', tabid: tabid, title: title}, '*');
}

function setSettablesByJson(json) {
    // reserved to tab of id 7
    window.top.postMessage({ type: 'setSETTABLES', json: json }, '*');
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
        window.top.postMessage({ type: "getSETTABLES" }, "*");

        setTimeout(() => {
            window.removeEventListener("message", handler);
            resolve(null);
        }, 2000);
    });
}

function updateTopLevelTheme() {
    window.top.postMessage({ type: 'updateTheme' }, '*');
    window.parent.postMessage({ type: 'updateTheme' }, '*');
}
