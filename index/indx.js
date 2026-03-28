let selectedList = [];
let activeRename = null;
let searchDebounceTimeout = null;

window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "saveQuit") return;
    closeSelf();
});

window.onload = async () => {
    await fixThemeOverSettable("chungus");
    await fixThemeOverSettable("master");
    await fixThemeOverSettable();

    window.globalNames = await getGlobalNameQuery();
    window.hasInitedFuzzysort = false;

    renderJson(window.globalNames);
    requestAnimationFrame(updateScrollbarState);

    setTimeout(() => {
        document.querySelector("div.std-action-bar > div.center").classList.remove("init");
    }, 100);
};

window.addEventListener("resize", updateScrollbarState);

function updateScrollbarState() {
    const root = document.body;

    const holdings = document.querySelector("body > div.action-holdings");
    if (!holdings) return;

    if (root.scrollHeight > root.clientHeight) {
        holdings.classList.add("scrollbar");
    } else {
        holdings.classList.remove("scrollbar");
    }
}

function renderJson(json, renderOptions = {}) {
    const main = document.querySelector("main");

    main.innerHTML = "";

    const highlightMap = renderOptions.highlightMap instanceof Map ? renderOptions.highlightMap : null;
    const orderedIds = Array.isArray(renderOptions.orderedIds) ? renderOptions.orderedIds : null;

    const keys = (orderedIds ? orderedIds : Object.keys(json))
        .filter((key) => String(key).length > 2);

    if (!orderedIds) keys.reverse();

    const selectedSet = new Set(selectedList);

    keys.forEach((key) => {
        const div = document.createElement("div");
        const raw = json[key];
        const title = typeof raw === "string"
            ? raw
            : raw?.metadata?.title;
        const name = normalizeTitle(title);

        div.innerHTML =
            `
                <img class="action" id="selectImage" src="../icons/selectall.svg" title="select" />
                <div class="text">
                    ${name}
                </div>
                <div class="actions">
                    <img class="action" id="renameImage" src="../icons/document-edit.svg" title="rename chat" />
                    <img class="action red" id="deleteImage" src="../icons/removetablerow.svg" title="delete (no undo)" />
                </div>
            `.replaceAll("  ", "").replaceAll("\n", "")
        ;

        div.dataset.id = key;

        const highlightIndexes = highlightMap?.get(String(key)) || highlightMap?.get(key);
        setRowText(div, name, highlightIndexes);

        const selectImg = div.querySelector("img#selectImage");
        const isSelected = selectedSet.has(key);

        selectImg.dataset.selected = isSelected ? "true" : "false";
        selectImg.src = isSelected ? "../icons/select-active.svg" : "../icons/selectall.svg";

        selectImg.addEventListener("click", () => {
            if (selectImg.dataset.selected === "true") {
                selectImg.src = "../icons/selectall.svg";
                selectImg.dataset.selected = "false";

                const index = selectedList.indexOf(key);
                const length = selectedList.length - 1;
                selectedList[index] = selectedList[length];
                selectedList.pop();

                updateSelectAllButtonImage();
            } else {
                selectImg.src = "../icons/select-active.svg";
                selectImg.dataset.selected = "true";

                selectedList.push(key);

                updateSelectAllButtonImage();
            }
        });

        const deleteImg = div.querySelector("img#deleteImage");
        deleteImg.addEventListener("click", () => {
            const rowId = div.dataset.id;
            purgeTabMemory(rowId);
            delete window.globalNames[rowId];
            div.remove();
            try {
                const index = selectedList.indexOf(rowId);
                const length = selectedList.length - 1;
                selectedList[index] = selectedList[length];
                selectedList.pop();
            } catch {}
        });

        const renameImg = div.querySelector("img#renameImage");
        renameImg.addEventListener("click", () => beginRename(div));


        div.classList.add("selectable");
        main.appendChild(div);
    });

    updateSelectAllButtonImage();
    requestAnimationFrame(updateScrollbarState);
}

function normalizeTitle(title) {
    const asString = String(title ?? "");
    return asString.trim().length ? asString : "Untitled";
}

function setRowText(rowDiv, title, highlightIndexes = null) {
    const existingText = rowDiv.querySelector("div.text");
    const newText = document.createElement("div");
    newText.classList.add("text");

    const normalizedTitle = normalizeTitle(title);

    if (Array.isArray(highlightIndexes) && highlightIndexes.length && normalizedTitle !== "Untitled") {
        const sortedIndexes = [...new Set(highlightIndexes)]
            .filter((i) => Number.isInteger(i) && i >= 0 && i < normalizedTitle.length)
            .sort((a, b) => a - b);

        let cursor = 0;
        let indexCursor = 0;

        while (indexCursor < sortedIndexes.length) {
            const start = sortedIndexes[indexCursor];
            if (start > cursor) {
                newText.appendChild(document.createTextNode(normalizedTitle.slice(cursor, start)));
            }

            let end = start + 1;
            while (indexCursor + 1 < sortedIndexes.length && sortedIndexes[indexCursor + 1] === end) {
                indexCursor++;
                end++;
            }

            const span = document.createElement("span");
            span.classList.add("search-highlight");
            span.textContent = normalizedTitle.slice(start, end);
            newText.appendChild(span);

            cursor = end;
            indexCursor++;
        }

        if (cursor < normalizedTitle.length) {
            newText.appendChild(document.createTextNode(normalizedTitle.slice(cursor)));
        }
    } else {
        newText.textContent = normalizedTitle;
    }

    newText.addEventListener("click", () => {
        makeNewTabWithID(rowDiv.dataset.id);
    });

    if (existingText) existingText.replaceWith(newText);
    else rowDiv.querySelector("input.rename-chat")?.replaceWith(newText);
}

function cancelActiveRename() {
    if (!activeRename) return;
    const { rowDiv, originalTitle, renameImg, submitImg, cancelImg } = activeRename;

    rowDiv.classList.remove("renaming");
    submitImg.remove();
    cancelImg.remove();
    rowDiv.querySelector("div.actions")?.insertBefore(renameImg, rowDiv.querySelector("img#deleteImage"));
    setRowText(rowDiv, originalTitle);
    activeRename = null;
}

function submitActiveRename() {
    if (!activeRename) return;
    const { rowDiv, originalTitle, renameImg, submitImg, cancelImg, input } = activeRename;
    const nextTitleTrimmed = String(input.value ?? "").trim();
    const nextTitle = nextTitleTrimmed.length ? nextTitleTrimmed : originalTitle;

    chTitleOfTab(rowDiv.dataset.id, nextTitle);
    window.globalNames[rowDiv.dataset.id] = nextTitle;

    rowDiv.classList.remove("renaming");
    submitImg.remove();
    cancelImg.remove();
    rowDiv.querySelector("div.actions")?.insertBefore(renameImg, rowDiv.querySelector("img#deleteImage"));
    setRowText(rowDiv, nextTitle);
    activeRename = null;
}

function beginRename(rowDiv) {
    if (!rowDiv) return;
    if (activeRename?.rowDiv === rowDiv) return;
    cancelActiveRename();

    const textDiv = rowDiv.querySelector("div.text");
    if (!textDiv) return;

    const originalTitle = normalizeTitle(textDiv.textContent);
    const input = document.createElement("input");
    input.value = originalTitle;
    input.classList.add("rename-chat");

    const actionsDiv = rowDiv.querySelector("div.actions");
    const renameImg = actionsDiv?.querySelector("img#renameImage");
    const deleteImg = actionsDiv?.querySelector("img#deleteImage");
    if (!actionsDiv || !renameImg || !deleteImg) return;

    const submitImg = document.createElement("img");
    submitImg.classList.add("action");
    submitImg.id = "submitRenameImage";
    submitImg.src = "../icons/submittitle-index.svg";
    submitImg.title = "set title";

    const cancelImg = document.createElement("img");
    cancelImg.classList.add("action");
    cancelImg.id = "cancelRenameImage";
    cancelImg.src = "../icons/close-rename.svg";
    cancelImg.title = "cancel rename";

    submitImg.addEventListener("click", submitActiveRename);
    cancelImg.addEventListener("click", cancelActiveRename);

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            submitActiveRename();
        } else if (event.key === "Escape") {
            event.preventDefault();
            cancelActiveRename();
        }
    });

    rowDiv.classList.add("renaming");
    renameImg.remove();
    actionsDiv.insertBefore(submitImg, deleteImg);
    actionsDiv.insertBefore(cancelImg, deleteImg);
    textDiv.replaceWith(input);

    activeRename = { rowDiv, originalTitle, renameImg, submitImg, cancelImg, input };
    input.focus();
    input.setSelectionRange(0, input.value.length);
}

function updateSelectAllButtonImage() {
    const btn = document.getElementById("select-all-btn");

    const visibleSelectables = document.querySelectorAll("div.selectable").length;
    const visibleSelected = document.querySelectorAll('div.selectable img#selectImage[data-selected="true"]').length;

    if (visibleSelected === 0) {
        btn.src = "../icons/selectall.svg";
        btn.setAttribute("title", "select all");
    }
    else if (visibleSelected === visibleSelectables) {
        btn.src = "../icons/select-active.svg";
        btn.setAttribute("title", "deselect all");
    }
    else {
        btn.src = "../icons/parital-selection.svg";
        btn.setAttribute("title", "deselect selected");
    }
}

document.getElementById("select-all-btn").addEventListener("contextmenu", (event) => {
    event.preventDefault();

    const overlay = document.createElement("div");
    overlay.classList.add("transparent-menu-overlay");
    document.body.appendChild(overlay);

    const menu = document.createElement("div");
    menu.classList.add("selection-menu");

    const visibleSelectables = document.querySelectorAll("div.selectable").length;
    const visibleSelected = document.querySelectorAll('div.selectable img#selectImage[data-selected="true"]').length;

    if (visibleSelected === 0) {
        menu.innerHTML =
            `
                <div class="menu-action" data-action="select">Select All</div>
            `
        ;
    }
    else if (visibleSelected === visibleSelectables) {
        menu.innerHTML =
            `
                <div class="menu-action" data-action="deselect">Deselect All</div>
            `
        ;
    }
    else {
        menu.innerHTML =
            `
                <div class="menu-action" data-action="select">Select All</div>
                <div class="menu-action" data-action="deselect">Deselect All</div>
                <div class="menu-action" data-action="invert">Invert Selection</div>
            `
        ;
    }

    document.body.appendChild(menu);

    document.addEventListener("mousedown", (event) => {
        const menuAction = event.target.closest('.menu-action');

        if (menuAction) {
            const action = menuAction.dataset.action;

            switch (action) {
                case "select":
                    const selectabes = document.querySelectorAll("div.selectable:has(img.action:not([src=\"../icons/select-active.svg\"]))");

                    selectabes.forEach((element) => {
                        selectedList.push(element.dataset.id);
                        const selectImg = element.querySelector("img#selectImage");
                        selectImg.dataset.selected = "true";
                        selectImg.src = "../icons/select-active.svg";
                    });

                    updateSelectAllButtonImage()
                    break;
                case "deselect":
                    const deselectabes = document.querySelectorAll("div.selectable:has(img.action[src=\"../icons/select-active.svg\"])");

                    deselectabes.forEach((element) => {
                        const index = selectedList.indexOf(element.dataset.id);
                        const length = selectedList.length - 1;
                        selectedList[index] = selectedList[length];
                        selectedList.pop();

                        const selectImg = element.querySelector("img#selectImage");
                        selectImg.dataset.selected = "false";
                        selectImg.src = "../icons/selectall.svg";
                    });

                    updateSelectAllButtonImage()
                    break;
                case "invert":
                    const invertablesDeselectables = document.querySelectorAll(
                        'div.selectable:has(img#selectImage:not([src="../icons/select-active.svg"]))'
                    );

                    const invertablesSelectables = document.querySelectorAll(
                        'div.selectable:has(img#selectImage[src="../icons/select-active.svg"])'
                    );

                    invertablesSelectables.forEach((element) => {
                        const index = selectedList.indexOf(element.dataset.id);

                        if (index !== -1) {
                            selectedList[index] = selectedList[selectedList.length - 1];
                            selectedList.pop();
                        }

                        const selectImg = element.querySelector("img.action#selectImage");
                        selectImg.dataset.selected = "false";
                        selectImg.src = "../icons/selectall.svg";
                    });

                    invertablesDeselectables.forEach((element) => {
                        selectedList.push(element.dataset.id);

                        const selectImg = element.querySelector("img.action#selectImage");
                        selectImg.dataset.selected = "true";
                        selectImg.src = "../icons/select-active.svg";
                    });

                    updateSelectAllButtonImage();
                    break;
            }
        }

        overlay.remove();
        menu.remove();
    }, {once: true});
});

document.getElementById("select-all-btn").addEventListener("click", (event) => {
    const btn = document.getElementById("select-all-btn");

    const visibleSelectables = document.querySelectorAll("div.selectable").length;
    const visibleSelected = document.querySelectorAll('div.selectable img#selectImage[data-selected="true"]').length;

    if (visibleSelected === 0) {
        const selectabes = document.querySelectorAll("div.selectable:has(img.action:not([src=\"../icons/select-active.svg\"]))");

        selectabes.forEach((element) => {
            selectedList.push(element.dataset.id);
            const selectImg = element.querySelector("img.action");
            selectImg.dataset.selected = "true";
            selectImg.src = "../icons/select-active.svg";
        });

        updateSelectAllButtonImage();
    }
    else if (visibleSelected === visibleSelectables) {
        const deselectabes = document.querySelectorAll("div.selectable:has(img.action[src=\"../icons/select-active.svg\"])");

        deselectabes.forEach((element) => {
            const index = selectedList.indexOf(element.dataset.id);
            const length = selectedList.length - 1;
            selectedList[index] = selectedList[length];
            selectedList.pop();

            const selectImg = element.querySelector("img.action");
            selectImg.dataset.selected = "false";
            selectImg.src = "../icons/selectall.svg";
        });

        updateSelectAllButtonImage();
    }
    else {
        const deselectabes = document.querySelectorAll("div.selectable:has(img.action[src=\"../icons/select-active.svg\"])");

        deselectabes.forEach((element) => {
            const index = selectedList.indexOf(element.dataset.id);
            const length = selectedList.length - 1;
            selectedList[index] = selectedList[length];
            selectedList.pop();

            const selectImg = element.querySelector("img.action");
            selectImg.dataset.selected = "false";
            selectImg.src = "../icons/selectall.svg";
        });

        updateSelectAllButtonImage();
    }
});

document.getElementById("delete-all-btn").addEventListener("click", (event) => {
    selectedList.forEach((id) => {
        let tab = document.querySelector(`div[data-id="${id}"]`);
        if (tab) {
            tab.remove();
            purgeTabMemory(id);
            delete window.globalNames[id];
        }
    });
    selectedList = [];

    updateSelectAllButtonImage();
});

document.getElementById("search-btn").addEventListener("click", () => {
    const divCenter = document.querySelector("div.std-action-bar > div.center");
    const inputElement = divCenter.querySelector("input.search");
    const main = document.querySelector("main");

    const ensureFuzzysortIndex = () => {
        const entries = Object.entries(window.globalNames || {});
        if (window.hasInitedFuzzysort && window.fuzzysortIndexSourceSize === entries.length) return;

        window.fuzzysortIndex = entries
            .filter(([id, title]) =>
                Number(id) >= 100 &&
                String(title ?? "").trim().length > 0
            )
            .map(([id, title]) => ({
                id,
                title: fuzzysort.prepare(String(title)),
                ref: { metadata: { title: String(title) } },
            }));

        window.hasInitedFuzzysort = true;
        window.fuzzysortIndexSourceSize = entries.length;
    };

    const exitSearch = () => {
        divCenter.classList.add("hidden");

        if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = null;
        inputElement.value = "";

        const inputElementCopy = inputElement.cloneNode(true);
        inputElement.replaceWith(inputElementCopy);

        renderJson(window.globalNames);
    };

    divCenter.classList.toggle("hidden");

    const isHidden = divCenter.classList.contains("hidden");

    if (isHidden) {
        exitSearch();
        return;
    }

    if (!isHidden) {
        inputElement.focus();
        inputElement.value = "";

        main.innerHTML = `<i class="search-mesh">(please add query)</i>`;

        const runSearch = () => {
            const query = String(inputElement.value ?? "");
            const trimmed = query.trim();

            if (trimmed.length === 0) {
                main.innerHTML = `<i class="search-mesh">(please add query)</i>`;
                return;
            }

            ensureFuzzysortIndex();

            const results = fuzzysort.go(trimmed, window.fuzzysortIndex, {
                key: "title",
                threshold: -1000,
                limit: 500
            });

            const outputJson = {};
            const orderedIds = [];
            const highlightMap = new Map();

            for (const r of results) {
                const id = String(r.obj.id);
                orderedIds.push(id);
                highlightMap.set(id, r.indexes);
                outputJson[id] = r.obj.ref;
            }

            if (Object.keys(outputJson).length === 0) {
                main.innerHTML = `<i class="search-mesh">(no results)</i>`;
                return;
            }

            renderJson(outputJson, { orderedIds, highlightMap });
        };

        inputElement.addEventListener("input", () => {
            if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
            searchDebounceTimeout = setTimeout(runSearch, 50);
        });

        inputElement.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                exitSearch();
            }
        });
    }
});
