let selectedList = [];
let activeRename = null;

window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "saveQuit") return;
    closeSelf();
});

window.onload = async () => {
    await fixThemeOverSettable("chungus");
    await fixThemeOverSettable("master");
    await fixThemeOverSettable();

    window.gjson = await getGlobalJson();

    renderJson(window.gjson);
    requestAnimationFrame(updateScrollbarState);
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

function renderJson(json) {
    const main = document.querySelector("main");
    const keys = Object.keys(json).filter((key) => String(key).length > 2);

    keys.reverse().forEach((key) => {
        const div = document.createElement("div");
        let name;
        try {
            name = json[key].metadata.title;
        }
        catch {
            name = "Untitled";
        }

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

        setRowText(div, name);

        const selectImg = div.querySelector("img#selectImage");
        selectImg.dataset.selected = "false";

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
            purgeTabMemory(div.dataset.id);
            div.remove();
            try {
                const index = selectedList.indexOf(div.dataset.id);
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

    requestAnimationFrame(updateScrollbarState);
}

function normalizeTitle(title) {
    const normalized = String(title ?? "").trim();
    return normalized.length ? normalized : "Untitled";
}

function setRowText(rowDiv, title) {
    const existingText = rowDiv.querySelector("div.text");
    const newText = document.createElement("div");
    newText.classList.add("text");
    newText.textContent = normalizeTitle(title);
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
    submitImg.src = "../icons/submittitle.svg";
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

    if (selectedList.length === 0) {
        btn.src = "../icons/selectall.svg";
        btn.setAttribute("title", "select all");
    }
    else if (selectedList.length === document.querySelectorAll("div.selectable").length) {
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

    if (selectedList.length === 0) {
        menu.innerHTML =
            `
                <div class="menu-action" data-action="select">Select All</div>
            `
        ;
    }
    else if (selectedList.length === document.querySelectorAll("div.selectable").length) {
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

    if (selectedList.length === 0) {
        const selectabes = document.querySelectorAll("div.selectable:has(img.action:not([src=\"../icons/select-active.svg\"]))");

        selectabes.forEach((element) => {
            selectedList.push(element.dataset.id);
            const selectImg = element.querySelector("img.action");
            selectImg.dataset.selected = "true";
            selectImg.src = "../icons/select-active.svg";
        });

        updateSelectAllButtonImage();
    }
    else if (selectedList.length === document.querySelectorAll("div.selectable").length) {
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
        }
    });
    selectedList = [];

    updateSelectAllButtonImage();
});

document.getElementById("search-btn").addEventListener("click", (event) => {
    const divCenter = document.querySelector("div.std-action-bar > div.center");
    divCenter.classList.toggle("hidden");

    const isHidden = divCenter.classList.contains("hidden");
    const inputElement = divCenter.querySelector("input.search");

    if (!isHidden) {
        inputElement.focus();
    } else {
        inputElement.value = "";
    }
});
