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
    window.parent.postMessage({ type: 'exitCurrent' }, '*');
}

function makeNewTabWithID(tabID) {
    // this function is privileged and only works at tab id 0
    // so that on the off chance that the ai learns how to
    // script inject it wont open 30 quintilian tabs

    window.parent.postMessage({ type: 'openTabWithID', tabID: tabID }, '*');
}

async function getGlobalNameQuery() {
    return new Promise((resolve) => {
        const handleGlobalNameQueryMessage = (event) => {
            if (event.data && event.data.type === "globalNameQueryReturn") {
                window.removeEventListener("message", handleGlobalNameQueryMessage);
                const names = event.data.names;
                resolve(names && typeof names === "object" ? names : {});
            }
        };

        window.addEventListener("message", handleGlobalNameQueryMessage);
        window.parent.postMessage({ type: "getGlobalNameQuery" }, "*");
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
    // privileged function reserved for tab id 0

    window.parent.postMessage({ type: 'purge', tabid: tabid }, '*');
}

function chTitleOfTab(tabid, title) {
    // privileged function reserved for tab id 0

    window.parent.postMessage({ type: 'changeTitle', tabid: tabid, title: title}, '*');
}

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
    window.parent.postMessage({ type: 'updateTheme' }, '*');
}

function toggleBlueDote() {
    window.parent.postMessage({ type: 'toggleActiveDot' }, '*');
}

function setBlueDote(type) {
    window.parent.postMessage({ type: 'setActiveDot', do: String(type) }, '*');
}

async function getBlueDote(type) {
    return new Promise((resolve) => {
        function handleBlueDoteMessage(event) {
            if (event.data && event.data.type === 'fetchTabIDResponse') {
                window.removeEventListener('message', handleBlueDoteMessage);
                resolve(event.data.result);
            }
        }

        window.addEventListener('message', handleBlueDoteMessage);
        window.parent.postMessage({ type: 'getActiveDot' }, '*');
    });
}
