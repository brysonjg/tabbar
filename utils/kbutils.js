function getKeybindingStringOfEvent(event) {
    let stdstr = "";

    if (event.ctrlKey) stdstr += "Ctrl ";
    if (event.shiftKey) stdstr += "Shift ";
    if (event.altKey) stdstr += "Alt ";
    if (event.metaKey) stdstr += "Meta ";
    if (event.key) stdstr += event.key.toLowerCase();

    return stdstr;
}

async function registerRunKeyboardShortcutFunction(kbs) {
    const AsyncFunction =
        Object.getPrototypeOf(async function () {}).constructor;

    const asyncronus = (String(kbs.asyncfn) == "true") || false;

    if (asyncronus) {
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
        let jsonStore = localStorage.getItem("ChatJson");
        if (!jsonStore) {
            jsonStore = "{}";
            localStorage.setItem("ChatJson", jsonStore);
        }

        const chatJson = JSON.parse(jsonStore);
        const settables = (7 in chatJson) ? chatJson[7] : null;
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
