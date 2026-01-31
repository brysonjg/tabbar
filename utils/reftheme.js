async function loadGoogleFontForThemingSettables(fontName) {
    const formatted = fontName.replace(/ /g, "+");
    const url = `https://fonts.googleapis.com/css2?family=${formatted}:wght@400;700&display=swap`;

    if ([...document.fonts].some(font => font.family === fontName)) {
        return true;
    }

    try {
        const res = await fetch(url);

        if (!res.ok) {
            console.warn(`Font "${fontName}" not found on Google Fonts.`);
            return false;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url;

        document.head.appendChild(link);

        await document.fonts.load(`1rem "${fontName}"`);

        return true;

    } catch (err) {
        console.error("Font loading error:", err);
        return false;
    }
}

async function fixThemeOverSettable(name = null) {
  try {
    const settables = await getSettablesAsJson();
    if (settables && settables.theme) {

      const file = location.pathname.split("/").pop().split(".")[0];

      const vars =
        settables.theme[name] ||
        settables.theme[file] ||
        settables.theme.master;

      if (vars) {
        for (const key in vars) {
          if (!key) continue;
          document.documentElement.style.setProperty(
            `--${key.trim()}`,
            vars[key]
          );
        }
      }
    }
  } catch (e) {
    console.warn("fixThemeOverSettable error:", e);
  }

  try {
    let settables = await getSettablesAsJson();
    // fall back to reading from localStorage if parent doesn't respond
    if (!settables) {
      try {
        const raw = localStorage.getItem('ChatJson');
        if (raw) {
          const json = JSON.parse(raw) || {};
          settables = json[7] || null;
        }
      } catch (e) {
        console.warn('local fallback parse error', e);
      }
    }

    if (settables && settables.font) {
      loadGoogleFontForThemingSettables(settables.font.font);
      document.documentElement.style.setProperty(
        `--font`,
        settables.font.font || "font"
      );
    }
  } catch (e) {
    console.warn("fixThemeOverSettable font error:", e);
  }
}

async function fixThemeSchemaAtTopLeval() {
    let jsonStore = localStorage.getItem("ChatJson");
    if (!jsonStore) {
        jsonStore = "{}";
        localStorage.setItem("ChatJson", jsonStore);
    }

    let json;
    try {
        json = JSON.parse(jsonStore);
    } catch {
        console.warn("Invalid ChatJson");
        return;
    }

    try {
        if (!json[7] || !json[7].theme || !json[7].theme.master) return;

        const vars = json[7].theme.master;

        Object.keys(vars).forEach(themeVar => {
            document.documentElement.style.setProperty(
                `--${themeVar.trim()}`,
                vars[themeVar]
            );
        });
    } catch (e) {
        console.warn("Top-level theme error:", e);
    }

    try {
        if (!json[7] || !json[7].font || !json[7].font.font) return;
        const fontName = json[7].font.font;

        await loadGoogleFontForThemingSettables(fontName);

        document.documentElement.style.setProperty(`--font`, fontName);
    } catch (e) {
        console.warn("Top-level font error:", e);
    }
}

function makeIconsAcordingToIconPack(ipack = {}) {
  let observer = new MutationObserver( async () => {
    document.querySelectorAll("img").forEach(
      (element) => {
        element.scr = ipack[element.scr] || element.scr;
        console.log(element)
      }
    );
  });

  observer.observe(document.body, {
      childList: true,
      subtree: true,
  });
}

// document.addEventListener("DOMContentLoaded", () => {
//   makeIconsAcordingToIconPack(ipack);
// })
