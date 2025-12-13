window.addEventListener("message", (event) => {
    if (!event.data || event.data.type !== "saveQuit") return;
    closeSelf();
});

window.onload = async () => {
    await fixThemeOverSettable(); // correct themedge

    let json = await getGlobalJson();

    const container = document.getElementById("master-index-content-container");

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

                input.addEventListener("keydown", async (e) => {
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

    document.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });
};
