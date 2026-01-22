window.onload = async () => {
    await fixThemeOverSettable(); // correct themedge
    await fixModelMenu();

    // Load account data
    let accountData;

    try {
        accountData = await getSettablesAsJson();
        accountData = accountData.account;
        window.account = accountData;
    } catch {
        accountData = {"account": {"displayname": "User"}};
        accountData = accountData.account;
        window.account = accountData;
    }

    const json = await getLocalJson();
    if (!json) return;

    if (json.chat && Array.isArray(json.chat)) {
        json.chat.forEach(message => {
            if (message.role !== "system") {
                // Use account data if available
                let username = "user";
                let icon = "../icons/defualt-user.svg";

                if (accountData && message.role === "user") {
                    username = accountData.displayname || accountData.username || "User";
                    icon = accountData.avatar || "../icons/defualt-user.svg";
                } else if (message.role === "assistant") {
                    icon = "../icons/ai-defult.svg";
                    username = "assistant";
                }

                renderMD(message.content, username, "", message.files, false, true, icon);
            }
        });

    }

    let lastTitle = document.title;

    setTimeout(async () => {
        let json = await getLocalJson();
        if (json?.metadata?.title && json.metadata.title !== lastTitle) {
            setTabTitle(json.metadata.title);
            lastTitle = json.metadata.title;
        }
    }, 0);

    updateTitleButtonPosition();
};

window.addEventListener("load", () => {
    setTimeout(updateTitleButtonPosition, 200);
});

window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "saveQuit") return;
    closeSelf();
});

function hasVerticalScrollbar(element) {
    return element.scrollHeight > element.clientHeight;
}

function updateTitleButtonPosition() {
    const chatOuterer = document.querySelector('.chat-outerer');
    const titleBtn = document.querySelector('img.change-title-btn');

    if (!chatOuterer || !titleBtn) return;

    if (hasVerticalScrollbar(chatOuterer)) {
        titleBtn.style.right = '20px';
    } else {
        titleBtn.style.right = '5px';
    }
}

async function reTitleTab() {
    const chatOuterer = document.querySelector('.chat-outerer');
    if (!chatOuterer) return;

    // prevent duplicates
    if (chatOuterer.querySelector('.top-bar-flash-for-rename')) return;

    chatOuterer.insertAdjacentHTML("afterbegin", `
        <div class="top-bar-flash-for-rename ${hasVerticalScrollbar(chatOuterer) ? "rightborder" : ""}">
            <img src="../icons/submittitle.svg" class="submit-title-btn" title="submit title">
            <input class="title-input">
        </div>
    `);

    let topBarFlashForeRenameIneterval = setInterval(() => {
        if (document.querySelector("div.top-bar-flash-for-rename")) {
            if (hasVerticalScrollbar(chatOuterer)) {
                document.querySelector("div.top-bar-flash-for-rename").classList.add("rightborder");
            } else {
                document.querySelector("div.top-bar-flash-for-rename").classList.remove("rightborder");
            }
        }
    }, 200);

    const renameBar = chatOuterer.querySelector('.top-bar-flash-for-rename');
    const submitBtn = renameBar.querySelector('.submit-title-btn');
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
        clearInterval(topBarFlashForeRenameIneterval);
    };

    const cancelRename = () => {
        renameBar.classList.add("on-close");
        setTimeout(() => renameBar.remove(), 250);
        clearInterval(topBarFlashForeRenameIneterval);
    };

    submitBtn.addEventListener("click", closeBar);
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
                submisionModel = element.getAttribute('model');
                console.log('Model set to', submisionModel);
            });
        }
    });
}

document.querySelector('img.change-title-btn').addEventListener("click", async () => {
    await reTitleTab();
});

function updateRules() {

    document.querySelectorAll("pre div.copy-btn").forEach((element) => {
        element.addEventListener("click", () => {
            const code = element.parentElement.querySelector("code");
            if (!code) return;

            navigator.clipboard.writeText(code.innerText)

            function resetBtn() {
                element.classList.remove("copied");
                element.innerHTML = "Copy";
            }

            element.classList.add("copied");
            element.innerHTML = "Copied";
            setTimeout(resetBtn, 1000);
        });
    });

    Prism.highlightAll();

    document.querySelectorAll(".blm-spacer").forEach((element) => {
        const height = element.getAttribute("vertical");
        if (height) {
            element.style.height = height;
        }
        element.removeAttribute("vertical");
    });

    // Update title button position after content changes
    updateTitleButtonPosition();
}

function translateMDtoHTML(md) {
    md = md.split("%%%%%__USER_UPLOADED_FILES_AFTER_THIS__%%%%%")[0];

    const escapeHTML = str =>
        str.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/\n.*>/g, match => (match.startsWith("\n>") ? match : "&gt;")) // dose not escape things that will be converter into blockquotes
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // Escape HTML first
    md = escapeHTML(md);

    // Code blocks (fenced)
    md = md.replace(/```(\w+)?\n([\s\S]*?)\n```/gm,
        (_, lang, code) =>
            `<pre class="code"><div class='copy-btn'>Copy</div><code class='language-${lang || ""}'>${code}</code></pre>`
    );

    // Ordered lists
    md = md.replace(/(?:^\d+\.\s.+\n?)+/gm, match => {
        let items = match.trim().split(/\n/).map(line => {
            return line.replace(/^\d+\.\s+/, "<li>") + "</li>";
        }).join("");
        return `<ol type="decimal">${items}</ol>`;
    });

    // Unordered lists
    md = md.replace(/(?:^[-*]\s.+\n?)+/gm, match => {
        let items = match.trim().split(/\n/).map(line => {
            return line.replace(/^[-*]\s+/, "<li>") + "</li>";
        }).join("");
        return `<ul>${items}</ul>`;
    });

    // Headings
    md = md.replace(/^###(.+)$/gm, "<h3>$1</h3>");
    md = md.replace(/^##(.+)$/gm, "<h2>$1</h2>");
    md = md.replace(/^#(.+)$/gm, "<h1>$1</h1>");


    // Blockquotes (group consecutive > lines into one blockquote)
    md = md.replace(
    /((?:^>.*(?:\n|$))+)/gm,
    block => {
        const content = block
        .replace(/^>\s?/gm, "")   // remove leading >
        .trim()
        .replace(/\n/g, "<br>");  // preserve line breaks inside quote

        return `<blockquote>${content}</blockquote>`;
    }
    );

    // Horizontal rules
    md = md.replace(/^(?:-{3,}|\*{3,}|_{3,})$/gm, "<hr>");

    // Inline formatting
    md = md.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    md = md.replace(/\*(.+?)\*/g, "<i>$1</i>");
    md = md.replace(/~~(.+?)~~/g, "<s>$1</s>");
    md = md.replace(/~(.+?)~/g, "<sub>$1</sub>");
    md = md.replace(/\^(.+?)\^/g, "<sup>$1</sup>");
    md = md.replace(/==(.+?)==/g, "<h>$1</h>");
    md = md.replace(/`(.+?)`/g, "<code>$1</code>");
    md = md.replace(/\[(.+?)\]\((.+?)\)/g, "<a href='$2' target='_blank'>$1</a>");

    // Newline formating
    md = md.replace(/\\n/, "<br>");
    md = md.replace(/\n/, "<br>");

    // Table formatting
    md = md.replace(
        /((?:\|?.+\|.*(?:\n|<br>|$))+)/g,
        tableBlock => {
            const rows = tableBlock.split(/\r?\n|<br>/).map(r => r.trim()).filter(r => r);

            if (rows.length < 2) return tableBlock;

            const separator = rows[1].replace(/^\||\|$/g, "").trim();
            if (!/^:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)*$/.test(separator)) return tableBlock;

            const headerCells = rows[0].replace(/^\||\|$/g, "").split("|")
                .map(c => `<th>${c.trim()}</th>`).join("");

            const bodyRows = rows.slice(2).map(r => {
                const cols = r.replace(/^\||\|$/g, "").split("|")
                    .map(c => `<td>${c.trim()}</td>`).join("");
                return `<tr>${cols}</tr>`;
            }).join("");

            return `<table>
                        <thead><tr>${headerCells}</tr></thead>
                        <tbody>${bodyRows}</tbody>
                    </table>`;
        }
    );

    return "<br style=\"user-select: none;\">" + md.trim();
}

function renderMD(md, username = "user", arbs = "", files = {}, doAnimations = true, useIcons=true, iconScript="../icons/defualt-user.svg") {
    document.querySelectorAll("div.usr-input-master-container.befor-messages")
        .forEach((element) => {
            element.classList.remove("befor-messages");

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
    container.innerHTML += `
        <div id="message_" ${arbs}>
        ${translateMDtoHTML(md)}
        <div id="__file_feild__" class="message-file-feild"></div>
        </div>
    `;

    const fileFeild = document.getElementById("__file_feild__");

    // Display file names only in UI
    Object.keys(files).forEach((file) => {
        fileFeild.innerHTML += `<div class="message-file">${file}</div>`;
    });

    const blame = document.getElementById("blameColumn");
    blame.innerHTML += `
    <div class="blm-spacer" id="blame_sp_"></div>
    <blm id="blame_mn_">
        ${username}
        ${useIcons ? `<img src="${iconScript}" class="user-icon"></img>` : ""}
    </blm>
    `;

    const blameSpacer = document.getElementById(`blame_sp_`);
    const blameMain = document.getElementById(`blame_mn_`);
    const message = document.getElementById(`message_`);

    const blameMainBottom = blameMain.getBoundingClientRect().bottom + window.scrollY;
    const messageTop = message.getBoundingClientRect().top + window.scrollY;

    blameSpacer.setAttribute("vertical", `calc(${messageTop - blameMainBottom}px + 1lh)`);

    [blameSpacer, blameMain, message, fileFeild].forEach(el => el.removeAttribute("id"));

    updateRules();
}

function collectFiles() {
    const fileFeild = document.getElementById("file-feild");
    if (!fileFeild) return {};

    const fileStruct = {};

    fileFeild.querySelectorAll("div.context").forEach(div => {
        const fileName = div.textContent.trim();
        const fileContent = div.dataset.content || "";
        if (fileName) fileStruct[fileName] = fileContent;

        div.remove();
    });

    return fileStruct;
}

let submisionModel = "meta-llama/llama-3.2-3b-instruct:free"; // default fallback

(async () => {
    try {
        const settables = await getSettablesAsJson();
        if (settables?.models) {
            const { activeIndex, models } = settables.models;
            if (models?.[activeIndex]?.api_name) {
                submisionModel = models[activeIndex].api_name;
            }
        }
    } catch (err) {
        console.warn("Failed to load active model, using default:", err);
    }
})();


async function handleSubmision() {
    const key = "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"; // dev key, remove before shiping !!

    const textArea = document.querySelector("textarea");
    const message = textArea.value.trim();

    if (message === "") return;

    // indecate that the function is in execution
    setBlueDote(true);

    const fileStruct = collectFiles();

    // Render user message + file names
    const userMessageID = "user_message_" + Date.now() + Math.random();
    renderMD(message, window.account.displayname || window.account.username || "User", `usermeasage="${userMessageID}"`, fileStruct, true, true, window.account.avatar || "../icons/defualt-user.svg");
    textArea.value = "";
    const userMessage = document.querySelector(`[usermeasage="${userMessageID}"]`);
    userMessage.scrollIntoView({ behavior: "smooth", block: "end" });

    // Load chat history
    let json = await getLocalJson();
    if (!json) json = { chat: [] };
    if (!Array.isArray(json.chat)) json.chat = [];

    // Store original message + files in history (no duplication)
    json.chat.push({ role: "user", content: message, files: fileStruct, type: "user", });
    await setLocalJson(json);

    // Prepare messages array for API submission
    let apiChat = json.chat.map(msg => {
        if (msg.role === "user" && Object.keys(msg.files || {}).length > 0) {
            // Merge file content for AI only
            let merged = msg.content;
            for (const [fname, fcontent] of Object.entries(msg.files)) {
                merged += `\n\nFile: ${fname}\n\`\`\`\n${fcontent}\n\`\`\``;
            }
            return { ...msg, content: merged };
        }
        return msg;
    });

    // Placeholder for streaming assistant response
    const streamId = "streaming_reply_" + Date.now();
    renderMD("", "assistant", `streamid="${streamId}"`, [], true, true, "../icons/ai-defult.svg");
    const streamEl = document.querySelector(`[streamid=${streamId}]`);

    let fullReply = "";

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: submisionModel,
                messages: apiChat,
                stream: true
            }),
        });

        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

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
                        streamEl.scrollIntoView({ behavior: "smooth", block: "end" });
                    }
                } catch (err) {
                    console.warn("Stream chunk parse error:", err);
                }
            }
        }

        // Finalize assistant message
        streamEl.innerHTML = translateMDtoHTML(fullReply);
        updateRules();
        json.chat.push({ role: "assistant", content: fullReply, type: null, });
        await setLocalJson(json);
        updateRules();

        // detertype whether the AI should rename the chat
        let letAIRenameChat = false;
        let hasPassedAssistant = false;

        json.chat.forEach(msg => {
            if (msg.role === "assistant") {
                letAIRenameChat = !hasPassedAssistant; // true only on first assistant message
                hasPassedAssistant = true;
            }
        });

        // if user already set a title, disable auto-title
        try {
            json.metadata.title;
            letAIRenameChat = false;
        } catch {}

        if (letAIRenameChat) {
            // append system request for title generation
            const titleRequest = {
                role: "user",
                content:
`(this message is generated by the ai interface, not the user, but is placed here on the behalf of the user)

Please summarize the chat so far into a short, clear, and easily searchable title.
The interface will take your entire response as the chat title, so make it concise and directly descriptive of the conversation.
Avoid complex punctuation, unnecessary symbols, or formatting.

Follow these guidelines for good titles:

A good title:
    - Clearly reflects the main topic of the chat
    - Uses simple, everyday words
    - Is easy to read and remember
    - Is short (ideally 4 to 7 words)
    - Is syntactically meaningful (uses words like for and the to describe relationships instead of a pile of keywords)

A bad title:
    - Is vague or generic (e.g., "Chat" or "Conversation")
    - Uses complex punctuation, emojis, or symbols
    - Includes irrelevant details
    - Describes or implies details never mentioned
    - Is overly long or difficult to scan quickly
    - Uses markdown or other formating that is not plaintext (e.g. "**Bad Tittle**" or "# Uncool Tittle")`
            };

            json.chat.push(titleRequest);

            apiChat = json.chat.map(msg => {
                if (msg.role === "user" && Object.keys(msg.files || {}).length > 0) {
                    // Merge file content for AI only
                    let merged = msg.content;
                    for (const [fname, fcontent] of Object.entries(msg.files)) {
                        merged += `\n\nFile: ${fname}\n\`\`\`\n${fcontent}\n\`\`\``;
                    }
                    return { ...msg, content: merged };
                }
                return msg;
            });

            const response4Tittle = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: submisionModel,
                    messages: apiChat,
                }),
            });

            const responseData = await response4Tittle.json();
            const responseText = responseData.choices[0].message.content;

            setTabTitle(responseText);

            json = await getLocalJson() || {};
            if (!json.metadata) json.metadata = {};
            json.metadata.title = responseText;
            await setLocalJson(json);
        }
    } catch (err) {
        console.error("Streaming error:", err);
        streamEl.innerHTML = `<p><b>Error:</b> ${err.message}</p>`;
    }

    setBlueDote(false); // indecate that the function is no longer executing

}

document.querySelector("textarea").addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        await handleSubmision();
    }
});

document.getElementById("submitionIcon").addEventListener("click", async (event) => {
    event.preventDefault();
    await handleSubmision();
});

window.addEventListener("resize", updateTitleButtonPosition);

let menuToggled = false;
const menus = document.querySelectorAll(".menu");

menus.forEach(menu => {
    menu.addEventListener("click", () => {
        menuToggled = !menuToggled;

        menus.forEach(m => {
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

        menus.forEach(m => {
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
    const clickedInsideMenu = elementList.some(el => menusArray.includes(el));

    if (!clickedInsideMenu) {
        menuToggled = false;
        document.querySelectorAll(".dropdown").forEach(drop => {
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
                submisionModel = element.getAttribute("model");
            });
            break;
    }
});

document.querySelector(".context#add-context").addEventListener("mousedown", () => {
    const fileInput = document.querySelector("#hidden-file-input");
    fileInput.click();
    const fileFeild = document.querySelector("#file-feild");

    fileInput.addEventListener(
        "change",
        async (event) => {
                const files = event.target.files;

                for (const file of files) {
                    const reader = new FileReader();

                    reader.onload = (e) => {
                        const div = document.createElement("div");
                        div.classList.add("context");
                        div.textContent = file.name; // safe text content
                        div.dataset.content = e.target.result; // store file content safely

                        div.innerHTML = `
                    <img
                        src="../icons/type-icons/icons/${getFileIconFileName(file.name, file.type)}"
                        class="fname-icon">
                    </img>`
                    + div.innerHTML;

                        fileFeild.appendChild(div);

                        div.addEventListener("click", () => {
                            div.remove();
                        });

                        div.addEventListener("mouseover", () => {
                            div.classList.add("hovring");
                            div.querySelector("img.fname-icon").src = "../icons/close-file.svg";
                        });

                        div.addEventListener("mouseleave", () => {
                            div.classList.remove("hovring");
                            div.querySelector("img.fname-icon").src =
                    "../icons/type-icons/icons/"
                    + getFileIconFileName(file.name, file.type);
                        });
                    };

                    reader.onerror = (err) => {
                        console.error(`Error reading ${file.name}:`, err);
                    };

                    reader.readAsText(file); // You can also use readAsArrayBuffer() or readAsDataURL()
                }
        },
        { once: true }
    );
},{
    once: false
});
