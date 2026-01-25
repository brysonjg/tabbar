function getKeybindingStringOfEvent(event) {
    let stdstr = "";

    if (event.ctrlKey) stdstr += "Ctrl ";
    if (event.shiftKey) stdstr += "Shift ";
    if (event.altKey) stdstr += "Alt ";
    if (event.metaKey) stdstr += "Meta ";
    if (event.key) stdstr += event.key.toLowerCase();

    return stdstr;
}

async function registerKeybindings() {
    if (
        window.self !== window.top &&
        !window.location.href.endsWith("index.html")
    ) {
        const settables = await getSettablesAsJson();
        const keybindings = settables.kbshortcuts;

        keybindings.forEach((kbs) => {
            document.addEventListener("keydown", (event) => {
                if (
                    getKeybindingStringOfEvent(event) == kbs.shortcut
                ) {
                    const runningf = new Function(kbs.callback);
                    runningf();
                }
            });
        });

        window.addEventListener("message", (event) => {
            if (event.data.type !== "keyboardShortcutEvent") return;

            const kbs = event.data.kbs
            if (!kbs) return;

            const runningf = new Function(kbs.callback);
            runningf();
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
                    getKeybindingStringOfEvent(event) == kbs.shortcut
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
