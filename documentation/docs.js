
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
        await makePagebarAccurate();
    } catch (error) {
        console.error("Failed to initialize docs page", error);
    }
}

document.addEventListener("contextmenu", (event) => {
     event.preventDefault();
});

function getContentContainer() {
    return document.querySelector("div.content-major > div.content");
}

async function renderPage(file) {
    const content = getContentContainer();
    if (!content) return;

    try {
        await loadMarkdownDocsFile(file);
        const md = typeof window.content === "string" ? window.content : "";
        content.innerHTML = translateMDtoHTMLDecoupled(md);
        await batUpdateRules();
    } catch (error) {
        console.error("Failed to load docs page", file, error);
        const fallback = `# Page failed to load\n\nTried to load: \`${String(file)}\`\n\n- Make sure the file exists in \`documentation/docs/\`.\n- Check the browser console for the underlying error.\n`;
        content.innerHTML = translateMDtoHTMLDecoupled(fallback);
        await batUpdateRules();
    }
}

async function makePagebarAccurate() {
    const pageBar = document.querySelector(".menu-side-bar");
    if (!pageBar) return;

    // Avoid duplicating menus if this is ever called twice.
    pageBar.innerHTML = "";

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
    if (!firstMenu) return;
    firstMenu.classList.add("active");

    const allMenus = pageBar.querySelectorAll(".menu");

    allMenus.forEach((element) => {
        element.addEventListener("click", async () => {
            if (element.classList.contains("active")) return;

            pageBar.querySelectorAll(".menu.active").forEach((el) => {
                el.classList.remove("active");
            });

            element.classList.add("active");

            const file = element.dataset.file;
            await renderPage(file);
        });
    });

    await renderPage(firstMenu.dataset.file);
}

async function loadMarkdownDocsFile(file) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-docs-page="true"]');
        if (existing) existing.remove();

        const script = document.createElement('script');
        script.dataset.docsPage = "true";
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
