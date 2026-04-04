function getRandomPUAChars(count = 256) {
    const start = 0xE000;
    const end = 0xF8FF;
    const chars = [];

    for (let i = 0; i < count; i++) {
        const codePoint = start + Math.floor(Math.random() * (end - start + 1));
        chars.push(String.fromCharCode(codePoint));
    }

    return chars.join("");
}

function getMarkdownToken(index) {
    return getRandomPUAChars() + index + getRandomPUAChars();
}

function translateMDtoHTMLDecoupled(md) {
    const escapeHTML = (str) =>
        str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    const normalizeNewlines = (str) => str.replace(/\r\n?/g, "\n");

    const sanitizeURL = (rawUrl, allowHash = true) => {
        const value = rawUrl.trim();
        if (!value) return "";

        if (allowHash && value.startsWith("#")) return value;
        if (value.startsWith("/") || value.startsWith("./") || value.startsWith("../")) return value;

        try {
            const url = new URL(value, window.location.href);
            const protocol = url.protocol.toLowerCase();

            if (["http:", "https:", "mailto:", "tel:"].includes(protocol)) {
                return url.href;
            }
        } catch (e) {
            return "";
        }

        return "";
    };

    const escapeAttribute = (str) => str.replace(/'/g, "&#39;");
    const applyLineBreaks = (str) => str.replace(/\n/g, "<br>");

    const fencedCodeBlocks = new Map();
    const inlineCodeTokens = new Map();
    let fencedCodeIndex = 0;
    let inlineCodeIndex = 0;

    md = normalizeNewlines(md);
    md = escapeHTML(md);

    md = md.replace(/(^|\n)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)(?:\n\2(?=\n|$)|$)/g, (match, prefix, fence, info, code) => {
        const lang = (info || "").trim().split(/\s+/)[0] || "";
        const token = getMarkdownToken(fencedCodeIndex);
        fencedCodeIndex += 1;
        let safeLang = lang.replace(/[^\w#+-]/g, "");

        if (Prism && !(safeLang in Prism.languages)) {
            safeLang = "none";
        }

        fencedCodeBlocks.set(
            token,
            `<pre class="code"><div class='copy-btn'>Copy</div><code class='language-${safeLang}'>${code}</code></pre>`
        );

        return `${prefix}${token}`;
    });

    md = md.replace(/`([^`\n]+)`/g, (_, code) => {
        const token = getMarkdownToken("INLINECODE", inlineCodeIndex);
        inlineCodeIndex += 1;
        inlineCodeTokens.set(token, `<code>${code}</code>`);
        return token;
    });

    const lines = md.split("\n");

    const getIndentWidth = (line) => {
        let width = 0;

        for (const char of line.match(/^\s*/)[0]) {
            width += (char === "\t") ? 4 : 1;
        }

        return width;
    };

    const isBlank = (line) => line.trim() === "";
    const isCodeTokenLine = (line) => fencedCodeBlocks.has(line.trim());
    const isHorizontalRule = (line) => /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line);
    const parseHeading = (line) => line.match(/^ {0,3}(#{1,6})[ \t]*(.+?)\s*#*\s*$/);
    const isBlockquoteLine = (line) => /^ {0,3}&gt;(?:\s|$)/.test(line);
    const parseListMarker = (line) => {
        const match = line.match(/^(\s*)(?:(\d+)\.\s+|([*+-])\s+)(.*)$/);
        if (!match) return null;

        const indent = getIndentWidth(match[1]);
        const type = match[2] ? "ol" : "ul";

        return {
            indent,
            type,
            start: match[2] ? Number(match[2]) : null,
            content: match[4]
        };
    };

    const splitTableRow = (row) => {
        let trimmed = row.trim();
        if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
        if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
        return trimmed.split("|").map((cell) => cell.trim());
    };

    const parseTableAlignment = (separator) => {
        const cells = splitTableRow(separator);
        if (cells.length === 0) return null;

        const alignments = [];
        for (const cell of cells) {
            const normalized = cell.replace(/\s+/g, "");
            if (!/^:?-{2,}:?$/.test(normalized)) return null;
            if (normalized.startsWith(":") && normalized.endsWith(":")) alignments.push("center");
            else if (normalized.endsWith(":")) alignments.push("right");
            else if (normalized.startsWith(":")) alignments.push("left");
            else alignments.push("");
        }

        return alignments;
    };

    const processInline = (text) => {
        let output = text;

        output = output.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
            const safeUrl = sanitizeURL(url, false);
            if (!safeUrl) return `![${alt}](${url})`;

            const titleAttr = title ? ` title='${escapeAttribute(title)}'` : "";
            return `<img alt='${escapeAttribute(alt)}' src='${escapeAttribute(safeUrl)}'${titleAttr}>`;
        });

        output = output.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, url, title) => {
            const safeUrl = sanitizeURL(url, true);
            if (!safeUrl) return `[${label}](${url})`;

            const titleAttr = title ? ` title='${escapeAttribute(title)}'` : "";
            return `<a href='${escapeAttribute(safeUrl)}' target='_blank' rel='noopener noreferrer'${titleAttr}>${label}</a>`;
        });

        output = output.replace(/\\([\\`*_[\]{}()#+\-.!~^|])/g, "$1");
        output = output.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
        output = output.replace(/__(.+?)__/g, "<b>$1</b>");
        output = output.replace(/(^|[^*])\*(?!\s)(.+?)(?<!\s)\*/g, "$1<i>$2</i>");
        output = output.replace(/(^|[^_])_(?!\s)(.+?)(?<!\s)_/g, "$1<i>$2</i>");
        output = output.replace(/~~(.+?)~~/g, "<s>$1</s>");
        output = output.replace(/~(.+?)~/g, "<sub>$1</sub>");
        output = output.replace(/\^(.+?)\^/g, "<sup>$1</sup>");
        output = output.replace(/==(.+?)==/g, "<mark>$1</mark>");

        inlineCodeTokens.forEach((html, token) => {
            output = output.replaceAll(token, html);
        });

        return output;
    };

    const renderParagraph = (blockLines) => `<p>${applyLineBreaks(processInline(blockLines.join("\n").trim()))}</p>`;

    const renderTable = (tableLines) => {
        const tableLength = tableLines.length;

        if (tableLength < 2) return renderParagraph(tableLines);

        const alignments = parseTableAlignment(tableLines[1]);
        if (!alignments) return renderParagraph(tableLines);

        const headerCells = splitTableRow(tableLines[0]);
        if (headerCells.length !== alignments.length) return renderParagraph(tableLines);

        for (let line = 0; line < tableLength; line++) {
            tableLines[line] = tableLines[line].replace(/\\\\/g, "\uEFED\uE81D\uE17D")
            tableLines[line] = tableLines[line].replace(/\\\|/g, "\uF7ED\uF91B\uF2AB")
        }

        const bodyRows = tableLines.slice(2).map((line) => splitTableRow(line));

        const renderCells = (cells, tag) => cells.map((cell, index) => {
            const align = alignments[index] ? ` style="text-align: ${alignments[index]};"` : "";
            return `<${tag}${align}>${processInline(cell)}</${tag}>`;
        }).join("");

        let tableHTML = `
            <div class="tcontainer">
                <table>
                    <thead>
                        <tr>
                            ${renderCells(headerCells, "th")}
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRows.map((cells) => `<tr>${renderCells(cells, "td")}</tr>`).join("")}
                    </tbody>
                </table>
            </div>
        `;


        tableHTML = tableHTML.replace(/\uEFED\uE81D\uE17D/g, "\\")
        tableHTML = tableHTML.replace(/\uF7ED\uF91B\uF2AB/g, "\|")

        return tableHTML;
    };

    const renderList = (sourceLines, startIndex) => {
        const stack = [];
        let html = "";
        let index = startIndex;

        const closeItemUntil = (depth) => {
            while (stack.length > depth) {
                html += "</li>";
                const finished = stack.pop();
                html += `</${finished.type}>`;
            }
        };

        const closeOpenItemsAtOrAbove = (indent) => {
            while (stack.length && stack[stack.length - 1].indent > indent) {
                html += "</li>";
                html += `</${stack.pop().type}>`;
            }
        };

        while (index < sourceLines.length) {
            const line = sourceLines[index];
            const marker = parseListMarker(line);

            if (marker) {
                closeOpenItemsAtOrAbove(marker.indent);

                if (!stack.length || marker.indent > stack[stack.length - 1].indent) {
                    const attrs = (marker.type === "ol" && marker.start !== null && marker.start !== 1) ? ` start="${marker.start}"` : "";
                    html += `<${marker.type}${attrs}>`;
                    stack.push({ type: marker.type, indent: marker.indent });
                } else if (marker.indent === stack[stack.length - 1].indent && marker.type !== stack[stack.length - 1].type) {
                    html += "</li>";
                    html += `</${stack.pop().type}>`;
                    const attrs = (marker.type === "ol" && marker.start !== null && marker.start !== 1) ? ` start="${marker.start}"` : "";
                    html += `<${marker.type}${attrs}>`;
                    stack.push({ type: marker.type, indent: marker.indent });
                } else {
                    html += "</li>";
                }

                html += `<li>${processInline(marker.content)}`;
                index += 1;
                let pendingParagraphBreak = false;

                while (index < sourceLines.length) {
                    const nextLine = sourceLines[index];
                    if (isBlank(nextLine)) {
                        const lookahead = sourceLines.slice(index + 1).find((candidate) => !isBlank(candidate));
                        if (lookahead === undefined) {
                            index += 1;
                            break;
                        }

                        if (parseListMarker(lookahead)) {
                            index += 1;
                            break;
                        }

                        pendingParagraphBreak = true;
                        index += 1;
                        continue;
                    }

                    const nestedMarker = parseListMarker(nextLine);
                    if (nestedMarker) {
                        if (nestedMarker.indent > marker.indent) break;
                        break;
                    }

                    if (getIndentWidth(nextLine) > marker.indent) {
                        html += pendingParagraphBreak
                            ? `<br><br>${processInline(nextLine.trim())}`
                            : `<br>${processInline(nextLine.trim())}`;
                        pendingParagraphBreak = false;
                        index += 1;
                        continue;
                    }

                    break;
                }

                continue;
            }

            if (isBlank(line)) {
                const upcoming = sourceLines.slice(index + 1).find((candidate) => !isBlank(candidate));
                if (!upcoming || !parseListMarker(upcoming)) break;
                index += 1;
                continue;
            }

            break;
        }

        closeItemUntil(0);

        return { html, nextIndex: index };
    };

    const renderBlocks = (blockLines) => {
        const localLines = blockLines.slice();
        const html = [];
        let index = 0;

        while (index < localLines.length) {
            const line = localLines[index];

            if (isBlank(line)) {
                index += 1;
                continue;
            }

            if (isCodeTokenLine(line)) {
                html.push(fencedCodeBlocks.get(line.trim()));
                index += 1;
                continue;
            }

            if (isHorizontalRule(line)) {
                html.push("<hr>");
                index += 1;
                continue;
            }

            const heading = parseHeading(line);
            if (heading) {
                const headingSize = heading[1].length;
                html.push(`
                     <h${headingSize}>
                        ${processInline(heading[2].trim())}
                     </h${headingSize}>
                    `);
                index += 1;
                continue;
            }

            if (isBlockquoteLine(line)) {
                const quoteLines = [];

                while (index < localLines.length && (isBlockquoteLine(localLines[index]) || isBlank(localLines[index]))) {
                    if (isBlockquoteLine(localLines[index])) {
                        quoteLines.push(localLines[index].replace(/^ {0,3}&gt;\s?/, ""));
                    } else {
                        quoteLines.push("");
                    }
                    index += 1;
                }

                html.push(`<blockquote>${renderBlocks(quoteLines)}</blockquote>`);
                continue;
            }

            const listMarker = parseListMarker(line);
            if (listMarker) {
                const rendered = renderList(localLines, index);
                html.push(rendered.html);
                index = rendered.nextIndex;
                continue;
            }

            const tableStart = localLines.slice(index, index + 2);
            if (tableStart.length >= 2 && tableStart[0].includes("|") && parseTableAlignment(tableStart[1])) {
                const tableLines = [];
                while (index < localLines.length && !isBlank(localLines[index])) {
                    tableLines.push(localLines[index]);
                    index += 1;
                }
                html.push(renderTable(tableLines));
                continue;
            }

            const paragraphLines = [];
            while (index < localLines.length) {
                const current = localLines[index];
                if (isBlank(current) || isCodeTokenLine(current) || isHorizontalRule(current) || parseHeading(current) || isBlockquoteLine(current) || parseListMarker(current)) {
                    break;
                }
                const nextPair = localLines.slice(index, index + 2);
                if (nextPair.length >= 2 && nextPair[0].includes("|") && parseTableAlignment(nextPair[1])) break;
                paragraphLines.push(current);
                index += 1;
            }
            html.push(renderParagraph(paragraphLines));
        }

        return html.join("");
    };

    let html = renderBlocks(lines);

    inlineCodeTokens.forEach((codeHtml, token) => {
        html = html.replaceAll(token, codeHtml);
    });

    fencedCodeBlocks.forEach((blockHtml, token) => {
        html = html.replaceAll(token, blockHtml);
    });

    return html.trim();
}

let prismLoadPromise = null;

let copyButtonUpdateScheduled = false;
let visibleCopyButtons = new Set();
let copyButtonStates = new Map();
let copyButtonGlobalListenersAttached = false;
let copyButtonVisibilityObserver = null;
let copyButtonVisibilityMarginPx = 256;
let copyButtonObservedParents = new WeakMap();
let copyButtonUpdateSpeed = 20; // 20 milliseconds per fraim or about 50 fraims per second (good enough for this perpose)
let _copyButtonsDoCopyMarkdowns = false;

function ensureCopyButtonVisibilityObserver() {
    if (copyButtonVisibilityObserver) return copyButtonVisibilityObserver;
    if (typeof IntersectionObserver === "undefined") return null;

    copyButtonVisibilityObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            const button = copyButtonObservedParents.get(entry.target);
            if (!button) continue;

            if (entry.isIntersecting) {
                visibleCopyButtons.add(button);
            } else {
                visibleCopyButtons.delete(button);
            }
        }

        scheduleCopyButtonUpdate();
    }, {
        root: null,
        threshold: 0,
        rootMargin: `${copyButtonVisibilityMarginPx}px 0px ${copyButtonVisibilityMarginPx}px 0px`,
    });

    return copyButtonVisibilityObserver;
}

function scheduleCopyButtonUpdate() {
    if (copyButtonUpdateScheduled) return;
    copyButtonUpdateScheduled = true;

    requestAnimationFrame(() => {
        copyButtonUpdateScheduled = false;

        for (const element of copyButtonStates.keys()) {
            if (!document.contains(element)) {
                const state = copyButtonStates.get(element);
                if (state?.parentElement && copyButtonVisibilityObserver) {
                    copyButtonVisibilityObserver.unobserve(state.parentElement);
                    copyButtonObservedParents.delete(state.parentElement);
                }
                copyButtonStates.delete(element);
                visibleCopyButtons.delete(element);
            }
        }

        for (const element of visibleCopyButtons) {
            const state = copyButtonStates.get(element);
            if (!state) {
                visibleCopyButtons.delete(element);
                continue;
            }

            if (!document.contains(element)) {
                copyButtonStates.delete(element);
                visibleCopyButtons.delete(element);
                continue;
            }

            state.update();
        }
    });
}

function attachCopyButtonGlobalListeners() {
    if (copyButtonGlobalListenersAttached) return;
    copyButtonGlobalListenersAttached = true;

    window.addEventListener("wheel", scheduleCopyButtonUpdate, { passive: true });
    window.addEventListener("scroll", scheduleCopyButtonUpdate, { passive: true });
    window.addEventListener("resize", scheduleCopyButtonUpdate);

    setInterval(scheduleCopyButtonUpdate, 20);

    const observer = new MutationObserver(scheduleCopyButtonUpdate);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
}

function registerCopyButton(element) {
    if (copyButtonStates.has(element)) return;

    const parentElement = element.parentElement;
    if (!parentElement) return;

    attachCopyButtonGlobalListeners();

    const visibilityObserver = ensureCopyButtonVisibilityObserver();
    if (visibilityObserver) {
        copyButtonObservedParents.set(parentElement, element);
        visibilityObserver.observe(parentElement);

        // Seed visibility immediately so we avoid a global update before the observer fires.
        const rect = parentElement.getBoundingClientRect();
        const margin = copyButtonVisibilityMarginPx;
        if (rect.bottom > -margin && rect.top < window.innerHeight + margin) {
            visibleCopyButtons.add(element);
        } else {
            visibleCopyButtons.delete(element);
        }
    } else {
        // Fallback: no IntersectionObserver support, update all registered buttons.
        visibleCopyButtons.add(element);
    }

    const STICKY_THRESHOLD_PX = 2;
    let mode = "normal"; // "normal" | "sticky" | "bottom"

    // Cache baseline styling values once; during sticky mode we override `right`,
    // so reading computed styles later would give the dynamic value and break math.
    const initialStyles = getComputedStyle(element);
    const baseRightPx = parseFloat(initialStyles.right) || 8;
    const copyBorderWidthPx = parseFloat(initialStyles.borderWidth) || 1;

    const syncHorizontalOffset = () => {
        if (mode === "sticky") return;
        element.style.transform = `translateX(${parentElement.scrollLeft}px)`;
    };

    const setMode = (nextMode) => {
        mode = nextMode;

        if (mode === "sticky") {
            element.classList.add("stick-to-top");
            element.classList.remove("bottom");
            element.style.transform = "";
        } else if (mode === "bottom") {
            element.classList.add("bottom");
            element.classList.remove("stick-to-top");
            element.style.right = "";
            syncHorizontalOffset();
        } else {
            element.classList.remove("stick-to-top");
            element.classList.remove("bottom");
            element.style.right = "";
            syncHorizontalOffset();
        }
    };

    copyButtonStates.set(element, {
        parentElement,
        update() {
            const scrollBarHeight = parentElement.offsetHeight - parentElement.clientHeight;
            const copyButtonHeightAndMargins = (element.offsetHeight || 0) + baseRightPx * 2 + scrollBarHeight;

            const rect = parentElement.getBoundingClientRect();
            const isPinnedPastTop = rect.top < -STICKY_THRESHOLD_PX;

            if (!isPinnedPastTop) {
                if (mode !== "normal") setMode("normal");
                else syncHorizontalOffset();
                return;
            }

            // Hysteresis to prevent flicker at the boundary where we switch between
            // stick-to-top and bottom.
            const stickyEnter = rect.bottom > copyButtonHeightAndMargins + STICKY_THRESHOLD_PX;
            const stickyExit = rect.bottom <= copyButtonHeightAndMargins - STICKY_THRESHOLD_PX;

            let nextMode = mode;
            if (mode === "sticky") {
                nextMode = stickyExit ? "bottom" : "sticky";
            } else if (mode === "bottom") {
                nextMode = stickyEnter ? "sticky" : "bottom";
            } else {
                nextMode = stickyEnter ? "sticky" : "bottom";
            }

            if (nextMode !== mode) setMode(nextMode);

            if (mode === "sticky") {
                const rightAmount = window.innerWidth - rect.right + baseRightPx + copyBorderWidthPx;
                element.style.right = rightAmount + "px";
            } else {
                syncHorizontalOffset();
            }
        }
    });

    parentElement.addEventListener("scroll", scheduleCopyButtonUpdate, { passive: true });
    scheduleCopyButtonUpdate();
}

function getPrismScriptPath() {
    const script = Array.from(document.scripts).find((element) => element.src.includes("/tabbar/utils/simpleMarkdownProcessor.js"));
    if (script) {
        return new URL("../chungus/prism/prism.js", script.src).href;
    }

    const tabbarPath = window.location.pathname.split("/tabbar/")[0];
    if (tabbarPath !== window.location.pathname) {
        return `${window.location.origin}${tabbarPath}/tabbar/chungus/prism/prism.js`;
    }

    return new URL("./chungus/prism/prism.js", window.location.origin).href;
}

async function ensurePrismLoaded() {
    if (typeof Prism !== "undefined") {
        return;
    }

    if (!prismLoadPromise) {
        prismLoadPromise = new Promise((resolve, reject) => {
            const timeoutMs = 3000;
            const startedAt = Date.now();

            const pollId = setInterval(() => {
                if (typeof Prism !== "undefined") {
                    clearInterval(pollId);
                    resolve();
                } else if (Date.now() - startedAt > timeoutMs) {
                    clearInterval(pollId);
                    reject(new Error("Prism load timeout"));
                }
            }, 50);

            const existingScript = Array.from(document.scripts).find((element) => element.src.includes("/chungus/prism/prism.js"));
            if (existingScript) {
                if (typeof Prism !== "undefined") {
                    clearInterval(pollId);
                    resolve();
                    return;
                }

                existingScript.addEventListener("load", () => {
                    clearInterval(pollId);
                    resolve();
                }, { once: true });
                existingScript.addEventListener("error", (e) => {
                    clearInterval(pollId);
                    reject(e);
                }, { once: true });
                return;
            }

            const prism = document.createElement("script");
            prism.src = getPrismScriptPath();
            prism.async = true;
            prism.onload = () => {
                clearInterval(pollId);
                resolve();
            };
            prism.onerror = (e) => {
                clearInterval(pollId);
                reject(e);
            };
            document.body.appendChild(prism);
        });
    }

    await prismLoadPromise;
}

async function highlightAllCodeBlocks() {
    if (typeof Prism === "undefined" || typeof Prism.highlightElement !== "function") {
        return;
    }

    const selector = 'pre code:not([data-highlighted])[class*="language-"]';
    const elements = document.querySelectorAll(selector);

    const tasks = Array.from(elements).map((element) => {
        return new Promise((resolve) => {
            try {
                Prism.highlightElement(element, false, resolve);
                element.dataset.highlighted = 'true';
            } catch {
                resolve();
            }
        });
    });

    await Promise.all(tasks);
}

async function batUpdateRules() {
    if (!_copyButtonsDoCopyMarkdowns) {
        _copyButtonsDoCopyMarkdowns = true;

        document.addEventListener("click", async (e) => {
            const btn = e.target.closest("pre.code div.copy-btn");
            if (!btn) return;

            const code = btn.parentElement.querySelector("code");
            if (!code) return;

            try {
                await navigator.clipboard.writeText(code.innerText);
            } catch {
                btn.classList.add("copied");
                btn.innerHTML = "Copy failed";
                setTimeout(() => {
                    btn.classList.remove("copied");
                    btn.innerHTML = "Copy";
                }, 1000);
                return;
            }

            btn.classList.add("copied");
            btn.innerHTML = "Copied";
            setTimeout(() => {
                btn.classList.remove("copied");
                btn.innerHTML = "Copy";
            }, 1000);
        });

        (() => {
            function hexToRgba(hex) {
                hex = hex.replace('#', '');

                if (hex.length === 8) {
                    const r = parseInt(hex.slice(0, 2), 16);
                    const g = parseInt(hex.slice(2, 4), 16);
                    const b = parseInt(hex.slice(4, 6), 16);
                    const a = parseInt(hex.slice(6, 8), 16) / 255;
                    return { r, g, b, a };
                }

                if (hex.length === 6) {
                    const r = parseInt(hex.slice(0, 2), 16);
                    const g = parseInt(hex.slice(2, 4), 16);
                    const b = parseInt(hex.slice(4, 6), 16);
                    return { r, g, b, a: 1 };
                }

                return null;
            }

            function composite(fg, bg) {
                const a = fg.a;

                return {
                    r: Math.round(fg.r * a + bg.r * (1 - a)),
                    g: Math.round(fg.g * a + bg.g * (1 - a)),
                    b: Math.round(fg.b * a + bg.b * (1 - a)),
                };
            }

            function processCopyColors() {
                const style = getComputedStyle(document.documentElement);

                const bgHex = style.getPropertyValue('--bg-color').trim();
                const bg = hexToRgba(bgHex);
                if (!bg) return;

                Array.from(style).forEach((prop) => {
                    if (!prop.startsWith('--copy-')) return;

                    const value = style.getPropertyValue(prop).trim();
                    if (!value.startsWith('#')) return;

                    const fg = hexToRgba(value);
                    if (!fg || fg.a === 1) return;

                    const result = composite(fg, bg);

                    const solid = `rgb(${result.r} ${result.g} ${result.b})`;

                    document.documentElement.style.setProperty(
                        prop + '-solid',
                        solid
                    );
                });
            }

            processCopyColors();
        })();
    }

    document.querySelectorAll("pre.code div.copy-btn").forEach((element) => {
        registerCopyButton(element);
    });

    scheduleCopyButtonUpdate();

    try {
        await ensurePrismLoaded();
        await highlightAllCodeBlocks();
    } catch (e) {
        console.warn("Failed to apply Prism highlighting", e);
    }
}
