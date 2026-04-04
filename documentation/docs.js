
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
        await fixThemeOverSettable("chungus");
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

    pageBar.addEventListener("wheel", (event) => {
        event.preventDefault();
        if (doDenyTabScroll()) return;

        const activeMenu = document.querySelector('.menu.active');
        const menus = Array.from(document.querySelectorAll('.menu'));

        if (!activeMenu) return;
        if (menus.length <= 1) return;

        let currentMenuIndex = menus.indexOf(activeMenu);
        currentMenuIndex += event.deltaY / Math.abs(event.deltaY);
        currentMenuIndex += menus.length;
        currentMenuIndex %= menus.length;

        const nextMenu = menus[currentMenuIndex];
        if (!nextMenu) return;

        nextMenu.click();
    }, { passive: false });

    const firstMenu = pageBar.querySelector(".menu");
    firstMenu.classList.add("active");

    const fileOfActivePage = firstMenu.dataset.file;
    loadMarkdownDocsFile(fileOfActivePage);

    setTimeout(() => {
        let markdown = translateMDtoHTMLDecoupled(window.content);
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
                let markdown = translateMDtoHTMLDecoupled(window.content);
                document.querySelector("div.content-major > div.content")
                    .innerHTML = markdown;
                batUpdateRules();
            }, 10);
        });
    });

    const loadFirstMenu = () => {
        const file = firstMenu.dataset.file;
        loadMarkdownDocsFile(file);

        setTimeout(() => {
            if (window.content) {
                let markdown = translateMDtoHTMLDecoupled(window.content);
                document.querySelector("div.content-major > div.content")
                    .innerHTML = markdown;
                batUpdateRules();
            }
            else {
                loadFirstMenu();
            }
        }, 2);
    };
    loadFirstMenu();
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
