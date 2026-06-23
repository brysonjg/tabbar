async function getSettablesWithoutLevelKeybindings() {
    if (window.self === window.top) {
        await localDB.ensureOpen();
        return await localDB.getSettables();
    }
    else {
        return await getSettablesAsJson();
    }
}

async function keybindingsBoundsetConformation(keyboardEvent) {
    if (typeof keyboardEvent !== 'string') return false;

    const settables = await getSettablesWithoutLevelKeybindings();
    if (!settables) return false;
    if (!settables.keybindings) return false;
    if (typeof settables.keybindings !== "object") return false;
    if (!Object.hasOwn(settables.keybindings, keyboardEvent)) return false;

    const keybindings = settables.keybindings[keyboardEvent];
    let hrefVerification = false;
    const localHref = window.location.href;

    if (!Array.isArray(keybindings)) return false;
    if (keybindings.length === 0) return false;

    for (const binding of keybindings) {
        if (!binding.bounds) return false;
        if (typeof binding.bounds !== 'string') return false;

        const regular = new RegExp(binding.bounds);
        const matches = regular.test(localHref);
        if (matches) {
            hrefVerification = true;
            break;
        }
    }

    return hrefVerification;
}

async function executeKeyboardKeybinding(keyboardEvent) {
    const settables = await getSettablesWithoutLevelKeybindings();

    const keybindings = settables.keybindings[keyboardEvent];
    const localHref = window.location.href;

    const AsyncFunction = (async () => {}).constructor;

    for (const binding of keybindings) {
        const regular = new RegExp(binding.bounds);
        if (!regular.test(localHref)) continue;

        if (binding.asyncfn) {
            const callback = new AsyncFunction(binding.callback);
            await callback();
        } else {
            const callback = new Function(binding.callback);
            callback();
        }
    }
}

function keyboardEventStandardNormalization(event) {
    let keyString = "";

    if (event.ctrlKey) keyString += "ctrl ";
    if (event.altKey) keyString += "alt ";
    if (event.shiftKey) keyString += "shift ";
    if (event.metaKey) keyString += "meta ";
    if (event.key) keyString += event.key;

    return keyString.trim().toLowerCase();
}

window.addEventListener("DOMContentLoaded", () => {
    if (window.self === window.top) {
        window.addEventListener("message", (event) => {
            if (!event?.data?.type) return;

            if (event.data.type === "keyboardUpward") {
                if (!event?.data?.kbe) return;

                window.self.postMessage({
                    type: "keyboardPropagationEmition",
                    kbe: event.data.kbe
                }, "*");
            }
        });
    }

    window.addEventListener("message", async (event) => {
        if (event.data.type === "keyboardPropagationEmition") {
            Array.from(window.frames).forEach((frame) => {
                frame.postMessage({
                    type: "keyboardPropagationEmition",
                    kbe: event.data.kbe
                }, "*");
            });

            const sccVerifyed = await keybindingsBoundsetConformation(event.data.kbe);
            if (!sccVerifyed) return;

            await executeKeyboardKeybinding(event.data.kbe);
        }
    });

    window.addEventListener("keydown", async (event) => {
        const keyString = keyboardEventStandardNormalization(event);

        const settables = await getSettablesWithoutLevelKeybindings();

        if (!settables) return;
        if (!settables.keybindings) return;
        if (!Object.hasOwn(settables.keybindings, keyString)) return;

        window.top.postMessage({
            type: "keyboardUpward",
            kbe: keyString
        }, "*");
    });
});
