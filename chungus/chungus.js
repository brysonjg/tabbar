window.onload = async () => {
    await fixThemeOverSettable();
    await fixThemeOverSettable("prism");
    await fixThemeOverSettable("gitgraph");

    await fixModelMenu();

    // Load account data
    const settables = await getSettablesAsJson();
    const accountData = {
        displayname: "User",
        avatar: "../icons/default-user.svg",
        ...(settables?.account)
    };
    window.account = accountData;

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
                username = accountData.displayname;
                icon = accountData.avatar;
            } else if (message.role === "assistant") {
                icon = "../icons/ai-default.svg";
                username = "assistant";
            }

            await renderMD(message.content, username, message.files, false, icon);
        }
    }

    setTimeout(async () => {
        if (json?.metadata?.title) {
            setTabTitle(json.metadata.title);
        }
        else {
            setTabTitle("Untitled");
        }
    }, 0);

    startBlameSpacerScheduler();
    startUsrInputOffsetObserver();
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
let usrInputOffsetRafId = 0;

function isUsrInputContainerAnimating() {
    return document.querySelector("div.usr-input-master-container.animation") !== null;
}

const USR_INPUT_POSITION_ANIM_MS = 200;

function animateUsrInputContainerTransition(element) {
    const master = element.querySelector(".usr-input-master");
    if (!master) return;

    const firstRect = master.getBoundingClientRect();

    element.classList.remove("before-messages");
    const initMessage = element.querySelector(".initMessage");
    if (initMessage) initMessage.remove();

    element.classList.add("animation");

    const lastRect = master.getBoundingClientRect();
    const deltaY = firstRect.top - lastRect.top;

    master.classList.add("animation");

    const finish = () => {
        element.style.transform = "";
        element.style.transition = "";
        element.classList.remove("animation");
        master.classList.remove("animation");
        scheduleUsrInputOffsetUpdate();
    };

    if (Math.abs(deltaY) < 1) {
        setTimeout(finish, USR_INPUT_POSITION_ANIM_MS);
        return;
    }

    element.style.transform = `translateY(${deltaY}px)`;
    element.offsetHeight;
    element.style.transition = `transform ${USR_INPUT_POSITION_ANIM_MS}ms ease-out`;

    const onTransitionEnd = (event) => {
        if (event.target !== element || event.propertyName !== "transform") return;
        element.removeEventListener("transitionend", onTransitionEnd);
        finish();
    };
    element.addEventListener("transitionend", onTransitionEnd);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            element.style.transform = "";
        });
    });

    setTimeout(() => {
        if (element.classList.contains("animation")) {
            element.removeEventListener("transitionend", onTransitionEnd);
            finish();
        }
    }, USR_INPUT_POSITION_ANIM_MS + 50);
}

function updateUsrInputOffset() {
    if (isUsrInputContainerAnimating()) return;

    const container = document.querySelector("div.usr-input-master-container");
    const master = container?.querySelector(".usr-input-master");
    if (!container || !master) return;

    const offset = container.classList.contains("before-messages")
        ? "0px"
        : `${Math.ceil(master.getBoundingClientRect().height + 7)}px`;

    document.documentElement.style.setProperty("--usr-input-offset", offset);
}

function scheduleUsrInputOffsetUpdate() {
    if (usrInputOffsetRafId) return;
    usrInputOffsetRafId = requestAnimationFrame(() => {
        usrInputOffsetRafId = 0;
        updateUsrInputOffset();
        scheduleBlameSpacerUpdate();
        updateTitleButtonPosition();
    });
}

function startUsrInputOffsetObserver() {
    if (window._usrInputOffsetObserverStarted) return;
    window._usrInputOffsetObserverStarted = true;

    const container = document.querySelector("div.usr-input-master-container");
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => scheduleUsrInputOffsetUpdate());
    resizeObserver.observe(container);

    const master = container.querySelector(".usr-input-master");
    if (master) resizeObserver.observe(master);

    const mutationObserver = new MutationObserver(() => scheduleUsrInputOffsetUpdate());
    mutationObserver.observe(container, {
        attributes: true,
        attributeFilter: ["class"],
    });

    const textarea = document.querySelector("textarea#text-input");
    if (textarea) {
        textarea.addEventListener("input", scheduleUsrInputOffsetUpdate);
    }

    window.addEventListener("resize", scheduleUsrInputOffsetUpdate);
    scheduleUsrInputOffsetUpdate();
}

function scheduleBlameSpacerUpdate() {
    if (blameSpacerRafId) return;
    blameSpacerRafId = requestAnimationFrame(() => {
        blameSpacerRafId = 0;
        updateBlameSpacersFast();
    });
}

function updateBlameSpacersFast() {
    const messages = document.querySelectorAll("#chat-container > .chat-message");
    const blameColumn = document.getElementById("blameColumn");
    const blameSpacers = blameColumn.querySelectorAll(".blm-spacer");
    const blameMains = blameColumn.querySelectorAll("blm");
    const pairCount = Math.min(messages.length, blameSpacers.length, blameMains.length);
    if (pairCount === 0) return;

    const columnTop = blameColumn.getBoundingClientRect().top;
    const paddingTop = parseFloat(getComputedStyle(blameColumn).paddingTop) || 0;
    let cursor = paddingTop;

    for (let i = 0; i < pairCount; i++) {
        const messageTop = messages[i].getBoundingClientRect().top - columnTop;
        const spacerHeight = Math.max(0, Math.round(messageTop - cursor));
        const nextHeight = `${spacerHeight}px`;

        if (blameSpacers[i].style.height !== nextHeight) {
            blameSpacers[i].style.height = nextHeight;
        }

        cursor += spacerHeight + blameMains[i].getBoundingClientRect().height;
    }
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

        titleBtn.style.top = '5px';  // set height back to its default
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
    let chatHistoryButton = document.querySelector("img.action-bar-action.chat-history-btn");
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
                    username = window.account.displayname;
                    icon = window.account.avatar;
                } else if (message.role === "assistant") {
                    icon = "../icons/ai-default.svg";
                    username = "assistant";
                }

                await renderMD(message.content, username, message.files, false, icon);
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

document.querySelector("img.action-bar-action.chat-history-btn")
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

async function updateRules() {
    await batUpdateRules();

    // Update title button position after content changes
    updateTitleButtonPosition();
    scheduleBlameSpacerUpdate();
}

function translateMDtoHTML(md) {
    md = translateMDtoHTMLDecoupled(md);
    return "<br style=\"user-select: none; -webkit-user-select: none;\">" + md;
}

async function renderMD(md, username = "user", files = {}, doAnimations = true, iconScript="../icons/default-user.svg") {
    const beforeMessageUserInput = document.querySelector("div.usr-input-master-container.before-messages");
    if (beforeMessageUserInput) {
        if (doAnimations) {
            animateUsrInputContainerTransition(beforeMessageUserInput);
        } else {
            beforeMessageUserInput.classList.remove("before-messages");
            beforeMessageUserInput.querySelector(".initMessage")?.remove();
            scheduleUsrInputOffsetUpdate();
        }
    }

    const container = document.getElementById("chat-container");

    const message = document.createElement("div");
    message.className = "chat-message";
    message.innerHTML = translateMDtoHTML(md);

    const fileField = document.createElement("div");
    fileField.className = "message-file-field";

    message.appendChild(fileField);
    container.appendChild(message);

    Object.entries(files).forEach(([file, meta]) => {
        const iconName = meta.icon ?? getFileIconFileName(file, meta.mimetype, null);
        const iconSource = `../icons/type-icons/icons/${iconName}`;

        const div = document.createElement("div");
        div.className = "message-file";

        const img = document.createElement("img");
        img.className = "fname-icon";
        img.src = iconSource;

        div.appendChild(img);
        div.appendChild(document.createTextNode(file));

        fileField.appendChild(div);
    });

    const blame = document.getElementById("blameColumn");

    const blameSpacer = document.createElement('div');
    blameSpacer.className = "blm-spacer";
    blame.appendChild(blameSpacer);

    const blameTitle = document.createElement('blm');
    const blameTitleIcon = document.createElement('img');
    blameTitleIcon.className = "user-icon";
    blameTitleIcon.src = iconScript;

    blameTitle.append(document.createTextNode(username), blameTitleIcon);
    blame.appendChild(blameTitle);

    await updateRules();
    scheduleBlameSpacerUpdate();

    message.scrollIntoView({behavior: "instant", block: "end"});

    return message;
}

function collectFiles() {
    const fileField = document.getElementById("file-field");
    if (!fileField) return {};

    const fileStruct = {};

    fileField.querySelectorAll("div.context.file-chip").forEach((div) => {
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

let submissionModel = "openai/gpt-oss-120b:free"; // default fallback

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

function getAPIChat(chatObject) {
    return chatObject.compile().map((msg) => {
        if (msg.role === "user" && Object.keys(msg.files || {}).length > 0) {
            let merged = msg.content;
            for (const [fname, fcontent] of Object.entries(msg.files)) {
                const contentStr = (typeof fcontent === "string") ? fcontent : (fcontent?.content || "");
                merged += `\n\nFile: ${fname}\n\`\`\`\n${contentStr}\n\`\`\``;
            }
            return { ...msg, content: merged };
        }
        return msg;
    });
}

async function handleSubmission() {
    const textArea = document.querySelector("textarea");
    const message = textArea.value.trim();

    if (message === "") return;

    const fileStruct = collectFiles();

    // Render user message + file names
    const userMessageID = "user_message_" + Date.now() + Math.random();

    const userName = window.account.displayname;
    const userIcon = window.account.avatar;

    await renderMD(message, userName, fileStruct, true, userIcon);
    textArea.value = "";

    // Load chat history
    let json = await getLocalJson();
    if (!json) json = { chat: VersionObject.newRepository() };

    // Store original message + files in history
    let versionObjectJson = new VersionObject(json.chat)
    versionObjectJson.commit([{ role: "user", content: message, files: fileStruct, type: "user" }]);
    let chatData = versionObjectJson.json;
    await setLocalJson({ ...json, chat: chatData });

    let apiChat = getAPIChat(versionObjectJson);

    // Placeholder for streaming assistant response
    const streamEl = await renderMD("", "assistant", {}, true, "../icons/ai-default.svg");

    let fullReply = "";

    try {
        let globalOffStitch = false;
        const submitIconAction = (event) => {
            event.stopPropagation();
            globalOffStitch = true;
        };

        const submissionIcon = document.getElementById("submissionIcon");
        submissionIcon.src = "../icons/cancel-message.svg";
        submissionIcon.addEventListener("click", submitIconAction);

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

                        chatOuterer.scrollTop = chatOuterer.scrollHeight;

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

        submissionIcon.src = "../icons/sendmessage.svg";
        submissionIcon.removeEventListener("click", submitIconAction);

        // Finalize assistant message
        streamEl.innerHTML = translateMDtoHTML(fullReply);
        await updateRules();
        versionObjectJson.commit([{ role: "assistant", content: fullReply, type: null }]);
        let chatData = versionObjectJson.json;
        await setLocalJson({ ...json, chat: chatData });

        // determine whether the AI should rename the chat
        let letAIRenameChat = false;
        let hasPassedAssistant = false;

        versionObjectJson.compile().forEach((msg) => {
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
                        `(this message is generated by the ai interface, not the user, but is placed here on the behalf of the user in order to automatically give they're chat a title)\n` +
                        `\n` +
                        `Please summarize the chat so far into a short, clear, and easily searchable title.\n` +
                        `The interface will the first section you provide in double quotes ("this is a title") as the chat title, make it concise and directly descriptive of the conversation.\n` +
                        `Avoid complex punctuation, unnecessary symbols, or formatting. The chat title should summarize the chat up to but not including this title request message.\n` +
                        `For the sake of the user please get to the title displaying quotes as soon as possible (while still strictly following the guidelines best you can) so that they wont have to wait much time their chat to get titled.\n` +
                        `\n` +
                        `Follow these guidelines for good titles:\n` +
                        `\n` +
                        `A good title:\n` +
                        `    - Clearly reflects the main topic of the chat\n` +
                        `    - Uses simple, everyday words\n` +
                        `    - Is easy to read and remember\n` +
                        `    - Is short (ideally 4 to 7 words)\n` +
                        `    - Is syntactically meaningful (uses words like for and the to describe relationships instead of a pile of keywords)\n` +
                        `    - Gets to the main arguments of the conversation (e.g. if the conversation is talking about Microsoft stocks then the title should mention Microsoft and Stocks somewhere in it, If the conversation is about say how much Fuel needed to get to the moon, then it mentions Rocket, fuel and moon, if it is writing an Essay then it should clearly state that in the title with "Essay on ...") and they should be recognizable from the text of the title alone (it gose without saying that if a conversation is not about the stock market or whatever do not mention it)\n` +
                        `\n` +
                        `A bad title:\n` +
                        `    - Is vague or generic (e.g., "Chat" or "Conversation")\n` +
                        `    - Uses complex punctuation, emojis, or symbols\n` +
                        `    - Includes irrelevant details\n` +
                        `    - Describes or implies details never mentioned\n` +
                        `    - Is overly long or difficult to scan quickly\n` +
                        `    - Uses markdown or other formatting that is not plaintext (e.g. "**Bad Title**" or "# Uncool Title")\n` +
                        `    - Is stating that this is a summary of the chat: "Chat Recap", "Overview of the Chat", "Chat Summary", "Summary" etc.`
                };

                versionObjectJson.commit([titleRequest]);
                chatData = versionObjectJson.json;

                apiChat = getAPIChat(versionObjectJson);

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

                            const title =
                                responseText.replace(/^["'](.*?)["']/, "$1").trim() || "Untitled";

                            setTabTitle(title);

                            await new Promise(requestAnimationFrame);
                        } catch (err) {
                            console.warn("Stream chunk parse error:", err);
                        }
                    }
                }

                const title =
                    responseText.replace(/^["'](.*?)["']/, "$1").trim() || "Untitled";

                setTabTitle(title);

                json = await getLocalJson();
                if (!json.metadata) json.metadata = {};
                json.metadata.title = title;
                await setLocalJson(json);
            }
            catch (error) {
                console.error("Title error:", error);

                setTabTitle("Untitled (Error State)");

                json = await getLocalJson();
                if (!json.metadata) json.metadata = {};
                json.metadata.title = "Untitled (Error State)";
                await setLocalJson(json);
            }
        }
    } catch (error) {
        console.error("Streaming error:", error);

        const fourIntentation = "\u00a0\u00a0\u00a0\u00a0";
        const errorMessage = `**Error:**\n${fourIntentation}${error.message || "OpenRouter Error:"}${error.status != null ? `\n${fourIntentation}${error.status}` : ""}`;

        streamEl.innerHTML = translateMDtoHTML(errorMessage);
        streamEl.scrollIntoView({ behavior: "instant", block: "end" });

        json = await getLocalJson();
        versionObjectJson = new VersionObject(json.chat);
        versionObjectJson.commit([{ role: "assistant", content: errorMessage, type: null }]);
        await setLocalJson({...json, chat: versionObjectJson.json});

        document.getElementById("submissionIcon").src = "../icons/sendmessage.svg";
    }
}

document.querySelector("textarea").addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await handleSubmission();
        await updateVpanel();
    }
});

document.getElementById("submissionIcon").addEventListener("click", async (event) => {
    event.preventDefault();
    await handleSubmission();
    await updateVpanel();
});

window.addEventListener("resize", () => {
    scheduleUsrInputOffsetUpdate();
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
let   hiddenFileInput = document.querySelector("#hidden-file-input");
const fileField = document.querySelector("#file-field");
const fileLoadingIcon = "../icons/fileonload.svg";

addContextButton?.addEventListener("mousedown", () => {
    const clonehiddenFileInput = hiddenFileInput.cloneNode(false);
    hiddenFileInput.parentNode.replaceChild(clonehiddenFileInput, hiddenFileInput);
    hiddenFileInput = document.querySelector("#hidden-file-input");

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
                    div.classList.add("context", "file-chip");
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
