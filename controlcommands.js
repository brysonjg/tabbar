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

function setBlueDote(type) {
    window.parent.postMessage({ type: 'setAcctiveDot', do: String(type) }, '*');
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
        window.parent.postMessage({ type: 'getAcctiveDot' }, '*');
    });
}
