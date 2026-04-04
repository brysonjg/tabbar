function getRandomPUAChars(count = 64) {
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

function translateMDtoHTMLDecupled(md) {
    const escapeHTML = (str) =>
    str.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/\>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // Escape HTML first
    md = escapeHTML(md);

    // Escape Code blocks (fenced)
    let fencedCodeBlocks = new Map();
    let codeBlockIndex = 0;
    md = md.replace(/```(\w+)?\n([\s\S]*?)\n```/gm,
                    (_, lang, code) => {
                        const token = getMarkdownToken(codeBlockIndex);
                        codeBlockIndex++;

                        fencedCodeBlocks.set(
                            token,
                            `<pre class="code"><div class='copy-btn'>Copy</div><code class='language-${lang || ""}'>${code}</code></pre>`
                        );

                        return token;
                    }
    );

    // Ordered lists
    md = md.replace(/(?:^\d+\.\s.+\n?)+/gm, (match) => {
        let items = match.trim().split(/\n/).map((line) => {
            return line.replace(/^\d+\.\s+/, "<li>") + "</li>";
        }).join("");
        return `<ol type="decimal">${items}</ol>`;
    });

    // Unordered lists
    md = md.replace(/(?:^[-*]\s.+\n?)+/gm, (match) => {
        let items = match.trim().split(/\n/).map((line) => {
            return line.replace(/^[-*]\s+/, "<li>") + "</li>";
        }).join("");
        return `<ul>${items}</ul>`;
    });

    // Headings
    md = md.replace(/^###(.+)$\n/gm, "<h3>$1</h3>");
    md = md.replace(/^##(.+)$\n/gm, "<h2>$1</h2>");
    md = md.replace(/^#(.+)$\n/gm, "<h1>$1</h1>");


    // Blockquotes (group consecutive > lines into one blockquote)
    md = md.replace(/((?:^&gt;.*(?:\n|$))+)/gm, (block) => {
        const content = block
        .replace(/^&gt;\s?/gm, "")
        .trim()
        .replace(/\n/g, "<br>");

        return `<blockquote>${content}</blockquote>`;
    });

    // Horizontal rules
    md = md.replace(/^(?:-{3,}|\*{3,}|_{3,})$/gm, "<hr>");

    // Images
    md = md.replace(/!\[(.+?)\]\((.+?)\)/g, "<img alt='$1' src='$2'></img>");

    // Inline formatting
    md = md.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    md = md.replace(/\*(.+?)\*/g, "<i>$1</i>");
    md = md.replace(/~~(.+?)~~/g, "<s>$1</s>");
    md = md.replace(/~(.+?)~/g, "<sub>$1</sub>");
    md = md.replace(/\^(.+?)\^/g, "<sup>$1</sup>");
    md = md.replace(/==(.+?)==/g, "<h>$1</h>");
    md = md.replace(/`(.+?)`/g, "<code>$1</code>");
    md = md.replace(/\[(.+?)\]\((.+?)\)/g, "<a href='$2' target='_blank'>$1</a>");

    // Newline formating
    md = md.trim();
    md = md.replace(/\n/g, "<br>");

    // Table formatting
    md = md.replace(
        /((?:\|?.+\|.*(?:\n|<br>|$))+)/g,
                    (tableBlock) => {
                        const rows = tableBlock.split(/\r?\n|<br>/).map((r) => r.trim()).filter((r) => r);

                        if (rows.length < 2) return tableBlock;

                        const separator = rows[1].replace(/^\||\|$/g, "").trim();
                        if (!/^:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)*$/.test(separator)) return tableBlock;

                        const headerCells = rows[0].replace(/^\||\|$/g, "").split("|")
                        .map((c) => `<th>${c.trim()}</th>`).join("");

                        const bodyRows = rows.slice(2).map((r) => {
                            const cols = r.replace(/^\||\|$/g, "").split("|")
                            .map((c) => `<td>${c.trim()}</td>`).join("");
                            return `<tr>${cols}</tr>`;
                        }).join("");

                        return `<table>
                        <thead><tr>${headerCells}</tr></thead>
                        <tbody>${bodyRows}</tbody>
                        </table>`;
                    }
    );

    // Insert Code Blocks (fenced)
    fencedCodeBlocks.forEach((html, token) => {
        md = md.replaceAll(token, html);
    });

    return md;
}

async function batUpdateRules() {
    document.querySelectorAll("pre div.copy-btn").forEach((element) => {
        element.onclick = () => {
            const code = element.parentElement.querySelector("code");
            if (!code) return;

            navigator.clipboard.writeText(code.innerText)

            function resetBtn() {
                element.classList.remove("copied");
                element.innerHTML = "Copy";
            }

            element.classList.add("copied");
            element.innerHTML = "Copied";
            setTimeout(resetBtn, 1000);
        };
    });

    try {
        await prismHighlightAllComplete();
    } catch (e) {
        const prism = document.createElement("script");
        const curentLoscSplit = window.location.pathname.split("/tabbar/").pop();
        const dotNumber = (curentLoscSplit.split("/")).length - 1;
        const dots = (dotNumber === 0) ? "./" : "../".repeat(dotNumber);
        const prismPathName = new URL(dots + "chungus/prism/prism.js", window.location.href);

        prism.src = prismPathName;
        prism.async = true;

        document.body.appendChild(prism);

        await (async () => {
            return new Promise((resolve, reject) => {
                prism.onload = () => {
                    prismHighlightAllComplete()
                        .then(resolve)
                        .catch(reject);
                };

                prism.onerror = reject;
            });
        })();
    }
}
