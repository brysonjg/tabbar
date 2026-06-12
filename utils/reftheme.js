const DEFAULT_FONT = "sourceCodePro";

const LOCAL_FONT_FAMILIES = [
    { name: "Bitter", title: "Bitter", regular: "Bitter.ttf", italic: "Bitter-Italic.ttf" },
    { name: "ComicNeue", title: "Comic Neue", regular: "ComicNeue.ttf", italic: "ComicNeue-Italic.ttf" },
    { name: "Inter", title: "Inter", regular: "Inter.ttf", italic: "Inter-Italic.ttf" },
    { name: "JacquardaBastard", title: "Jacquarda Bastard", regular: "JacquardaBastard.ttf", italic: "none" },
    { name: "JetBrainsMono", title: "Jet Brains Mono", regular: "JetBrainsMono.ttf", italic: "JetBrainsMono-Italic.ttf" },
    { name: "Lora", title: "Lora", regular: "Lora.ttf", italic: "Lora-Italic.ttf" },
    { name: "MozillaText", title: "Mozilla Text", regular: "MozillaText.ttf", italic: "none" },
    { name: "NovaScript", title: "Nova Script", regular: "NovaScript-Regular.ttf", italic: "none" },
    { name: "Oswald", title: "Oswald", regular: "Oswald.ttf", italic: "none" },
    { name: "Poppins", title: "Poppins", regular: "Poppins.ttf", italic: "Poppins-Italic.ttf" },
    { name: "Raleway", title: "Raleway", regular: "Raleway.ttf", italic: "Raleway-Italic.ttf" },
    { name: "RedactedScript", title: "Redacted Script", regular: "RedactedScript.ttf", italic: "none" },
    { name: "SourceCodePro", title: "Source Code Pro", regular: "SourceCodePro.ttf", italic: "SourceCodePro-Italic.ttf" },
    { name: "SourceSans3", title: "Source Sans 3", regular: "SourceSans3.ttf", italic: "none" },
    { name: "SpaceGrotesk", title: "Space Grotesk", regular: "SpaceGrotesk.ttf", italic: "none" },
];

let fontBaseUrl;

function getFontBaseUrl() {
    if (fontBaseUrl) {
        return fontBaseUrl;
    }

    const script =
        document.currentScript ||
        [...document.scripts].find((entry) => /reftheme\.js(?:\?|$)/.test(entry.src));

    if (script?.src) {
        fontBaseUrl = new URL("../font/", script.src).href;
        return fontBaseUrl;
    }

    if (location.pathname.includes("/settings/menus/")) {
        fontBaseUrl = new URL("../../font/", location.href).href;
    } else if (/\/(chungus|documentation|index)\//.test(location.pathname)) {
        fontBaseUrl = new URL("../font/", location.href).href;
    } else {
        fontBaseUrl = new URL("./font/", location.href).href;
    }

    return fontBaseUrl;
}

function normalizeFontName(fontName) {
    if (!fontName || fontName === "font") {
        return DEFAULT_FONT;
    }
    return fontName;
}

function getLocalFontFamily(fontName) {
    const name = normalizeFontName(fontName);
    return LOCAL_FONT_FAMILIES.find((family) => family.name === name) || null;
}

function getLocalFontFamilies() {
    return LOCAL_FONT_FAMILIES.slice();
}

function buildLocalFontFaceCss(family) {
    const rules = [];
    const familyName = family.name.replace(/'/g, "\\'");

    if (family.regular) {
        rules.push(
            `@font-face {`,
            `    font-family: '${familyName}';`,
            `    src: url('${new URL(family.regular, getFontBaseUrl()).href}') format('truetype');`,
            `    font-weight: normal;`,
            `    font-style: normal;`,
            `}`
        );
    }

    if (family.italic && family.italic !== "none") {
        rules.push(
            `@font-face {`,
            `    font-family: '${familyName}';`,
            `    src: url('${new URL(family.italic, getFontBaseUrl()).href}') format('truetype');`,
            `    font-weight: normal;`,
            `    font-style: italic;`,
            `}`
        );
    }

    return rules.join("\n");
}

function injectLocalFontFaces(fontName) {
    const family = getLocalFontFamily(fontName);
    if (!family) {
        return null;
    }

    const normalized = family.name;
    const marker = `data-local-font="${normalized}"`;
    if (document.querySelector(`style[${marker}]`)) {
        return family;
    }

    const style = document.createElement("style");
    style.setAttribute("data-local-font", normalized);
    style.textContent = buildLocalFontFaceCss(family);
    document.head.appendChild(style);

    return family;
}

async function loadFontForThemingSettables(fontName) {
    const normalized = normalizeFontName(fontName);

    if (normalized === DEFAULT_FONT) {
        return true;
    }

    const family = injectLocalFontFaces(normalized);
    if (!family) {
        console.warn(`Font "${fontName}" not found in local font directory.`);
        return false;
    }

    try {
        await document.fonts.load(`1rem "${family.name}"`);
        if (family.italic) {
            await document.fonts.load(`italic 1rem "${family.name}"`);
        }
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
  } catch (e) {
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
      const fontName = normalizeFontName(settables.font.font);
      await loadFontForThemingSettables(fontName);
      document.documentElement.style.setProperty(
        `--font`,
        fontName
      );
    }
  } catch (e) {
    console.warn("fixThemeOverSettable font error:", e);
  }
}


async function applyThemeAtTopLevel(settables) {
    const theme = settables?.theme?.master;
    if (!theme) return;

    for (const key in theme) {
        document.documentElement.style.setProperty(`--${key.trim()}`, theme[key]);
    }

    try {
        localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch (e) {
        console.warn("theme cache failed", e);
    }
}

async function applyFontAtTopLevel(settables) {
    const fontNameRaw = settables?.font?.font;
    if (!fontNameRaw) return;

    const fontName = normalizeFontName(fontNameRaw);

    await loadFontForThemingSettables(fontName);

    document.documentElement.style.setProperty(`--font`, fontName);

    try {
        localStorage.setItem(THEME_FONT_STORAGE_KEY, fontName);
    } catch (e) {
        console.warn("font cache failed", e);
    }
}

async function fixThemeSchemaAtTopLevel() {
    let settables;
    try {
        await localDB.ensureOpen();
        settables = await localDB.getSettables();
    } catch (e) {
        console.warn("fixThemeSchemaAtTopLevel: Failed to get settables from localDB", e);
        return;
    }

    await applyThemeAtTopLevel(settables);
    await applyFontAtTopLevel(settables);

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
