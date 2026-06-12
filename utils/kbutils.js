function getKeybindingStringOfEvent(event) {
    let keyString = "";

    if (event.ctrlKey) keyString += "Ctrl ";
    if (event.shiftKey) keyString += "Shift ";
    if (event.altKey) keyString += "Alt ";
    if (event.metaKey) keyString += "Meta ";
    if (event.key) keyString += event.key.toLowerCase();

    return keyString;
}

async function registerRunKeyboardShortcutFunction(kbs) {
    const AsyncFunction =
        Object.getPrototypeOf(async function () {}).constructor;

    const asynchronous = Boolean(kbs.asyncfn);

    if (asynchronous) {
        const fun = new AsyncFunction(kbs.callback);
        await fun();
    }
    else {
        const fun = new Function(kbs.callback);
        fun();
    }

    return;
}

async function registerKeybindings() {
    if (
        window.self !== window.top &&
        !window.location.href.endsWith("index.html")
    ) {
        const settables = await getSettablesAsJson();
        if (settables === null || !settables.kbshortcuts) return;
        const keybindings = settables.kbshortcuts;

        keybindings.forEach((kbs) => {
            document.addEventListener("keydown", async (event) => {
                if (
                    getKeybindingStringOfEvent(event).trim().toLowerCase() === String(kbs.shortcut).trim().toLowerCase()
                ) {
                    await registerRunKeyboardShortcutFunction(kbs);
                }
            });
        });

        window.addEventListener("message", async (event) => {
            if (event.data.type !== "keyboardShortcutEvent") return;

            const kbs = event.data.kbs
            if (!kbs) return;

            await registerRunKeyboardShortcutFunction(kbs);
        });
    }

    if (
        window.self == window.top &&
        window.location.href.endsWith("index.html")
    ) {
        await localDB.ensureOpen();
        const settables = await localDB.getSettables();
        const keybindings = settables?.kbshortcuts || null;

        if (keybindings == null) return;

        keybindings.forEach((kbs) => {
            document.addEventListener("keydown", (event) => {
                if (
                    getKeybindingStringOfEvent(event).trim().toLowerCase() === String(kbs.shortcut).trim().toLowerCase()
                ) {
                    document.getElementById("chungusmain")
                        .contentWindow
                            .postMessage(
                                {
                                    type: "keyboardShortcutEvent",
                                    kbs: kbs,
                                },
                                "*"
                            );
                }
            });
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await registerKeybindings();
});
