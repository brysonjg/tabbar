window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "saveQuit") {
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
window.addEventListener("message", (event) => {
    if (event.source === iframe.contentWindow) return;

    if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(event.data, "*");
    }
});


window.onload = async () => {
    await fixThemeOverSettable("settings");
}

document.querySelectorAll(".menu").forEach( (element) => {
    element.addEventListener("mousedown", () => {
        document.querySelectorAll(".menu").forEach( (element2) => {
            element2.classList.remove("active");
        });

        element.classList.add("active");

        iframe.src = element.dataset.url;
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
