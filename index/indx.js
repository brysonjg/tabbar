window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "saveQuit") return;
    closeSelf();
});

window.onload = async () => {
    await fixThemeOverSettable(); // correct themedge
    await fixThemeOverSettable("chungus"); // import more themedge

    window.gjson = await getGlobalJson();

    renederJson(window.gjson);

    setTimeout(updateActionButtonPosition, 0);
    setTimeout(addToolbarListeners, 0);

    window.hasInitedFuzzysort = false;
    window.fuzzysortIndex = null;
};

window.onresize = updateActionButtonPosition;

function hasVerticalScrollbar(element) {
    return element.scrollHeight > element.clientHeight;
}

function updateActionButtonPosition() {
    const main = document.querySelector('main');
    const actionRow = document.querySelector('div.icon-actions');

    if (!main || !actionRow) return;

    if (hasVerticalScrollbar(main)) {
        actionRow.style.right = '15px';
    } else {
        actionRow.style.right = '0';
    }
}

function updateMarginBarPosition() {
    const main = document.querySelector('main');
    const bar = document.querySelector('body > div.margin-bar');

    if (!main || !bar) return;

    if (hasVerticalScrollbar(main)) {
        bar.classList.add("scrollbar")
    } else {
        bar.classList.remove("scrollbar")
    }
}

function renederJson(
    json,
    container = document.getElementById("master-index-content-container")
) {
    Object.keys(json).reverse().forEach((id) => {
        if (id < 100) {
            return;
        }

        // Get the title from the JSON structure
        const title = json[id]?.metadata?.title || "Untitled";

        // Append the item
        container.innerHTML += `
            <div class="op-container">
                <img class="actionBtn" src="../icons/purgeTFM.svg" data-id="${id}">
                <img class="actionBtn" src="../icons/document-edit.svg" data-id="${id}">
                <div class="openAble" data-id="${id}">${title}</div>
            </div>
        `;
    });

    setResetEventListeners(json, container)
}

function setResetEventListeners(json, container) {

    container.querySelectorAll("*").forEach((element) => {
        const clone = element.cloneNode(true);
        element.parentNode.replaceChild(clone, element);
    });

    document.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });

    document.querySelectorAll(".openAble").forEach((element) => {
        element.addEventListener("click", () => {
            const id = element.dataset.id;
            makeNewTabWithID(id);
        });
    });

    document.querySelectorAll(".actionBtn").forEach((element) => {
        if (element.getAttribute("src") === "../icons/purgeTFM.svg") {
            element.addEventListener("click", () => {
                purgeTabMemory(element.dataset.id);
                element.parentNode.remove();
            });
        }

        else if (element.getAttribute("src") === "../icons/document-edit.svg") {
            element.addEventListener("click", () => {
                const parent = element.parentNode;
                const openAble = parent.querySelector("div.openAble");
                if (!openAble) return;

                const id = element.dataset.id;
                let title = json[id]?.metadata?.title || "Untitled";

                // Remove the div
                parent.removeChild(openAble);

                // Create input
                const input = document.createElement("input");
                input.className = "openAble";
                input.value = title;
                input.type = "text";

                // Helper to create the div again
                function createOpenAbleDiv(val) {
                    const newDiv = document.createElement("div");
                    newDiv.className = "openAble";
                    newDiv.dataset.id = id;
                    newDiv.textContent = val;

                    // Add click handler for purging
                    newDiv.addEventListener("click", () => {
                        purgeTabMemory(id);
                        newDiv.parentNode.remove();
                    });

                    // Re-add edit handler so user can edit again
                    newDiv.addEventListener("dblclick", () => {
                        element.click();
                    });

                    parent.appendChild(newDiv);
                }

                input.addEventListener("input", async (e) => {
                    if (e.key === "Enter") {
                        await chTitleOfTab(id, input.value); // make sure title updates
                        json = await getGlobalJson();

                        input.remove();
                        createOpenAbleDiv(input.value);
                    } else if (e.key === "Escape") {
                        input.remove();
                        createOpenAbleDiv(title);
                    }
                });

                parent.appendChild(input);
                input.focus();
                input.select();
            });
        }
    });
}

function addToolbarListeners() {
    if (document.querySelector("body > div.margin-bar")) return;

    document.querySelector("img.tool-bar-action#searchInit")
        .addEventListener("click", () => {
            const bar = document.createElement("div");
            bar.classList.add("margin-bar");
            bar.innerHTML = `
                <img src="../icons/close-file.svg" id="exit-bar" title="close search">
                <input class="search" value="">
                <img src="../icons/regular-expession.svg">
                <img src="../icons/case-sensitive.svg">
                <img src="../icons/keywords.svg">
            `;
            document.body.appendChild(bar);

            const body = document.createElement("div");
            body.classList.add("search-resalts");
            body.innerHTML = `
                <i>(please add query)</i>
            `;
            document.body.appendChild(body);

            document.querySelector("body > div.margin-bar > img#exit-bar")
                .addEventListener("click", () => {
                    document.querySelector("body > div.margin-bar")
                        .classList.add("exiting");

                    setTimeout(() => {
                        document.querySelector("body > div.margin-bar").remove();
                    }, 150);


                    document.querySelector("body > div.search-resalts")
                        .classList.add("exiting");

                    setTimeout(() => {
                        document.querySelector("body > div.search-resalts").remove();
                    }, 150);
                });

            document.querySelector("body > div.margin-bar > input.search")
                .addEventListener("input", () => {
                    updateSearchResualts(
                        document.querySelector("body > div.margin-bar > input.search").value
                    );
                });

            document.querySelector("body > div.margin-bar > input.search").focus();
    });
}

function updateSearchResualts(query) {
    const searchResalts = document.querySelector("body > div.search-resalts");
    if (!searchResalts) return;

    if (query === "") {
        searchResalts.innerHTML = "<i>(please add query)</i>";
        return;
    }

    // One-time fuzzysort index init
    if (!window.hasInitedFuzzysort) {
        window.fuzzysortIndex = Object.entries(window.gjson)
            .filter(([id, value]) =>
                Number(id) >= 100 &&
                value?.metadata?.title
            )
            .map(([id, value]) => ({
                id,
                title: value.metadata.title,
                ref: value
            }));

        window.hasInitedFuzzysort = true;
    }

    const results = fuzzysort.go(query, window.fuzzysortIndex, {
        key: "title",
        threshold: -1000,
        limit: 500
    });

    // Best matches last
    results.reverse();

    const outputJson = {};
    for (const r of results) {
        outputJson[r.obj.id] = r.obj.ref;
    }

    if (Object.keys(outputJson).length == 0) {
        searchResalts.innerHTML = "<i>(no resualts)</i>";
        return;
    }

    console.log(outputJson)

    searchResalts.innerHTML = "";
    renederJson(outputJson, searchResalts);
}

window.onclick = updateActionButtonPosition;
