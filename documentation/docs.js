
window.addEventListener("message", async (event) => {
    if (event.data && event.data.type === "saveQuit") {
        const localJson = await getLocalJson() || {};
        localJson.menuhandle = null;
        setLocalJson(localJson);
        closeSelf();
    }
});

async function initDocsPage() {
    try {
        await fixThemeOverSettable("settings");
        await fixThemeOverSettable("prism");
        makePagebarAccurate();
    } catch (error) {
        console.error("Failed to initialize docs page", error);
    }
}

document.addEventListener("contextmenu", (event) => {
     event.preventDefault();
});

function makePagebarAccurate() {
    const pageBar = document.querySelector(".menu-side-bar");

    window.pagedefs.forEach((def) => {
        if (def.type === "page") {
            const div = document.createElement("div");
            div.classList.add("menu");
            div.textContent = def.name;
            div.dataset.file = def.file;
            pageBar.appendChild(div);
        }
        else if (def.type === "break") {
            const hr = document.createElement("hr");
            pageBar.appendChild(hr);
        }
    });

    const firstMenu = pageBar.querySelector(".menu");
    firstMenu.classList.add("active");

    const fileOfActivePage = firstMenu.dataset.file;
    loadMarkdownDocsFile(fileOfActivePage);

    setTimeout(() => {
        let markdown = translateMDtoHTMLDecupled(window.content);
        document.querySelector("div.content-major > div.content")
        .innerHTML = markdown;
        batUpdateRules();
    }, 10);

    const allMenus = pageBar.querySelectorAll(".menu");

    allMenus.forEach((element) => {
        element.addEventListener("click", () => {
            if (element.classList.contains("active")) return;

            pageBar.querySelectorAll(".menu.active").forEach((el) => {
                el.classList.remove("active");
            });

            element.classList.add("active");

            const file = element.dataset.file;
            loadMarkdownDocsFile(file);

            setTimeout(() => {
                let markdown = translateMDtoHTMLDecupled(window.content);
                document.querySelector("div.content-major > div.content")
                    .innerHTML = markdown;
                batUpdateRules();
            }, 10);
        });
    });
}

async function loadMarkdownDocsFile(file) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `./docs/${file}`;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${file}`));
        document.head.appendChild(script);
    });
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initDocsPage, { once: true });
} else {
    initDocsPage();
}
