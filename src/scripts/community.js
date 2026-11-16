const state = {
    user: null,
    config: null,
    category: null,
    counts: {},
    hasMore: false,
    nextCursor: null,
    requestId: 0
};

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const HEIC_LIBRARY = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
const GOOGLE_LIBRARY = "https://accounts.google.com/gsi/client";
const REPORTED = "__reported__";

/* ---------- Helpers ---------- */

async function api(path, {method = "GET", json, form} = {}) {
    const options = {method, headers: {}};
    if (json !== undefined) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(json);
    }
    if (form) options.body = form;

    let response;
    try {
        response = await fetch(path, options);
    } catch {
        throw new Error("Can't reach the server. Check your connection and try again.");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401 && state.user) {
            state.user = null;
            renderAuth();
            loadPosts(true);
        }
        throw new Error(data.error || "Something went wrong. Please try again.");
    }
    return data;
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function button(label, className, onClick) {
    const node = el("button", className, label);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
}

// Icons used inside buttons are inline SVG (Bootstrap Icons shapes) because the icon font sits a pixel off-center in small buttons
const SVG_ICONS = {
    "three-dots": {
        paths: ["M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"]
    },
    "trash": {
        viewBox: "0 -0.5 16 16",
        paths: [
            "M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z",
            "M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"
        ]
    },
    "heart": {
        viewBox: "0 -0.67 16 16",
        paths: ["m8 2.748-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143q.09.083.176.171a3 3 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15"]
    },
    "heart-fill": {
        viewBox: "0 -0.67 16 16",
        paths: ["M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"]
    },
    "chat": {
        viewBox: "0 0.4 16 16",
        paths: ["M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105"]
    },
    "flag": {
        paths: ["M3 1.5a.5.5 0 0 1 1 0V2h8.5a.5.5 0 0 1 .4.8L11 5.5l1.9 2.7a.5.5 0 0 1-.4.8H4v6.5a.5.5 0 0 1-1 0z"]
    },
    "chevron-left": {
        paths: ["M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"]
    },
    "chevron-right": {
        paths: ["M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"]
    }
};

// Posts a person chose to hide are remembered in this browser only, so nothing extra is stored on the server
const HIDDEN_KEY = "uj_hidden_posts";

function hiddenPosts() {
    try {
        return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"));
    } catch {
        return new Set();
    }
}

function setPostHidden(id, hide) {
    const hidden = hiddenPosts();
    if (hide) hidden.add(id);
    else hidden.delete(id);

    try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden].slice(-500)));
    } catch {
        // Storage can be unavailable (private mode); the post just stays hidden until the page reloads
    }
}

function icon(name) {
    const svgIcon = SVG_ICONS[name];
    if (!svgIcon) return el("i", `bi bi-${name}`);

    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "icon-svg");
    svg.setAttribute("viewBox", svgIcon.viewBox || "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    for (const d of svgIcon.paths) {
        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", "currentColor");
        svg.appendChild(path);
    }
    return svg;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded) resolve();
            else existing.addEventListener("load", resolve);
            return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.addEventListener("load", () => {
            script.dataset.loaded = "true";
            resolve();
        });
        script.addEventListener("error", () => reject(new Error(`Could not load ${src}`)));
        document.head.appendChild(script);
    });
}

function formatTime(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    const date = new Date(timestamp);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;

    const days = Math.floor(seconds / 86400);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;

    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString("en-US", {month: "long", day: "numeric", ...(sameYear ? {} : {year: "numeric"})});
}

function timeElement(timestamp) {
    const node = el("span", "post-time", formatTime(timestamp));
    node.title = new Date(timestamp).toLocaleString();
    return node;
}

let toastTimer;

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function confirmDialog({title, message, confirmLabel, danger = true}) {
    return new Promise(resolve => {
        const backdrop = el("div", "dialog-backdrop");
        const dialog = el("div", "dialog");
        dialog.setAttribute("role", "alertdialog");

        const close = result => {
            document.removeEventListener("keydown", onKey);
            backdrop.remove();
            resolve(result);
        };
        const onKey = event => {
            if (event.key === "Escape") close(false);
        };

        const buttons = el("div", "dialog-buttons");
        buttons.append(
            button("Cancel", "community-button secondary", () => close(false)),
            button(confirmLabel, `community-button${danger ? " danger" : ""}`, () => close(true))
        );
        dialog.append(el("h3", "", title), el("p", "", message), buttons);
        backdrop.appendChild(dialog);
        backdrop.addEventListener("click", event => {
            if (event.target === backdrop) close(false);
        });
        document.addEventListener("keydown", onKey);
        document.body.appendChild(backdrop);
        buttons.firstChild.focus();
    });
}

function openLightbox(url) {
    const box = el("div", "lightbox");
    const image = el("img");
    image.src = url;
    image.alt = "";
    box.appendChild(image);

    const close = () => {
        document.removeEventListener("keydown", onKey);
        box.remove();
    };
    const onKey = event => {
        if (event.key === "Escape") close();
    };
    box.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.body.appendChild(box);
}

/* ---------- Sidebar ---------- */

function renderSidebar() {
    const list = document.getElementById("categoryList");
    list.replaceChildren();

    const total = state.config.categories.reduce((sum, name) => sum + (state.counts[name] || 0), 0);
    const entries = [[null, "All Posts", total], ...state.config.categories.map(name => [name, name, state.counts[name] || 0])];
    if (state.user && state.user.isAdmin && state.counts.reported !== undefined) {
        entries.push([REPORTED, "Reported", state.counts.reported]);
    }

    for (const [value, label, count] of entries) {
        const item = button("", `category-button${state.category === value ? " active" : ""}`, () => {
            if (state.category === value) return;
            state.category = value;
            renderSidebar();
            loadPosts(true);
        });
        item.append(el("span", "", label), el("small", "", String(count)));
        list.appendChild(item);
    }
}

/* ---------- Auth ---------- */

function renderAuth() {
    const area = document.getElementById("authArea");
    area.replaceChildren();

    if (state.user) {
        const line = el("p", "session-line", `Signed in as ${state.user.name}${state.user.isAdmin ? " (admin)" : ""} · `);
        line.appendChild(button("Sign out", "", signOut));
        area.append(line, buildComposer());
    } else {
        area.appendChild(buildSignIn());
    }
}

function buildSignIn() {
    const card = el("div", "community-card signin-card");
    card.appendChild(el("p", "", "Sign in with Google to post, comment, and like. Anyone can read along."));

    if (state.config.googleClientId) {
        const target = el("div");
        card.appendChild(target);
        loadScript(GOOGLE_LIBRARY).then(() => {
            google.accounts.id.initialize({client_id: state.config.googleClientId, callback: signInWithGoogle});
            google.accounts.id.renderButton(target, {theme: "outline", size: "large", shape: "pill"});
        }).catch(() => showToast("Couldn't load Google sign-in. Please refresh and try again."));
    }

    if (!state.config.googleClientId) {
        card.lastChild.textContent = "Sign-in is coming soon. Anyone can read along in the meantime.";
    }
    return card;
}

async function signInWithGoogle(response) {
    await completeSignIn("/api/auth/google", {credential: response.credential});
}

async function completeSignIn(path, body) {
    try {
        const data = await api(path, {method: "POST", json: body});
        state.user = data.user;
        renderAuth();
        loadPosts(true);
    } catch (error) {
        showToast(error.message);
    }
}

async function signOut() {
    try {
        await api("/api/auth/logout", {method: "POST"});
    } catch (error) {
        showToast(error.message);
        return;
    }
    state.user = null;
    renderAuth();
    loadPosts(true);
}

/* ---------- Image preparation ---------- */

function isHeic(file) {
    return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

// Photos are compressed automatically so people never have to resize anything themselves
const MAX_IMAGE_EDGE = 2000;
const MIN_IMAGE_EDGE = 600;
const IMAGE_QUALITIES = [0.85, 0.75, 0.65, 0.55];

async function decodeImage(file) {
    try {
        return await createImageBitmap(file, {imageOrientation: "from-image"});
    } catch {
        return createImageBitmap(file);
    }
}

// Re-encodes as JPEG, trying smaller sizes and lower quality until the file fits under maxBytes
async function compressImage(file, maxBytes) {
    let bitmap;
    try {
        bitmap = await decodeImage(file);
    } catch {
        throw new Error(`${file.name} couldn't be read. Try a different image.`);
    }

    const longEdge = Math.max(bitmap.width, bitmap.height);
    let edge = Math.min(longEdge, MAX_IMAGE_EDGE);

    try {
        while (edge >= Math.min(MIN_IMAGE_EDGE, longEdge)) {
            const scale = edge / longEdge;
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));

            // JPEG has no transparency, so flatten onto white
            const context = canvas.getContext("2d");
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

            for (const quality of IMAGE_QUALITIES) {
                const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
                if (blob && blob.size <= maxBytes) {
                    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {type: "image/jpeg"});
                }
            }
            edge = Math.round(edge * 0.8);
        }
    } finally {
        if (bitmap.close) bitmap.close();
    }
    throw new Error(`${file.name} couldn't be made small enough. Try a different image.`);
}

// Images already under the limit are kept exactly as they are
function imageTarget() {
    return Math.floor(state.config.limits.imageBytes * 0.95);
}

function needsOptimizing(file) {
    return isHeic(file) || file.size > imageTarget();
}

async function prepareImage(file) {
    let working = file;

    if (isHeic(file)) {
        await loadScript(HEIC_LIBRARY);
        const converted = await heic2any({blob: file, toType: "image/jpeg", quality: 0.85});
        const blob = Array.isArray(converted) ? converted[0] : converted;
        working = new File([blob], file.name.replace(/\.hei[cf]$/i, "") + ".jpg", {type: "image/jpeg"});
    }

    if (!ALLOWED_TYPES.includes(working.type)) {
        throw new Error(`${file.name} isn't a supported image. Use JPEG, PNG, WebP, GIF, or HEIC.`);
    }

    if (working.size <= imageTarget()) return working;

    if (working.type === "image/gif") showToast("Large GIFs can't stay animated, so only the first frame was kept.");
    return compressImage(working, imageTarget());
}

/* ---------- Composer ---------- */

function categorySelect(selected) {
    const select = el("select", "community-select");
    select.setAttribute("aria-label", "Post category");
    for (const name of state.config.categories) {
        const option = el("option", "", name);
        option.value = name;
        option.selected = name === selected;
        select.appendChild(option);
    }
    return select;
}

function markdownHint() {
    return el("p", "md-hint", "Markdown works: **bold**, *italic*, [links](https://example.com), - lists, > quotes");
}

// Shared by the composer and the post editor. Items are {id, url} for saved images or {file, url} for new ones.
function createImageEditor({items = [], layout = "tiles", onError}) {
    const limits = state.config.limits;
    let list = items.map(item => ({...item}));
    let currentLayout = layout;
    let dragFrom = null;

    const previews = el("div", "previews");

    const attach = el("label", "attach-label");
    const fileInput = el("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.accept = "image/*,.heic,.heif";
    attach.append(icon("image"), document.createTextNode(" Image"), fileInput);

    const layoutToggle = el("div", "layout-toggle");
    const layoutButtons = {};
    for (const [value, label] of [["tiles", "Tiles"], ["carousel", "Carousel"]]) {
        layoutButtons[value] = button(label, "", () => {
            currentLayout = value;
            render();
        });
        layoutToggle.appendChild(layoutButtons[value]);
    }

    function release(item) {
        if (item.file) URL.revokeObjectURL(item.url);
    }

    function move(from, to) {
        if (from === to || to < 0 || to >= list.length) return;
        list.splice(to, 0, list.splice(from, 1)[0]);
        render();
    }

    function clearDropMarks() {
        previews.querySelectorAll(".drop-before, .drop-after").forEach(node => node.classList.remove("drop-before", "drop-after"));
    }

    function render() {
        previews.replaceChildren();

        list.forEach((item, index) => {
            const preview = el("div", "preview");
            preview.draggable = true;

            const image = el("img");
            image.src = item.url;
            image.alt = "";
            image.draggable = false;

            const remove = button("✕", "preview-remove", () => {
                release(list[index]);
                list.splice(index, 1);
                render();
            });
            remove.setAttribute("aria-label", "Remove image");

            // Arrow buttons are the reorder fallback for touch screens, where dragging isn't reliable
            const left = button("", "preview-move left", () => move(index, index - 1));
            const right = button("", "preview-move right", () => move(index, index + 1));
            left.setAttribute("aria-label", "Move image earlier");
            right.setAttribute("aria-label", "Move image later");
            left.appendChild(icon("chevron-left"));
            right.appendChild(icon("chevron-right"));
            left.hidden = index === 0;
            right.hidden = index === list.length - 1;

            preview.addEventListener("dragstart", event => {
                dragFrom = index;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(index));
                preview.classList.add("dragging");
            });
            preview.addEventListener("dragover", event => {
                if (dragFrom === null) return;
                event.preventDefault();
                const box = preview.getBoundingClientRect();
                const after = event.clientX > box.left + box.width / 2;
                clearDropMarks();
                preview.classList.add(after ? "drop-after" : "drop-before");
            });
            preview.addEventListener("drop", event => {
                if (dragFrom === null) return;
                event.preventDefault();
                const box = preview.getBoundingClientRect();
                let to = index + (event.clientX > box.left + box.width / 2 ? 1 : 0);
                if (dragFrom < to) to--;
                const from = dragFrom;
                dragFrom = null;
                move(from, to);
            });
            preview.addEventListener("dragend", () => {
                dragFrom = null;
                clearDropMarks();
                preview.classList.remove("dragging");
            });

            preview.append(image, remove, left, right);
            previews.appendChild(preview);
        });

        attach.hidden = list.length >= limits.images;
        layoutToggle.hidden = list.length < 2;
        for (const [value, node] of Object.entries(layoutButtons)) {
            node.classList.toggle("active", value === currentLayout);
        }
    }

    fileInput.addEventListener("change", async () => {
        const picked = [...fileInput.files];
        fileInput.value = "";
        onError("");

        const room = limits.images - list.length;
        if (picked.length > room) onError(`You can attach up to ${limits.images} images.`);
        if (picked.some(needsOptimizing)) showToast("Optimizing your photos...");

        for (const file of picked.slice(0, room)) {
            try {
                const prepared = await prepareImage(file);
                list.push({file: prepared, url: URL.createObjectURL(prepared)});
            } catch (problem) {
                onError(problem.message);
            }
        }
        render();
    });

    render();

    return {
        previews,
        attach,
        layoutToggle,
        count: () => list.length,
        layout: () => currentLayout,
        // Adds the images to a form: kept ones in "order" as e<id>, new ones as files referenced by n<index>
        appendTo(form) {
            const order = [];
            let newCount = 0;
            for (const item of list) {
                if (item.file) {
                    form.append("images", item.file);
                    order.push(`n${newCount++}`);
                } else {
                    order.push(`e${item.id}`);
                }
            }
            form.append("order", JSON.stringify(order));
        },
        reset(nextItems = [], nextLayout = "tiles") {
            list.forEach(release);
            list = nextItems.map(item => ({...item}));
            currentLayout = nextLayout;
            render();
        },
        destroy() {
            list.forEach(release);
        }
    };
}

function buildComposer() {
    const limits = state.config.limits;

    const card = el("div", "community-card composer");
    card.appendChild(el("div", "avatar", state.user.initials));

    const fields = el("div", "composer-fields");
    const body = el("textarea", "community-textarea");
    body.placeholder = "What would you like to share with the community?";
    body.maxLength = limits.body;
    body.setAttribute("aria-label", "Post");

    const title = el("input", "community-input");
    title.placeholder = "Give your post a title (optional)";
    title.maxLength = limits.title;
    title.setAttribute("aria-label", "Title");

    const error = el("p", "form-error");
    const images = createImageEditor({onError: message => error.textContent = message});
    const category = categorySelect(state.category && state.category !== REPORTED ? state.category : state.config.categories[3]);

    const cancel = button("Cancel", "community-button secondary", () => reset());
    const submit = button("Post", "community-button zoom-out", () => publish());

    const bar = el("div", "composer-bar");
    bar.append(images.attach, category, images.layoutToggle, el("span", "spacer"), cancel, submit);
    fields.append(body, markdownHint(), title, images.previews, bar, error);
    card.appendChild(fields);

    function reset() {
        images.reset();
        body.value = "";
        title.value = "";
        error.textContent = "";
    }

    async function publish() {
        error.textContent = "";
        if (!body.value.trim() && images.count() === 0) {
            error.textContent = "Write something or add an image first.";
            return;
        }

        const form = new FormData();
        form.append("body", body.value);
        form.append("title", title.value);
        form.append("category", category.value);
        form.append("layout", images.layout());
        images.appendTo(form);

        submit.disabled = true;
        submit.textContent = "Posting...";
        try {
            const data = await api("/api/posts", {method: "POST", form});
            reset();
            state.counts[data.post.category] = (state.counts[data.post.category] || 0) + 1;
            renderSidebar();
            if (inCategoryView(data.post.category)) {
                document.getElementById("feedStatus").textContent = "";
                document.getElementById("posts").prepend(buildPost(data.post));
            }
            showToast("Posted!");
        } catch (problem) {
            error.textContent = problem.message;
        } finally {
            submit.disabled = false;
            submit.textContent = "Post";
        }
    }

    return card;
}

/* ---------- Posts ---------- */

function buildImages(post) {
    if (post.images.length === 0) return null;

    const open = url => openLightbox(url);

    if (post.layout === "carousel" && post.images.length > 1) {
        const wrapper = el("div", "carousel");
        const track = el("div", "carousel-track");
        const count = el("span", "carousel-count", `1 / ${post.images.length}`);

        for (const {url} of post.images) {
            const slide = el("img", "carousel-slide");
            slide.src = url;
            slide.alt = "";
            slide.loading = "lazy";
            slide.addEventListener("click", () => open(url));
            track.appendChild(slide);
        }

        track.addEventListener("scroll", () => {
            const index = Math.round(track.scrollLeft / track.clientWidth);
            count.textContent = `${index + 1} / ${post.images.length}`;
        });

        const prev = button("", "carousel-arrow prev", () => track.scrollBy({left: -track.clientWidth, behavior: "smooth"}));
        const next = button("", "carousel-arrow next", () => track.scrollBy({left: track.clientWidth, behavior: "smooth"}));
        prev.setAttribute("aria-label", "Previous image");
        next.setAttribute("aria-label", "Next image");
        prev.appendChild(icon("chevron-left"));
        next.appendChild(icon("chevron-right"));

        wrapper.append(track, prev, next, count);
        return wrapper;
    }

    const tiles = el("div", `tiles tiles-${post.images.length}`);
    for (const {url} of post.images) {
        const tile = el("div", "tile");
        const image = el("img");
        image.src = url;
        image.alt = "";
        image.loading = "lazy";
        image.addEventListener("click", () => open(url));
        tile.appendChild(image);
        tiles.appendChild(tile);
    }
    return tiles;
}

function buildPost(post) {
    const card = el("article", "community-card post");
    card.id = `post-${post.id}`;
    const avatar = el("div", "avatar", post.author.initials);
    card.appendChild(avatar);

    const main = el("div", "post-main");
    const content = el("div");
    const imagesHolder = el("div");
    const actions = el("div", "post-actions");
    const commentsArea = el("div");
    const note = el("div", "post-hidden-note");
    let commentsOpen = false;
    let revealed = false;

    /* Header */
    const header = el("div", "post-header");
    header.append(el("span", "post-author", post.author.name), timeElement(post.createdAt), el("span", "post-tag", post.category));
    if (post.reports > 0 && !post.canEdit) {
        const inQueue = state.category === REPORTED;
        const who = post.reports === 1 ? "1 person has" : `${post.reports} people have`;
        const tip = `${who} reported this post.${inQueue ? "" : " Click to hide."}`;
        const flag = button("", "flag-button", () => {
            if (inQueue) return;
            setPostHidden(post.id, true);
            revealed = false;
            renderHidden();
        });
        flag.dataset.tip = tip;
        flag.setAttribute("aria-label", tip);
        flag.appendChild(icon("flag"));
        if (state.user && state.user.isAdmin) flag.appendChild(el("span", "flag-count", String(post.reports)));
        header.appendChild(flag);
    }
    header.appendChild(el("span", "spacer"));

    const menuItems = [];
    if (post.canEdit) menuItems.push(["Edit", startEdit]);
    if (post.canDelete) menuItems.push(["Delete", removePost]);
    if (state.user && !post.canEdit) menuItems.push([post.reported ? "Reported" : "Report", post.reported ? null : reportPost]);
    if (state.user && state.user.isAdmin && state.user.id !== post.author.id) menuItems.push(["Ban user", banUser]);

    if (menuItems.length > 0) {
        const wrapper = el("div", "menu-wrapper");
        const toggle = button("", "icon-button", event => {
            event.stopPropagation();
            const wasOpen = menu.classList.contains("open");
            closeMenus();
            menu.classList.toggle("open", !wasOpen);
        });
        toggle.setAttribute("aria-label", "More post options");
        toggle.appendChild(icon("three-dots"));

        const menu = el("div", "post-menu");
        for (const [label, handler] of menuItems) {
            const item = button(label, "", () => {
                closeMenus();
                handler();
            });
            item.disabled = !handler;
            menu.appendChild(item);
        }
        wrapper.append(toggle, menu);
        header.appendChild(wrapper);
    }

    function renderImages() {
        imagesHolder.replaceChildren();
        const images = buildImages(post);
        if (images) imagesHolder.appendChild(images);
    }

    /* Title + body */
    function renderContent() {
        content.replaceChildren();
        if (post.title) content.appendChild(el("h3", "post-title", post.title));

        if (post.body) {
            const body = renderMarkdown(post.body, el("div", "post-body markdown clamped"));
            const more = button("Read the full piece", "read-more", () => {
                const clamped = body.classList.toggle("clamped");
                more.textContent = clamped ? "Read the full piece" : "Show less";
            });
            more.hidden = true;
            content.append(body, more);

            const measure = () => {
                if (!body.isConnected || !body.classList.contains("clamped")) return;
                more.hidden = body.scrollHeight <= body.clientHeight + 1;
            };
            requestAnimationFrame(measure);
            document.fonts.ready.then(measure);
        }

        if (post.editedAt) content.appendChild(el("span", "post-edited", "Edited"));
    }

    function startEdit() {
        const limits = state.config.limits;
        const form = el("div", "edit-form");
        const title = el("input", "community-input");
        title.value = post.title || "";
        title.placeholder = "Title (optional)";
        title.maxLength = limits.title;
        const body = el("textarea", "community-textarea");
        body.value = post.body;
        body.maxLength = limits.body;
        const category = categorySelect(post.category);
        const error = el("p", "form-error");
        const images = createImageEditor({
            items: post.images,
            layout: post.layout,
            onError: message => error.textContent = message
        });

        function finish() {
            images.destroy();
            imagesHolder.hidden = false;
            renderContent();
        }

        const save = button("Save", "community-button", async () => {
            error.textContent = "";
            if (!body.value.trim() && images.count() === 0) {
                error.textContent = "Write something or keep an image.";
                return;
            }

            const data = new FormData();
            data.append("title", title.value);
            data.append("body", body.value);
            data.append("category", category.value);
            data.append("layout", images.layout());
            images.appendTo(data);

            save.disabled = true;
            save.textContent = "Saving...";
            try {
                const result = await api(`/api/posts/${post.id}`, {method: "PATCH", form: data});
                if (result.post.category !== post.category) {
                    state.counts[post.category]--;
                    state.counts[result.post.category]++;
                    renderSidebar();
                }
                Object.assign(post, result.post);
                if (!inCategoryView(post.category)) {
                    card.remove();
                    return;
                }
                tag.textContent = post.category;
                renderImages();
                finish();
            } catch (problem) {
                error.textContent = problem.message;
                save.disabled = false;
                save.textContent = "Save";
            }
        });
        const cancel = button("Cancel", "community-button secondary", finish);
        const bar = el("div", "composer-bar");
        bar.append(images.attach, category, images.layoutToggle, el("span", "spacer"), cancel, save);

        form.append(title, body, markdownHint(), images.previews, bar, error);
        imagesHolder.hidden = true;
        content.replaceChildren(form);
        body.focus();
    }

    const tag = header.querySelector(".post-tag");

    /* Menu actions */
    async function removePost() {
        const own = state.user && state.user.id === post.author.id;
        const confirmed = await confirmDialog({
            title: "Delete this post?",
            message: own ? "This permanently deletes your post, its images, and its comments." : `This permanently deletes ${post.author.name}'s post, its images, and its comments.`,
            confirmLabel: "Delete"
        });
        if (!confirmed) return;

        try {
            await api(`/api/posts/${post.id}`, {method: "DELETE"});
            state.counts[post.category]--;
            renderSidebar();
            card.remove();
            showToast("Post deleted.");
            if (state.category === REPORTED) loadPosts(true);
        } catch (problem) {
            showToast(problem.message);
        }
    }

    async function reportPost() {
        const confirmed = await confirmDialog({
            title: "Report this post?",
            message: "Reports are reviewed by (un)Jaded admins. This can't be undone.",
            confirmLabel: "Report",
            danger: false
        });
        if (!confirmed) return;

        try {
            await api(`/api/posts/${post.id}/report`, {method: "POST"});
            post.reported = true;
            const replacement = buildPost(post);
            card.replaceWith(replacement);
            showToast("Thanks for letting us know. An admin will take a look, and the post is hidden for you.");
        } catch (problem) {
            showToast(problem.message);
        }
    }

    async function banUser() {
        const confirmed = await confirmDialog({
            title: `Ban ${post.author.name}?`,
            message: "This deletes all of their posts, images, and comments, and blocks them from signing in. It can only be undone by editing the database.",
            confirmLabel: "Ban and delete"
        });
        if (!confirmed) return;

        try {
            const data = await api(`/api/admin/users/${post.author.id}/ban`, {method: "POST", json: {confirm: true}});
            showToast(`Banned ${post.author.name} and deleted ${data.deletedPosts} post${data.deletedPosts === 1 ? "" : "s"}.`);
            await loadPosts(true);
        } catch (problem) {
            showToast(problem.message);
        }
    }

    /* Likes + comments */
    const likeButton = el("button", "action-button");
    likeButton.type = "button";
    const commentButton = el("button", "action-button");
    commentButton.type = "button";

    function renderActions() {
        likeButton.classList.toggle("active", post.liked);
        likeButton.replaceChildren(icon(post.liked ? "heart-fill" : "heart"), el("span", "", String(post.likes)));
        likeButton.setAttribute("aria-label", post.liked ? "Unlike" : "Like");
        commentButton.replaceChildren(icon("chat"), el("span", "", String(post.comments)));
        commentButton.setAttribute("aria-label", "Comments");
    }

    likeButton.addEventListener("click", async () => {
        if (!state.user) {
            showToast("Sign in to like posts.");
            return;
        }
        try {
            const data = await api(`/api/posts/${post.id}/like`, {method: "POST"});
            post.liked = data.liked;
            post.likes = data.likes;
            renderActions();
        } catch (problem) {
            showToast(problem.message);
        }
    });

    commentButton.addEventListener("click", () => {
        commentsOpen = !commentsOpen;
        commentsArea.replaceChildren();
        if (commentsOpen) renderComments();
    });

    actions.append(likeButton, commentButton);

    async function renderComments() {
        const section = el("div", "comments");
        const list = el("div");
        section.appendChild(list);
        commentsArea.replaceChildren(section);

        function addComment(comment) {
            const row = el("div", "comment");
            row.appendChild(el("div", "avatar small", comment.author.initials));

            const mainColumn = el("div", "comment-main");
            const meta = el("div", "comment-meta");
            meta.append(el("strong", "", comment.author.name), timeElement(comment.createdAt));

            if (comment.canDelete) {
                const remove = button("", "icon-button", async () => {
                    const confirmed = await confirmDialog({
                        title: "Delete this comment?",
                        message: "This can't be undone.",
                        confirmLabel: "Delete"
                    });
                    if (!confirmed) return;
                    try {
                        await api(`/api/comments/${comment.id}`, {method: "DELETE"});
                        row.remove();
                        post.comments--;
                        renderActions();
                    } catch (problem) {
                        showToast(problem.message);
                    }
                });
                remove.setAttribute("aria-label", "Delete comment");
                remove.appendChild(icon("trash"));
                meta.appendChild(remove);
            }

            mainColumn.append(meta, renderMarkdown(comment.body, el("div", "comment-body markdown")));
            row.appendChild(mainColumn);
            list.appendChild(row);
        }

        try {
            const data = await api(`/api/posts/${post.id}/comments`);
            data.comments.forEach(addComment);
        } catch (problem) {
            list.appendChild(el("p", "comments-note", problem.message));
        }

        if (!state.user) {
            section.appendChild(el("p", "comments-note", "Sign in to join the conversation."));
            return;
        }

        const form = el("form", "comment-form");
        const input = el("input", "community-input");
        input.placeholder = "Add a comment";
        input.maxLength = state.config.limits.comment;
        input.setAttribute("aria-label", "Comment");
        const send = el("button", "community-button", "Reply");
        form.append(input, send);
        form.addEventListener("submit", async event => {
            event.preventDefault();
            if (!input.value.trim()) return;

            send.disabled = true;
            try {
                const data = await api(`/api/posts/${post.id}/comments`, {method: "POST", json: {body: input.value}});
                addComment(data.comment);
                input.value = "";
                post.comments++;
                renderActions();
            } catch (problem) {
                showToast(problem.message);
            } finally {
                send.disabled = false;
            }
        });
        section.appendChild(form);
    }

    renderImages();
    renderContent();
    renderActions();
    main.append(header, content);
    main.appendChild(imagesHolder);
    main.append(actions, commentsArea);
    card.append(main, note);
    renderHidden();
    return card;

    /* Hiding: posts you reported, or flagged posts you chose to hide, collapse to a one-line note */
    function shouldHide() {
        if (revealed || post.canEdit || state.category === REPORTED) return false;
        return post.reported || hiddenPosts().has(post.id);
    }

    function renderHidden() {
        const hide = shouldHide();
        card.classList.toggle("collapsed", hide);
        avatar.hidden = hide;
        main.hidden = hide;
        note.hidden = !hide;
        if (!hide) return;

        note.replaceChildren(
            el("span", "", post.reported ? "You reported this post, so it's hidden for you." : "You hid this post."),
            button(post.reported ? "Show anyway" : "Show", "read-more", () => {
                if (!post.reported) setPostHidden(post.id, false);
                revealed = true;
                renderHidden();
            })
        );
    }
}

// True when a post in this category belongs in the feed currently on screen
function inCategoryView(category) {
    if (state.category === REPORTED) return false;
    return !state.category || state.category === category;
}

function closeMenus() {
    document.querySelectorAll(".post-menu.open").forEach(menu => menu.classList.remove("open"));
}

/* ---------- Feed ---------- */

async function loadPosts(reset) {
    const container = document.getElementById("posts");
    const status = document.getElementById("feedStatus");
    const more = document.getElementById("loadMore");
    const requestId = ++state.requestId;

    if (reset) {
        container.replaceChildren();
        state.nextCursor = null;
        more.hidden = true;
    }
    status.textContent = "Loading...";

    const params = new URLSearchParams();
    if (state.category === REPORTED) params.set("reported", "1");
    else if (state.category) params.set("category", state.category);
    if (!reset && state.nextCursor) params.set("before", state.nextCursor);

    try {
        const data = await api(`/api/posts?${params}`);
        if (requestId !== state.requestId) return;

        if (data.counts) {
            state.counts = data.counts;
            renderSidebar();
        }

        const linkedId = reset ? linkedPostId() : null;
        const linkedCard = container.querySelector(".post-linked");
        if (linkedId && !linkedCard) await showLinkedPost(linkedId, container);

        for (const post of data.posts) {
            if (document.getElementById(`post-${post.id}`)) continue;
            container.appendChild(buildPost(post));
        }

        state.nextCursor = data.nextCursor;
        more.hidden = !data.hasMore;
        status.replaceChildren();

        if (container.children.length === 0) {
            if (state.category === REPORTED) status.textContent = "No reported posts. All clear!";
            else status.textContent = state.category ? `No ${state.category.toLowerCase()} posts yet.` : "Nothing here yet. Be the first to share something!";
            if (state.user) {
                status.appendChild(button("Share something", "community-button zoom-out", () => {
                    document.querySelector(".composer textarea").focus();
                }));
            }
        }
    } catch (problem) {
        if (requestId !== state.requestId) return;
        status.textContent = problem.message;
        status.appendChild(button("Try again", "community-button secondary", () => loadPosts(reset)));
    }
}

function linkedPostId() {
    const match = location.hash.match(/^#post-(\d+)$/);
    return match ? Number(match[1]) : null;
}

// Links from report emails point at one post, which may not be on the first page
async function showLinkedPost(id, container) {
    try {
        const data = await api(`/api/posts?id=${id}`);
        if (data.posts.length === 0) return;

        const card = buildPost(data.posts[0]);
        card.classList.add("post-linked");
        container.prepend(card);
        requestAnimationFrame(() => card.scrollIntoView({block: "center"}));
    } catch {
        // The linked post may be gone; fall back to the normal feed
    }
}

/* ---------- Init ---------- */

document.addEventListener("click", closeMenus);

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("loadMore").addEventListener("click", () => loadPosts(false));

    try {
        const [config, me] = await Promise.all([api("/api/config"), api("/api/me")]);
        state.config = config;
        state.user = me.user;
    } catch (problem) {
        document.getElementById("feedStatus").textContent = problem.message;
        return;
    }

    state.config.categories.forEach(name => state.counts[name] = 0);
    renderSidebar();
    renderAuth();
    loadPosts(true);
});
