// Small markdown renderer for posts and comments. It builds DOM nodes with textContent only,
// so user text can never inject HTML. Supports headings, bold, italic, strikethrough, inline code,
// code blocks, links, bullet and numbered lists, quotes, and dividers.

const MARKDOWN_INLINE = new RegExp([
    "(`+)([\\s\\S]*?[^`])\\1(?!`)",     // 1,2: inline code
    "\\*\\*([\\s\\S]+?)\\*\\*",           // 3: bold
    "__([\\s\\S]+?)__",                   // 4: bold
    "\\*([^\\s*][\\s\\S]*?)\\*",          // 5: italic
    "_([^\\s_][\\s\\S]*?)_",              // 6: italic
    "~~([\\s\\S]+?)~~",                   // 7: strikethrough
    "\\[([^\\]]+)\\]\\(([^)\\s]+)\\)",    // 8,9: link
    "(https?:\\/\\/[^\\s<]+)"             // 10: bare link
].join("|"), "g");

function safeLink(href) {
    try {
        const url = new URL(href);
        return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

function markdownLink(href, label) {
    const url = safeLink(href);
    if (!url) return document.createTextNode(label);

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer nofollow ugc";
    renderMarkdownInline(label, link, true);
    return link;
}

function markdownElement(tag, text, parent, inLink = false) {
    const node = document.createElement(tag);
    renderMarkdownInline(text, node, inLink);
    parent.appendChild(node);
}

// inLink stops links from being created inside a link's own text, which would recurse forever
function renderMarkdownInline(text, parent, inLink = false) {
    // Each call needs its own regex: nested calls would otherwise reset this loop's position
    const pattern = new RegExp(MARKDOWN_INLINE.source, "g");
    let last = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        const before = text[match.index - 1];
        const after = text[match.index + match[0].length];

        // Underscores inside words (snake_case) are not emphasis
        const wordBoundary = !(before && /\w/.test(before)) && !(after && /\w/.test(after));
        if ((match[4] !== undefined || match[6] !== undefined) && !wordBoundary) {
            pattern.lastIndex = match.index + 1;
            continue;
        }

        if (inLink && (match[8] !== undefined || match[10] !== undefined)) {
            pattern.lastIndex = match.index + 1;
            continue;
        }

        if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));

        if (match[2] !== undefined) {
            const code = document.createElement("code");
            code.textContent = match[2].trim();
            parent.appendChild(code);
        } else if (match[3] !== undefined || match[4] !== undefined) {
            markdownElement("strong", match[3] ?? match[4], parent, inLink);
        } else if (match[5] !== undefined || match[6] !== undefined) {
            markdownElement("em", match[5] ?? match[6], parent, inLink);
        } else if (match[7] !== undefined) {
            markdownElement("del", match[7], parent, inLink);
        } else if (match[8] !== undefined) {
            parent.appendChild(markdownLink(match[9], match[8]));
        } else {
            // Trailing punctuation belongs to the sentence, not the link
            const trimmed = match[10].replace(/[.,!?;:)]+$/, "");
            parent.appendChild(markdownLink(trimmed, trimmed));
            if (trimmed.length < match[10].length) parent.appendChild(document.createTextNode(match[10].slice(trimmed.length)));
        }
        last = match.index + match[0].length;
    }

    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

// Joins lines inside one paragraph, keeping the author's line breaks
function renderMarkdownLines(lines, parent) {
    lines.forEach((line, index) => {
        if (index > 0) parent.appendChild(document.createElement("br"));
        renderMarkdownInline(line, parent);
    });
}

function renderMarkdownBlocks(text, parent) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) {
            i++;
            continue;
        }

        const fence = /^```/.exec(line);
        if (fence) {
            const code = [];
            i++;
            while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
            i++;
            const pre = document.createElement("pre");
            const inner = document.createElement("code");
            inner.textContent = code.join("\n");
            pre.appendChild(inner);
            parent.appendChild(pre);
            continue;
        }

        const heading = /^(#{1,3})\s+(.+)$/.exec(line);
        if (heading) {
            markdownElement(`h${heading[1].length + 3}`, heading[2].trim(), parent);
            i++;
            continue;
        }

        if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
            parent.appendChild(document.createElement("hr"));
            i++;
            continue;
        }

        if (/^>\s?/.test(line)) {
            const quoted = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) quoted.push(lines[i++].replace(/^>\s?/, ""));
            const quote = document.createElement("blockquote");
            renderMarkdownBlocks(quoted.join("\n"), quote);
            parent.appendChild(quote);
            continue;
        }

        const bullet = /^\s*[-*+]\s+(.*)$/;
        const numbered = /^\s*\d+[.)]\s+(.*)$/;
        const kind = bullet.test(line) ? bullet : numbered.test(line) ? numbered : null;
        if (kind) {
            const list = document.createElement(kind === bullet ? "ul" : "ol");
            while (i < lines.length && kind.test(lines[i])) {
                markdownElement("li", kind.exec(lines[i])[1], list);
                i++;
            }
            parent.appendChild(list);
            continue;
        }

        const paragraph = [];
        while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|>\s?|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i])) {
            paragraph.push(lines[i++]);
        }
        if (paragraph.length === 0) paragraph.push(lines[i++]);
        const node = document.createElement("p");
        renderMarkdownLines(paragraph, node);
        parent.appendChild(node);
    }
}

function renderMarkdown(text, parent) {
    parent.replaceChildren();
    renderMarkdownBlocks(text, parent);
    return parent;
}
