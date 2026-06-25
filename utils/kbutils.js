async function getSettablesWithoutLevelKeybindings() {
    if (window.self === window.top) {
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
    const parts = [];

    if (event.ctrlKey) parts.push("ctrl");
    if (event.altKey) parts.push("alt");
    if (event.shiftKey) parts.push("shift");
    if (event.metaKey) parts.push("meta");

    let key = event.key.toLowerCase();

    if (key === " ") key = "space";

    if (
        key !== "control" &&
        key !== "alt" &&
        key !== "shift" &&
        key !== "meta"
    ) {
        parts.push(key);
    }

    return parts.join(" ");
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

        setInterval(async () => {
            const settables = await localDB.getSettables();

            if (!settables) {
                localStorage.setItem("keybindingsCache", "{}");
                return;
            }
            if (!settables?.keybindings) {
                localStorage.setItem("keybindingsCache", "{}");
                return;
            }

            const value = JSON.stringify(settables?.keybindings);

            if (value !== localStorage.getItem("keybindingsCache")) {
                localStorage.setItem("keybindingsCache", value);
            }
        }, 1000/60);
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

        const keybindings = JSON.parse(localStorage.getItem("keybindingsCache"));

        if (!Object.hasOwn(keybindings, keyString)) return;

        event.preventDefault();
        event.stopPropagation();

        window.top.postMessage({
            type: "keyboardUpward",
            kbe: keyString
        }, "*");
    });
});
