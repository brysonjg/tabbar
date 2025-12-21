let isClosing = false;

window.addEventListener("message", async (event) => {
    if (event.data && event.data.type === "saveQuit") {
        isClosing = true;
        // Clear menu handle on close
        const localJson = await getLocalJson() || {};
        localJson.menuhandle = null;
        setLocalJson(localJson);
        closeSelf();
    }

    if (event.source !== window.parent) {
        if (event.data?.type === "updtTheme") {
            setTimeout( async () => {
                await fixThemeOverSettable("settings");
            }, 35)
        }

        window.parent.postMessage(event.data, "*");
    }
});

const iframe = document.getElementById("menuIFrame");

// Handle messages from the iframe (like naviiframe for navigation)
window.addEventListener("message", (event) => {
    // Handle naviiframe messages from child iframes
    if (event.source === iframe.contentWindow && event.data?.type === "naviiframe") {
        const url = event.data.url;
        if (url) {
            iframe.src = url;
            // Save state when iframe navigates
            saveMenuState();
        }
        return;
    }
    
    if (event.source === iframe.contentWindow) return;

    if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(event.data, "*");
    }
});

async function saveMenuState() {
    if (isClosing) return; // Don't save if we're closing
    
    const activeMenu = document.querySelector('.menu.active');
    if (!activeMenu) return;
    
    const allMenus = Array.from(document.querySelectorAll('.menu'));
    const menuIndex = allMenus.indexOf(activeMenu);
    
    if (menuIndex === -1) return;
    
    const localJson = await getLocalJson() || {};
    localJson.menuhandle = {
        menuelement: menuIndex,
        iframeurl: iframe.src
    };
    setLocalJson(localJson);
}

async function restoreMenuState() {
    const localJson = await getLocalJson() || {};
    if (!localJson.menuhandle) return;
    
    const { menuelement, iframeurl } = localJson.menuhandle;
    if (typeof menuelement !== 'number' || !iframeurl) return;
    
    const allMenus = Array.from(document.querySelectorAll('.menu'));
    if (menuelement >= 0 && menuelement < allMenus.length) {
        // Remove active from all menus
        document.querySelectorAll(".menu").forEach((element) => {
            element.classList.remove("active");
        });
        
        // Set the saved menu as active
        const targetMenu = allMenus[menuelement];
        if (targetMenu) {
            targetMenu.classList.add("active");
            iframe.src = iframeurl;
        }
    }
}

window.onload = async () => {
    await fixThemeOverSettable("settings");
    await restoreMenuState();
}

// Save menu state when tab becomes hidden (user switches tabs)
document.addEventListener("visibilitychange", () => {
    if (document.hidden && !isClosing) {
        saveMenuState();
    }
});

document.querySelectorAll(".menu").forEach( (element) => {
    element.addEventListener("mousedown", () => {
        document.querySelectorAll(".menu").forEach( (element2) => {
            element2.classList.remove("active");
        });

        element.classList.add("active");

        iframe.src = element.dataset.url;
        
        // Save state when menu changes
        saveMenuState();
    });
});

document.addEventListener("contextmenu", (event) => {
     event.preventDefault();
});

const sidebar = document.querySelector('.menu-side-bar');
const menus = document.querySelectorAll('.menu');

function adjustMenuWidth() {
    const scrollbarVisible = sidebar.scrollHeight > sidebar.clientHeight;
    menus.forEach(menu => {
        menu.style.width = scrollbarVisible ? 'calc(100% - 5px)' : 'calc(100% - 7px)';
    });
}

adjustMenuWidth();
window.addEventListener('resize', adjustMenuWidth);

sidebar.addEventListener("wheel", (event) => {
    event.preventDefault();
    const activeMenu = document.querySelector('.menu.active');

    let allMenus = Array.from(document.querySelectorAll('.menu'));
    let currentIndex = allMenus.indexOf(activeMenu);
    currentIndex += event.deltaY / Math.abs(event.deltaY);
    currentIndex += allMenus.length;
    currentIndex %= allMenus.length;

    const targetMenu = allMenus[currentIndex];
    if (targetMenu) {
        document.querySelectorAll(".menu").forEach((element2) => {
            element2.classList.remove("active");
        });
        targetMenu.classList.add("active");
        iframe.src = targetMenu.dataset.url;
        
        // Save state when menu changes via wheel
        saveMenuState();
    }
}, { passive: false });
