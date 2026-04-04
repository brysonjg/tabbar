window.onload = async () => {
    await fixThemeOverSettable(); // correcting theming

    // theme imports
    await fixThemeOverSettable("prism");
    await fixThemeOverSettable("gitgraph");

    await fixModelMenu();

    // Load account data
    let accountData = {"displayname": "User"};
    window.account = accountData;

    try {
        accountData = await getSettablesAsJson();
        accountData = accountData.account;
        window.account = accountData;
    } catch {
        // nothing
    }

    const json = await getLocalJson();
    if (!json) return;

    let messages = [];
    
    // Initialize VersionObject from stored data if it exists
    if (json.chat) {
        try {
            const chatObj = new VersionObject(json.chat);
            messages = chatObj.compile() || [];
        } catch (err) {
            console.warn("Failed to load chat messages:", err);
            messages = [];
        }
    }
    
    // Render loaded messages
    for (const message of messages) {
        if (message.role !== "system") {
            let username = "user";
            let icon = "../icons/default-user.svg";

            if (accountData && message.role === "user") {
                username = accountData.displayname || accountData.username || "User";
                icon = accountData.avatar || "../icons/default-user.svg";
            } else if (message.role === "assistant") {
                icon = "../icons/ai-default.svg";
                username = "assistant";
            }

            await renderMD(message.content, username, "", message.files, false, true, icon);
        }
    }

    const outerer = document.querySelector("div.chat-outerer");
    if (outerer) {
        outerer.scrollTop = outerer.scrollHeight;
    }

    setTimeout(async () => {
        if (json?.metadata?.title) {
            setTabTitle(json.metadata.title);
        }
        else {
            setTabTitle("Untitled");
        }
    }, 0);

    startBlameSpacerScheduler()
    setTimeout(updateTitleButtonPosition, 200);
    updateTitleButtonPosition();
};

window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "saveQuit") return;
    closeSelf();
});

function hasVerticalScrollbar(element) {
    return element.scrollHeight > element.clientHeight;
}

let blameSpacerRafId = 0;

function scheduleBlameSpacerUpdate() {
    if (blameSpacerRafId) return;
    blameSpacerRafId = requestAnimationFrame(() => {
        blameSpacerRafId = 0;
        updateBlameSpacersFast();
    });
}

function updateBlameSpacersFast() {
    const messages = document.querySelectorAll("#chat-container > .chat-message");
    const blameSpacers = document.querySelectorAll("#blameColumn > .blm-spacer");
    const blameMains = document.querySelectorAll("#blameColumn > blm");
    const blameColumn = document.getElementById("blameColumn");
    const pairCount = Math.min(messages.length, blameSpacers.length, blameMains.length);
    if (!blameColumn || pairCount === 0) return 0;

    const columnTop = blameColumn.getBoundingClientRect().top;
    const paddingTop = parseFloat(getComputedStyle(blameColumn).paddingTop) || 0;
    let cursor = paddingTop;
    let changedCount = 0;

    for (let i = 0; i < pairCount; i++) {
        const messageTop = messages[i].getBoundingClientRect().top - columnTop;
        const spacerHeight = Math.max(0, Math.round(messageTop - cursor));
        const nextHeight = `${spacerHeight}px`;

        if (blameSpacers[i].style.height !== nextHeight) {
            blameSpacers[i].style.height = nextHeight;
            changedCount++;
        }

        cursor += spacerHeight + blameMains[i].getBoundingClientRect().height;
    }

    return changedCount;
}

function startBlameSpacerScheduler() {
    if (window._blameSpacerSchedulerStarted) return;
    window._blameSpacerSchedulerStarted = true;

    const chatOuterer = document.querySelector(".chat-outerer");
    if (chatOuterer) {
        chatOuterer.addEventListener("scroll", scheduleBlameSpacerUpdate, { passive: true });
    }

    window.addEventListener("resize", scheduleBlameSpacerUpdate);
    window.addEventListener("click", scheduleBlameSpacerUpdate);
    window.addEventListener("keydown", scheduleBlameSpacerUpdate);
    setInterval(updateBlameSpacersFast, 100);
    scheduleBlameSpacerUpdate();
}

function updateTitleButtonPosition() {
    const chatOuterer = document.querySelector('.chat-outerer');
    const titleBtn = document.querySelector('div.action-group-bar');

    if (!chatOuterer || !titleBtn) return;

    if (hasVerticalScrollbar(chatOuterer)) {
        titleBtn.classList.add("scrollbar");
    } else {
        titleBtn.classList.remove("scrollbar");
    }
}

async function reTitleTab() {
    const chatOuterer = document.querySelector('.chat-outerer');
    if (!chatOuterer) return;

    // prevent duplicates
    if (chatOuterer.querySelector('.top-bar-flash-for-rename')) return;

    chatOuterer.insertAdjacentHTML("afterbegin", `
        <div class="top-bar-flash-for-rename ${hasVerticalScrollbar(chatOuterer) ? "rightborder" : ""}">
            <img src="../icons/close-file.svg" class="submit-title-btn exit" title="exit">
            <input class="title-input">
            <img src="../icons/submittitle.svg" class="submit-title-btn" title="submit title">
        </div>
    `);

    const titleBtn = document.querySelector('div.action-group-bar');

    titleBtn.style.top = 'calc(5px + 2px)'; // 2 pixels more than its typical

    let topBarFlashForRenameInterval = setInterval(() => {
        if (document.querySelector("div.top-bar-flash-for-rename")) {
            if (hasVerticalScrollbar(chatOuterer)) {
                document.querySelector("div.top-bar-flash-for-rename").classList.add("rightborder");
            } else {
                document.querySelector("div.top-bar-flash-for-rename").classList.remove("rightborder");
            }
        }
    }, 200);

    const renameBar = chatOuterer.querySelector('.top-bar-flash-for-rename');
    const submitBtn = renameBar.querySelector('.submit-title-btn:not(.exit)');
    const exitBtn = renameBar.querySelector('.submit-title-btn.exit');
    const titleInput = renameBar.querySelector('.title-input');

    titleInput.focus();

    const closeBar = async () => {
        renameBar.classList.add("on-close");
        const desiredTitle = titleInput.value.trim();

        if (desiredTitle !== "") {
            setTabTitle(desiredTitle);

            // Update JSON metadata and auto-syncs
            let json = await getLocalJson() || {};
            if (!json.metadata) json.metadata = {};
            json.metadata.title = desiredTitle;
            await setLocalJson(json);
        }

        setTimeout(() => renameBar.remove(), 250);
        clearInterval(topBarFlashForRenameInterval);

        titleBtn.style.top = '5px';  // set height back to its default
    };

    const cancelRename = () => {
        renameBar.classList.add("on-close");
        setTimeout(() => renameBar.remove(), 250);
        clearInterval(topBarFlashForRenameInterval);
    };

    submitBtn.addEventListener("click", closeBar);
    exitBtn.addEventListener("click", cancelRename);
    titleInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            closeBar();
        } else if (event.key === "Escape") {
            event.preventDefault();
            cancelRename();
        }
    });
}

function graphCompressionForSidePanel(repo) {
    if (!repo || typeof repo !== "object" || !Object.prototype.hasOwnProperty.call(repo, "active")) {
        return VersionObject.newRepository();
    }

    const nodeIds = Object.keys(repo)
        .filter((key) => key !== "active")
        .map((key) => Number(key))
        .filter((id) => Number.isInteger(id) && Object.prototype.hasOwnProperty.call(repo, id));

    if (!nodeIds.includes(0)) {
        return VersionObject.newRepository();
    }

    const isAssistantCheckpoint = (id) => {
        const node = repo[id];
        if (!node || !Array.isArray(node.content)) return false;

        return node.content.some((entry) =>
            entry &&
            typeof entry === "object" &&
            entry.role === "assistant"
        );
    };

    const kept = new Set([0]);
    nodeIds.forEach((id) => {
        if (id !== 0 && isAssistantCheckpoint(id)) {
            kept.add(id);
        }
    });

    const compressed = { active: 0 };
    kept.forEach((id) => {
        const node = repo[id];
        compressed[id] = {
            parent: id === 0 ? null : 0,
            content: Array.isArray(node?.content) ? [...node.content] : [],
            children: []
        };
    });

    const nearestKeptAncestor = (id) => {
        let cursor = id;
        while (cursor !== null && cursor !== undefined) {
            if (kept.has(cursor)) return cursor;
            const parent = repo[cursor]?.parent;
            if (parent === undefined) break;
            cursor = parent;
        }
        return 0;
    };

    kept.forEach((id) => {
        if (id === 0) return;

        const parent = nearestKeptAncestor(repo[id]?.parent);
        compressed[id].parent = parent;

        if (compressed[parent] && !compressed[parent].children.includes(id)) {
            compressed[parent].children.push(id);
        }
    });

    compressed.active = nearestKeptAncestor(repo.active);
    return compressed;
}

async function toggleVersioningSidePanel() {
    let chatHistoryButton = document.querySelector("img#action-bar-action.chat-history-btn");
    chatHistoryButton.classList.toggle("active");

    let hasRightSidePanel = document.querySelector("body > div.right-sidepanel") !== null;

    if (hasRightSidePanel) {
        let rightSidePanel = document.querySelector("body > div.right-sidepanel");
        rightSidePanel.remove();
        return;
    }

    else {
        document.body.insertAdjacentHTML(
            'beforeend',
            `<div class="right-sidepanel"></div>`
        );
    }

    let json = await getLocalJson();

    if (!json) json = {};
    if (!json.chat) json.chat = VersionObject.newRepository();

    setLocalJson(json);

    json.chat = graphCompressionForSidePanel(json.chat);

    const rightSidePanel = document.querySelector("body > div.right-sidepanel");

    const vpanel = new VersionPanel(rightSidePanel, json.chat);
    vpanel.displayObject();

    vpanel.listenForClick(async (id) => {
        let json = await getLocalJson();
        const repo = new VersionObject(json.chat);
        repo.checkout(id);
        const messages = repo.compile();

        document.querySelector("div#blameColumn").replaceChildren();
        document.querySelector("div#chat-container").replaceChildren();

        for (const message of messages) {
            if (message.role !== "system") {
                let username = "user";
                let icon = "../icons/default-user.svg";

                if (window.account && message.role === "user") {
                    username = window.account.displayname || window.account.username || "User";
                    icon = window.account.avatar || "../icons/default-user.svg";
                } else if (message.role === "assistant") {
                    icon = "../icons/ai-default.svg";
                    username = "assistant";
                }

                await renderMD(message.content, username, "", message.files, false, true, icon);
            }
        }

        json.chat = repo.json;

        setLocalJson(json);
    });

    window._updateVpanelA = async () => {
        if (!document.querySelector("body > div.right-sidepanel")) return;
        const json = await getLocalJson();
        vpanel.setRenderObject(graphCompressionForSidePanel(json.chat));
    }
}

async function updateVpanel() {
    if (window._updateVpanelA) await window._updateVpanelA();
}

document.querySelector("img#action-bar-action.chat-history-btn")
    .addEventListener("click", toggleVersioningSidePanel);


async function fixModelMenu() {
    try {
        const settables = await getSettablesAsJson();
        if (!settables || !settables.models) return;

        const { activeIndex, models } = settables.models;

        const container = document.querySelector('.menu .dropdown') ||
                          document.querySelector('.menu .dropdown-nul');
        if (!container) return;

        container.innerHTML = '';

        models.forEach((model, i) => {
            const el = document.createElement('div');
            el.className = 'menu-item';
            el.setAttribute('type', 'setModel');
            el.setAttribute('model', model.api_name);
            el.textContent = model.userspace_name;

            container.appendChild(el);
        });

        attachModelItemListeners(container);

    } catch (error) {
        console.warn('fixModelMenu error:', error);
    }
}

function attachModelItemListeners(container) {
    container.querySelectorAll('.menu-item').forEach( (element) => {
        const type = element.getAttribute('type');
        if (type === 'setModel') {
            element.addEventListener('click', () => {
                submissionModel = element.getAttribute('model');
            });
        }
    });
}

document.querySelector('img.change-title-btn').addEventListener("click", async () => {
    await reTitleTab();
});

function prismHighlightAllComplete() {
    return new Promise((resolve) => {
        const selector =
            'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code';
        const pending = document.querySelectorAll(selector).length;
        if (pending === 0) {
            resolve();
            return;
        }
        let done = 0;
        Prism.highlightAll(false, () => {
            done += 1;
            if (done >= pending) resolve();
        });
    });
}

async function updateRules() {
    await batUpdateRules();

    // Update title button position after content changes
    updateTitleButtonPosition();
    scheduleBlameSpacerUpdate();
}

function translateMDtoHTML(md) {
    md = md.split("\uF8FE\uF8FE%%%%%__USER_UPLOADED_FILES_AFTER_THIS__%%%%%\uF8FE\uF8FE")[0];
    md = translateMDtoHTMLDecoupled(md);
    return "<br style=\"user-select: none; -webkit-user-select: none;\">" + md;
}

async function renderMD(md, username = "user", arbs = "", files = {}, doAnimations = true, useIcons=true, iconScript="../icons/default-user.svg") {
    document.querySelectorAll("div.usr-input-master-container.before-messages")
        .forEach((element) => {
            element.classList.remove("before-messages");

            if (doAnimations) {
                element.classList.add("animation");
                setTimeout( () => {
                    element.classList.remove("animation");
                }, 200);
                element.querySelector(".usr-input-master").classList.add("animation");
                setTimeout( () => {
                    element.querySelector(".usr-input-master").classList.remove("animation");
                }, 300);
            }

            element.removeChild(element.querySelector(".initMessage"));
        });

    const container = document.getElementById("chat-container");
    container.insertAdjacentHTML('beforeend', `
        <div id="message_" class="chat-message" ${arbs}>
        ${translateMDtoHTML(md)}
        <div id="__file_field__" class="message-file-field"></div>
        </div>
    `);

    const fileField = document.getElementById("__file_field__");

    // Display file names only in UI
    const escapeHTML = (str) =>
        str.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    let bufferFileField = "";

    Object.keys(files).forEach((file) => {
        const iconName = files[file].icon || getFileIconFileName(file, files[file].mimetype, null);
        bufferFileField += `<div class="message-file">
                                <img src="../icons/type-icons/icons/${iconName}" class="fname-icon" />
                                ${escapeHTML(file)}
                            </div>`;
    });

    fileField.innerHTML = bufferFileField;

    const blame = document.getElementById("blameColumn");
    blame.insertAdjacentHTML('beforeend', `
    <div class="blm-spacer" id="blame_sp_"></div>
    <blm id="blame_mn_">
        ${username}
        ${useIcons ? `<img src="${iconScript}" class="user-icon"></img>` : ""}
    </blm>
    `);

    const blameSpacer = document.getElementById("blame_sp_");
    const blameMain = document.getElementById("blame_mn_");
    const message = document.getElementById("message_");

    [blameSpacer, blameMain, message, fileField].forEach((el) => el.removeAttribute("id"));

    await updateRules();
    scheduleBlameSpacerUpdate();
}

function collectFiles() {
    const fileField = document.getElementById("file-field");
    if (!fileField) return {};

    const fileStruct = {};

    fileField.querySelectorAll("div.context").forEach((div) => {
        const fileName = div.textContent.trim();
        const fileContent = div.dataset.content || "";
        const fileMimetype = div.dataset.mimetype || "";
        const fileIcon = div.dataset.icon || "";
        if (fileName) {
            fileStruct[fileName] = {
                content: fileContent,
                mimetype: fileMimetype,
                icon: fileIcon
            };
        }

        div.remove();
    });

    return fileStruct;
}

let submissionModel = "arcee-ai/trinity-large-preview:free"; // default fallback

(async () => {
    try {
        const settables = await getSettablesAsJson();
        if (settables?.models) {
            const { activeIndex, models } = settables.models;
            if (models?.[activeIndex]?.api_name) {
                submissionModel = models[activeIndex].api_name;
            }
        }
    } catch (err) {
        console.warn("Failed to load active model, using default:", err);
    }
})();


async function handleSubmission() {
    const textArea = document.querySelector("textarea");
    const message = textArea.value.trim();

    if (message === "") return;

    // indicate that the function is in execution
    setBlueDote(true);

    const fileStruct = collectFiles();

    // Render user message + file names
    const userMessageID = "user_message_" + Date.now() + Math.random();

    let userName = "User";

    try {
        userName = window.account.displayname;
    } catch {
        try {
                userName = window.account.username;
        } catch {
            userName = "User";
        }
    }

    let userIcon = "../icons/default-user.svg";

    try {
        userIcon = window.account.avatar;
    } catch {
        userIcon = "../icons/default-user.svg";
    }

    if (!userIcon) {
        userIcon = "../icons/default-user.svg";
    }

    await renderMD(message, userName, `usermessage="${userMessageID}"`, fileStruct, true, true, userIcon);
    textArea.value = "";
    const userMessage = document.querySelector(`[usermessage="${userMessageID}"]`);
    userMessage.scrollIntoView({ behavior: "smooth", block: "end" });

    // Load chat history
    let json = await getLocalJson();
    if (!json) json = { chat: VersionObject.newRepository() };
    
    // Initialize VersionObject from stored data
    if (Array.isArray(json.chat)) {
        // Legacy array format - create empty repo and migrate
        const repo = VersionObject.newRepository();
        json.chat.forEach((msg) => {
            repo[Object.keys(repo).filter(k => k !== 'active').length] = {
                parent: 0,
                content: [msg],
                children: []
            };
        });
        json.chat = new VersionObject(repo);
    } else if (json.chat && typeof json.chat === 'object' && !json.chat.compile) {
        // Stored VersionObject data - initialize the class
        try {
            json.chat = new VersionObject(json.chat);
        } catch (err) {
            console.warn("Failed to initialize chat VersionObject:", err);
            json.chat = new VersionObject(VersionObject.newRepository());
        }
    }

    // Store original message + files in history
    json.chat.commit([{ role: "user", content: message, files: fileStruct, type: "user" }]);
    let chatData = json.chat.json;
    await setLocalJson({ ...json, chat: chatData });

    // Prepare messages array for API submission
    let apiChat = json.chat.compile().map((msg) => {
        if (msg.role === "user" && Object.keys(msg.files || {}).length > 0) {
            // Merge file content for AI only
            let merged = msg.content;
            for (const [fname, fcontent] of Object.entries(msg.files)) {
                const contentStr = (typeof fcontent === "string") ? fcontent : (fcontent?.content || "");
                merged += `\n\nFile: ${fname}\n\`\`\`\n${contentStr}\n\`\`\``;
            }
            return { ...msg, content: merged };
        }
        return msg;
    });

    // Placeholder for streaming assistant response
    const streamId = "streaming_reply_" + Date.now();
    await renderMD("", "assistant", `streamid="${streamId}"`, [], true, true, "../icons/ai-default.svg");
    const streamEl = document.querySelector(`[streamid="${streamId}"]`);

    let fullReply = "";

    try {
        let globalOffStitch = false;
        const submitIconAction = (event) => {
            event.stopPropagation();
            globalOffStitch = true;
        };

        document.getElementById("submissionIcon").src = "../icons/cancel-message.svg";

        document.getElementById("submissionIcon").addEventListener("click", submitIconAction);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${globalAPIKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: submissionModel,
                messages: apiChat,
                stream: true
            }),
        });

        if (!response.ok || !response.body) {
            const err = new Error(response.statusText);
            err.status = response.status;
            throw err;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        const chatOuterer = document.querySelector('.chat-outerer');
        const actionButtons = document.querySelector('div.action-group-bar');

        if (!chatOuterer || !actionButtons) return;

        let isItWorthCalculatingScrollbar = !hasVerticalScrollbar(chatOuterer);

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (globalOffStitch) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";

            for (const part of parts) {
                if (!part.startsWith("data:")) continue;
                const data = part.replace(/^data:\s*/, "").trim();
                if (data === "[DONE]") break;

                try {
                    const jsonChunk = JSON.parse(data);
                    const delta = jsonChunk?.choices?.[0]?.delta?.content || "";
                    if (delta) {
                        fullReply += delta;
                        streamEl.innerHTML = translateMDtoHTML(fullReply);
                        await updateRules();

                        streamEl.scrollIntoView({ behavior: "instant", block: "end" });

                        if (isItWorthCalculatingScrollbar) {
                            if (hasVerticalScrollbar(chatOuterer)) {
                                actionButtons.classList.add("scrollbar");
                                isItWorthCalculatingScrollbar = false;
                            }
                        }

                        await new Promise(requestAnimationFrame);
                    }
                } catch (err) {
                    console.warn("Stream chunk parse error:", err);
                }
            }
        }

        document.getElementById("submissionIcon").src = "../icons/sendmessage.svg";
        document.getElementById("submissionIcon").removeEventListener("click", submitIconAction);

        // Finalize assistant message
        streamEl.innerHTML = translateMDtoHTML(fullReply);
        await updateRules();
        json.chat.commit([{ role: "assistant", content: fullReply, type: null }]);
        let chatData = json.chat.json;
        await setLocalJson({ ...json, chat: chatData });
        await updateRules();

        // determine whether the AI should rename the chat
        let letAIRenameChat = false;
        let hasPassedAssistant = false;

        json.chat.compile().forEach((msg) => {
            if (msg.role === "assistant") {
                letAIRenameChat = !hasPassedAssistant; // true only on first assistant message
                hasPassedAssistant = true;
            }
        });

        // if user already set a title, disable auto-title
        if (json?.metadata?.title) {
            letAIRenameChat = false;
        }

        if (letAIRenameChat) {
            try {
                // append system request for title generation
                const titleRequest = {
                    role: "user",
                    content:
    `(this message is generated by the ai interface, not the user, but is placed here on the behalf of the user in order to automatically give they're chat a title)

    Please summarize the chat so far into a short, clear, and easily searchable title.
    The interface will the first section you provide in double quotes ("this is a title") as the chat title, make it concise and directly descriptive of the conversation.
    Avoid complex punctuation, unnecessary symbols, or formatting. The chat title should summarize the chat up to but not including this title request message.
    For the sake of the user please get to the title displaying quotes as soon as possible (while still strictly following the guidelines best you can) so that they wont have to wait much time their chat to get titled.

    Follow these guidelines for good titles:

    A good title:
        - Clearly reflects the main topic of the chat
        - Uses simple, everyday words
        - Is easy to read and remember
        - Is short (ideally 4 to 7 words)
        - Is syntactically meaningful (uses words like for and the to describe relationships instead of a pile of keywords)
        - Gets to the main arguments of the conversation (e.g. if the conversation is talking about Microsoft stocks then the title should mention Microsoft and Stocks somewhere in it, If the conversation is about say how much Fuel needed to get to the moon, then it mentions Rocket, fuel and moon, if it is writing an Essay then it should clearly state that in the title with "Essay on ...") and they should be recognizable from the text of the title alone (it gose without saying that if a conversation is not about the stock market or whatever do not mention it)

    A bad title:
        - Is vague or generic (e.g., "Chat" or "Conversation")
        - Uses complex punctuation, emojis, or symbols
        - Includes irrelevant details
        - Describes or implies details never mentioned
        - Is overly long or difficult to scan quickly
        - Uses markdown or other formatting that is not plaintext (e.g. "**Bad Title**" or "# Uncool Title")
        - Is stating that this is a summary of the chat: "Chat Recap", "Overview of the Chat", "Chat Summary", "Summary" etc.`
                };

                json.chat.commit([titleRequest]);
                chatData = json.chat.json;

                apiChat = json.chat.compile().map((msg) => {
                    if (msg.role === "user" && Object.keys(msg.files || {}).length > 0) {
                        // Merge file content for AI only
                        let merged = msg.content;
                        for (const [fname, fcontent] of Object.entries(msg.files)) {
                            const contentStr = (typeof fcontent === "string") ? fcontent : (fcontent?.content || "");
                            merged += `\n\nFile: ${fname}\n\`\`\`\n${contentStr}\n\`\`\``;
                        }
                        return { ...msg, content: merged };
                    }
                    return msg;
                });

                const abortControler = new AbortController();

                const response4title = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${globalAPIKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: submissionModel,
                        messages: apiChat,
                        stream: true
                    }),
                    signal: abortControler.signal,
                });

                if (!response4title.ok || !response4title.body) {
                    throw new Error(`HTTP (Title Request): OpenRouter ${response4title.status}`);
                }

                const reader = response4title?.body?.getReader();
                const decoder = new TextDecoder();

                let buffer = "";
                let responseText = "";

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    const parts = buffer.split("\n\n");
                    buffer = parts.pop() || "";

                    for (const part of parts) {
                        if (!part.startsWith("data:")) continue;

                        const data = part.replace(/^data:\s*/, "").trim();

                        if (data === "[DONE]") {
                            break;
                        }

                        try {
                            const json = JSON.parse(data);
                            const delta = json?.choices?.[0]?.delta?.content || "";

                            if (delta) {
                                responseText += delta;
                            }

                            let title =
                                responseText.replace(/^["'\n\s]+|["'\n\s]+$/g, "").trim() || "Untitled";

                            setTabTitle(title);

                            if (responseText.matches(/"(.+)"/)) {
                                abortControler.abort();
                                break;
                            }
                        } catch (err) {
                            console.warn("Stream chunk parse error:", err);
                        }
                    }
                }

                let title =
                    responseText.replace(/^["'\n\s]+|["'\n\s]+$/g, "").trim() || "Untitled";

                setTabTitle(title);

                json = await getLocalJson() || {};
                if (!json.metadata) json.metadata = {};
                json.metadata.title = title;
                await setLocalJson(json);
            }
            catch (error) {
                console.error(error.message);
                setTabTitle("Untitled (Error State)");

                json = await getLocalJson() || {};
                if (!json.metadata) json.metadata = {};
                delete json.metadata.title;
                await setLocalJson(json);
            }
        }
    } catch (error) {
        console.error("Streaming error:", error);
        streamEl.innerHTML = `<br style="user-select: none; -webkit-user-select: none;"><p><b>Error:</b><br>&nbsp;&nbsp;&nbsp;&nbsp;${error.message || "OpenRouter Error:"}${error.status != null ? `<br>&nbsp;&nbsp;&nbsp;&nbsp;${error.status}` : ""}</p>`;

    }

    setBlueDote(false); // indicate that the function is no longer executing

}

document.querySelector("textarea").addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await handleSubmission();
        setBlueDote(false);
        await updateVpanel();
    }
});

document.getElementById("submissionIcon").addEventListener("click", async (event) => {
    event.preventDefault();
    await handleSubmission();
    setBlueDote(false);
    await updateVpanel();
});

window.addEventListener("resize", () => {
    updateTitleButtonPosition();
    scheduleBlameSpacerUpdate();
});

let menuToggled = false;
const menus = document.querySelectorAll(".menu");

menus.forEach((menu) => {
    menu.addEventListener("click", () => {
        menuToggled = !menuToggled;

        menus.forEach((m) => {
            const dropdown = m.querySelector(".dropdown, .dropdown-nul");
            if (!dropdown) return;

            if (!menuToggled) {
                dropdown.classList.remove("dropdown");
                dropdown.classList.add("dropdown-nul");
            } else {
                if (m === menu) {
                    dropdown.classList.remove("dropdown-nul");
                    dropdown.classList.add("dropdown");
                } else {
                    dropdown.classList.remove("dropdown");
                    dropdown.classList.add("dropdown-nul");
                }
            }
        });
    });

    menu.addEventListener("mouseenter", () => {
        if (!menuToggled) return;

        menus.forEach((m) => {
            const dropdown = m.querySelector(".dropdown, .dropdown-nul");
            if (!dropdown) return;

            if (m === menu) {
                dropdown.classList.remove("dropdown-nul");
                dropdown.classList.add("dropdown");
            } else {
                dropdown.classList.remove("dropdown");
                dropdown.classList.add("dropdown-nul");
            }
        });
    });
});

document.addEventListener("click", (event) => {
    const elementList = [];
    let element = event.target;

    while (element) {
        elementList.push(element);
        element = element.parentElement;
    }

    const menusArray = Array.from(menus);
    const clickedInsideMenu = elementList.some((el) => menusArray.includes(el));

    if (!clickedInsideMenu) {
        menuToggled = false;
        document.querySelectorAll(".dropdown").forEach((drop) => {
            drop.classList.remove("dropdown");
            drop.classList.add("dropdown-nul");
        });
    }
});

document.querySelectorAll(".menu .dropdown .menu-item, .menu .dropdown-nul .menu-item").forEach((element) => {
    let type = element.getAttribute("type");

    switch (type) {
        case "setModel":
            element.addEventListener( "click", () => {
                submissionModel = element.getAttribute("model");
            });
            break;
    }
});

async function readFileTextInChunks(file, chunkSize = 4 * 1024 * 1024) {
    let offset = 0;
    let text = "";

    while (offset < file.size) {
        const chunk = file.slice(offset, offset + chunkSize);
        text += await chunk.text();
        offset += chunkSize;

        if (offset < file.size) {
            await new Promise(requestAnimationFrame);
        }
    }

    return text;
}

async function getFilePreviewDataView(file, previewBytes = 256) {
    const previewSlice = file.slice(0, previewBytes);
    const buffer = await previewSlice.arrayBuffer();
    return new DataView(buffer);
}

const addContextButton = document.querySelector(".context#add-context");
const hiddenFileInput = document.querySelector("#hidden-file-input");
const fileField = document.querySelector("#file-field");
const fileLoadingIcon = "../icons/fileonload.svg";

addContextButton?.addEventListener("mousedown", () => {
    if (!hiddenFileInput || !fileField) return;
    hiddenFileInput.click();

    hiddenFileInput.addEventListener(
        "change",
        async (event) => {
            const files = Array.from(event.target.files || []);

            try {
                if (files.length === 0) return;
                for (let index = 0; index < files.length; index++) {
                    const file = files[index];

                    if (file.size > 6e8) {
                        continue;
                    }

                    const div = document.createElement("div");
                    div.classList.add("context");
                    div.dataset.mimetype = "";
                    div.dataset.content = "";
                    div.dataset.icon = "";

                    const iconImg = document.createElement("img");
                    iconImg.className = "fname-icon";
                    iconImg.src = fileLoadingIcon;

                    div.appendChild(iconImg);
                    div.appendChild(document.createTextNode(file.name));

                    fileField.appendChild(div);

                    div.addEventListener("click", () => {
                        div.remove();
                    });

                    div.addEventListener("mouseover", () => {
                        div.classList.add("hovering");
                        div.querySelector("img.fname-icon").src = "../icons/close-file.svg";
                    });

                    div.addEventListener("mouseleave", () => {
                        div.classList.remove("hovering");
                        const currentIcon = div.dataset.icon;
                        div.querySelector("img.fname-icon").src =
                            currentIcon
                                ? `../icons/type-icons/icons/${currentIcon}`
                                : fileLoadingIcon;
                    });

                    const fileContent = await readFileTextInChunks(file);
                    const previewView = await getFilePreviewDataView(file);
                    const iconName = getFileIconFileName(file.name, file.type, previewView);

                    div.dataset.content = fileContent;
                    div.dataset.mimetype = file.type || "";
                    div.dataset.icon = iconName;
                    iconImg.src = `../icons/type-icons/icons/${iconName}`;

                    await new Promise(requestAnimationFrame);
                }
            } finally {
                hiddenFileInput.value = "";
            }
        },
        { once: true }
    );
});
