// keybord shortcut utilitys

async function keybordShortcutParser() {
    try {
        // Ask parent to clear previously-registered callbacks so reloads don't duplicate handlers
        window.parent.postMessage({ type: 'clearKeyBindings' }, '*');

        // Load shortcuts JSON
        let json = await getSettablesAsJson();

        const defualtBindings = {
            "keybindings": [
                {
                    "mods": [],
                    "key": "F2",
                    "user_comment": "Renames Chat Pages",
                    "user_script": "if (window.location.href.endsWith(\"chungus.html\")) reTitleTab();",
                },
                {
                    "mods": [],
                    "key": "F4",
                    "user_comment": "Closes the Current Tab",
                    "user_script": "closeSelf();",
                },
                {
                    "mods": [],
                    "key": "F10",
                    "user_comment": "Opens the Index Page",
                    "user_script": "window.parent.postMessage({ type: 'IndxSWPEvent' }, \"*\");",
                },
                {
                    "mods": [],
                    "key": "Tab",
                    "user_comment": "Opens New Tab",
                    "user_script": "window.parent.postMessage({ type: 'newTabEvent' }, \"*\");",
                },
            ],
        };

        if (!json || !json.keybindings) {
            json = defualtBindings;
        }

        const keybindingsStruct = json.keybindings;

        keybindingsStruct.forEach((binding) => {
            // Basic validation: ensure structure has mods and key
            if (!binding || !binding.mods || !binding.key) {
                console.warn('Skipping invalid keybinding entry', binding);
                return;
            }

            setKeyBindingFromStruct(binding, (e) => {
                // --- Prevent single-key conflicts with typing fields ---
                const typingKeys = ["Tab", "Enter", "Backspace",
                                    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

                const isSingleKeyNoMods = binding.mods.length === 0 && typingKeys.includes(binding.key);

                if (isSingleKeyNoMods) {
                    const el = document.activeElement;
                    if (
                        el.tagName === "INPUT" ||
                        el.tagName === "TEXTAREA" ||
                        el.isContentEditable
                    ) {
                        // User is typing → ignore this shortcut
                        return;
                    }
                }

                // Execute the user script if it exists
                if (binding.user_script && binding.user_script.trim()) {
                    try {
                        const func = new Function(binding.user_script);
                        func();
                    } catch (error) {
                        console.error('Error executing keybinding script:', error);
                    }
                } else {
                    console.log(`Shortcut triggered: ${binding.user_comment} (no script)`);
                }
            });
        });

    } catch (error) {
        console.error('Error loading keybindings:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    keybordShortcutParser();
});
