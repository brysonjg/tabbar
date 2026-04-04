async function loadGoogleFontForThemingSettables(fontName) {
    const formatted = fontName.replace(/ /g, "+");
    const url = `https://fonts.googleapis.com/css2?family=${formatted}:wght@400;700&display=swap`;

    if (fontName === "font") {
        // the font is default
        return true;
    }

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

const THEME_STORAGE_KEY = "__tabbar_theme_master";
const THEME_FONT_STORAGE_KEY = "__tabbar_theme_font";

async function fixThemeOverSettable(name = null) {
  try {
    const stylesRoot = document.documentElement;
    const styles = getComputedStyle(stylesRoot);
    const customProps = Object.keys(styles).filter(key =>
      typeof styles[key] === 'string' &&
      styles[key].startsWith('--versioning-graph-')
    );

    customProps.forEach(prop => {
      stylesRoot.style.removeProperty(prop);
    });
  } catch {
    console.warn("fixThemeOverSettable gitgraph style removal error:", e);
  }

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
    if (!settables) {
      try {
        await localDB.ensureOpen();
        settables = await localDB.getSettables();
      } catch (e) {
        console.warn("local fallback getSettables error", e);
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

// Always get settables from IndexedDB to match the scripts.js / localDB flow.
async function fixThemeSchemaAtTopLevel() {
    let settables;
    try {
        await localDB.ensureOpen();
        settables = await localDB.getSettables();
    } catch (e) {
        console.warn("fixThemeSchemaAtTopLevel: Failed to get settables from localDB", e);
        return;
    }

    try {
        if (!settables || !settables.theme || !settables.theme.master) return;

        const vars = settables.theme.master;

        Object.keys(vars).forEach(themeVar => {
            document.documentElement.style.setProperty(
                `--${themeVar.trim()}`,
                vars[themeVar]
            );
        });
        try {
            localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(vars));
        } catch (err) {
            console.warn("fixThemeSchemaAtTopLevel: Unable to cache theme vars", err);
        }
    } catch (e) {
        console.warn("Top-level theme error:", e);
    }

    try {
        if (!settables || !settables.font || !settables.font.font) return;
        const fontName = settables.font.font;

        await loadGoogleFontForThemingSettables(fontName);

        document.documentElement.style.setProperty(`--font`, fontName);
        try {
            localStorage.setItem(THEME_FONT_STORAGE_KEY, fontName);
        } catch (err) {
            console.warn("fixThemeSchemaAtTopLevel: Unable to cache theme font", err);
        }
    } catch (e) {
        console.warn("Top-level font error:", e);
    }

    if (!settables || !settables.theme || !settables.theme.master) {
        try {
            localStorage.removeItem(THEME_STORAGE_KEY);
        } catch (ignore) {}
    }

    if (!settables || !settables.font || !settables.font.font) {
        try {
            localStorage.removeItem(THEME_FONT_STORAGE_KEY);
        } catch (ignore) {}
    }
}

async function getIconPackage() {
  const isTopLevel = window.top === window;
  let settingsJson = null;

  if (isTopLevel) {
    try {
      await localDB.ensureOpen();
      settingsJson = await localDB.getSettables();
    } catch (err) {
      console.warn("getIconPackage getSettables failed:", err);
      return {};
    }
  } else {
    settingsJson = await getSettablesAsJson();
    if (settingsJson === null) return {};
  }

  if (!settingsJson) return {};
  return settingsJson.ipack || {};
}

function normalizeIconPath(value) {
  if (!value || typeof value !== "string") return "";
  const sanitized = value.replace(/\\/g, "/").split(/[?#]/)[0];

  try {
    const resolved = new URL(sanitized, document.baseURI);
    return resolved.pathname.replace(/^\/+/, "");
  } catch {
    return sanitized.replace(/^(?:\.\.\/|\.\/)+/, "").replace(/^\/+/, "");
  }
}
