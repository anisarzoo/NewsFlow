import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, getDoc, serverTimestamp, query, orderBy, where, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// SVG Icons
const ICON_UP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>`;
const ICON_DOWN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
const ICON_REMOVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
const ICON_TEXT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
const ICON_IMAGE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
const ICON_VIDEO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;

// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const googleLoginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const articleFormContainer = document.getElementById('article-form-container');
const articleForm = document.getElementById('article-form');
const articlesList = document.getElementById('articles-list');
const createArticleBtn = document.getElementById('create-article-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const contentBlocksContainer = document.getElementById('content-blocks-container');
const backBtn = document.getElementById('back-btn');
const searchInput = document.getElementById('admin-search-input');

// Search Logic
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const articles = document.querySelectorAll('.admin-article-item');
    let visibleCount = 0;

    // Create or find no-results message
    let noResultsMsg = document.getElementById('search-no-results');
    if (!noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.id = 'search-no-results';
        noResultsMsg.style.textAlign = 'center';
        noResultsMsg.style.padding = '2rem';
        noResultsMsg.style.color = 'var(--text-muted)';
        noResultsMsg.textContent = 'No matching articles found.';
        noResultsMsg.style.display = 'none';
        document.getElementById('articles-list').appendChild(noResultsMsg);
    }

    articles.forEach(article => {
        const titleEl = article.querySelector('strong');
        if (titleEl) {
            const title = titleEl.textContent.toLowerCase();
            if (title.includes(term)) {
                article.style.setProperty('display', 'flex', 'important');
                visibleCount++;
            } else {
                article.style.setProperty('display', 'none', 'important');
            }
        }
    });

    noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
});

// Helper to toggle views
// Helper to toggle views
function toggleView(view) {
    const searchContainer = document.querySelector('.search-container');
    const filterContainer = document.querySelector('.filter-container'); // Add this

    if (view === 'form') {
        articlesList.style.display = 'none';
        if (searchContainer) searchContainer.style.display = 'none';
        if (filterContainer) filterContainer.style.display = 'none'; // Hide filters
        articleFormContainer.classList.remove('hidden');
        createArticleBtn.style.display = 'none';
        backBtn.style.display = 'inline-block';
    } else {
        articlesList.style.display = 'block';
        if (searchContainer) searchContainer.style.display = 'block';
        if (filterContainer) filterContainer.style.display = 'flex'; // Show filters (flex)
        articleFormContainer.classList.add('hidden');
        createArticleBtn.style.display = 'inline-block';
        backBtn.style.display = 'none';
    }
}

// Auth State Listener
const ALLOWED_ADMIN_IDS = ["KvgaucrF9GdnXMbX4MtijnYrFYp2", "DWs7CpYdY4gaVwPwLPHdeBAnHDE3"];

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (ALLOWED_ADMIN_IDS.includes(user.uid)) {
            loginSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            logoutBtn.style.display = 'inline-block';

            // Check for edit param
            const urlParams = new URLSearchParams(window.location.search);
            const editId = urlParams.get('edit');

            if (editId) {
                // Auto-load editor
                loadArticles().then(() => {
                    editArticle(editId);
                });
            } else {
                loadArticles();
            }
        } else {
            showToast("Access Denied: You are not authorized to view this page.", 'error');
            signOut(auth);
        }
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
});

// Login with Google
googleLoginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    const errorMsg = document.getElementById('login-error');

    signInWithPopup(auth, provider)
        .then((result) => {
            errorMsg.textContent = '';
        })
        .catch((error) => {
            console.error("Login failed", error);
            errorMsg.textContent = "Login failed: " + error.message;
        });
});

// Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        console.log('Signed out');
    }).catch((error) => {
        console.error('Sign out error', error);
    });
});

// Generate Slug
// Main Image Upload Logic
const mainImageUpload = document.getElementById('main-image-upload');
if (mainImageUpload) {
    mainImageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const urlInput = document.getElementById('article-image');
        const statusDiv = document.getElementById('main-image-status');
        const preview = document.getElementById('main-image-preview');

        statusDiv.textContent = 'Uploading...';
        urlInput.disabled = true;

        try {
            const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            urlInput.value = downloadURL;
            statusDiv.textContent = 'Upload Complete!';
            statusDiv.style.color = '#10b981'; // Success Green
            preview.innerHTML = `<img src="${downloadURL}">`;

        } catch (error) {
            console.error("Upload failed", error);
            statusDiv.textContent = 'Upload Failed: ' + error.message;
            statusDiv.style.color = '#ef4444'; // Error Red
        } finally {
            urlInput.disabled = false;
        }
    });
}

// Main Image URL Preview
const mainImageInput = document.getElementById('article-image');
if (mainImageInput) {
    mainImageInput.addEventListener('change', (e) => {
        const url = e.target.value;
        const preview = document.getElementById('main-image-preview');
        if (url) {
            preview.innerHTML = `<img src="${url}">`;
        } else {
            preview.innerHTML = '';
        }
    });
}

function generateSlug(text) {
    return text.toString().toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-')   // Replace multiple - with single -
        .replace(/^-+/, '')       // Trim - from start of text
        .replace(/-+$/, '');      // Trim - from end of text
}

// Block Editor Logic
function createBlockElement(type, content = '') {
    const block = document.createElement('div');
    block.className = 'content-block';
    block.dataset.type = type;

    const header = document.createElement('div');
    header.className = 'block-header';
    header.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            ${type === 'text' ? ICON_TEXT : type === 'image' ? ICON_IMAGE : ICON_VIDEO}
            <span>${type.toUpperCase()} BLOCK</span>
        </div>
        <div class="block-controls">
            <button type="button" class="btn-ctrl" onclick="moveBlock(this, -1)" title="Move Up">${ICON_UP}</button>
            <button type="button" class="btn-ctrl" onclick="moveBlock(this, 1)" title="Move Down">${ICON_DOWN}</button>
            <button type="button" class="btn-ctrl remove" onclick="removeBlock(this)" title="Remove">${ICON_REMOVE}</button>
        </div>
    `;

    const body = document.createElement('div');
    body.className = 'block-body';

    if (type === 'text') {
        // Use contenteditable div instead of textarea for rich text preview (links, bold)
        body.innerHTML = `<div class="block-input-rich" contenteditable="true" placeholder="Enter text here...">${content}</div>`;
    } else if (type === 'image') {
        body.innerHTML = `
            <div class="image-upload-controls" style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                <input type="text" class="block-input url-input" placeholder="Image URL" value="${content}" onchange="updatePreview(this)" style="margin-bottom:0;">
                <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">OR</span>
                <label class="btn-primary" style="font-size:0.8rem; padding: 8px 12px; cursor:pointer;">
                    Upload File
                    <input type="file" class="file-input" accept="image/*" onchange="handleFileUpload(this)" style="display:none;">
                </label>
            </div>
            <div class="block-preview">${content ? `<img src="${content}">` : ''}</div>
            <div class="upload-status" style="font-size:0.8rem; color:var(--secondary); font-weight:600; margin-top:5px;"></div>
        `;
    } else if (type === 'video') {
        body.innerHTML = `
             <div class="video-upload-controls" style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                <input type="text" class="block-input url-input" placeholder="Video URL (YouTube/MP4)" value="${content}" onchange="updatePreview(this, 'video')" style="margin-bottom:0;">
                 <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">OR</span>
                <label class="btn-primary" style="font-size:0.8rem; padding: 8px 12px; cursor:pointer;">
                    Upload File
                    <input type="file" class="file-input" accept="video/*" onchange="handleFileUpload(this, 'video')" style="display:none;">
                </label>
            </div>
            <div class="block-preview">${content ? renderVideoPreview(content) : ''}</div>
            <div class="upload-status" style="font-size:0.8rem; color:var(--secondary); font-weight:600; margin-top:5px;"></div>
        `;
    }

    block.appendChild(header);
    block.appendChild(body);
    return block;
}

function renderVideoPreview(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let embedUrl = url;
        if (url.includes('watch?v=')) {
            const vId = url.split('v=')[1].split('&')[0];
            embedUrl = `https://www.youtube.com/embed/${vId}`;
        } else if (url.includes('youtu.be/')) {
            const vId = url.split('youtu.be/')[1].split('?')[0];
            embedUrl = `https://www.youtube.com/embed/${vId}`;
        }
        return `<iframe src="${embedUrl}" frameborder="0" allowfullscreen style="width:100%; height:200px;"></iframe>`;
    } else {
        return `<video src="${url}" controls style="width:100%; max-height:200px;"></video>`;
    }
}

window.moveBlock = (btn, direction) => {
    const block = btn.closest('.content-block');
    const container = document.getElementById('content-blocks-container');
    if (direction === -1 && block.previousElementSibling) {
        container.insertBefore(block, block.previousElementSibling);
    } else if (direction === 1 && block.nextElementSibling) {
        container.insertBefore(block.nextElementSibling, block);
    }
};

window.removeBlock = (btn) => {
    const block = btn.closest('.content-block');
    const parent = block.parentNode;
    const nextSibling = block.nextElementSibling;

    // Remove immediately
    block.remove();

    showToast('Block deleted', 'success', {
        label: 'Undo',
        callback: () => {
            // Restore block
            if (nextSibling) {
                parent.insertBefore(block, nextSibling);
            } else {
                parent.appendChild(block);
            }
        }
    });
};

window.updatePreview = (input, type = 'image') => {
    // Find preview div relative to input
    const blockBody = input.closest('.block-body');
    const preview = blockBody.querySelector('.block-preview');
    const url = input.value;

    if (!url) {
        preview.innerHTML = '';
        return;
    }
    if (type === 'image') {
        preview.innerHTML = `<img src="${url}">`;
    } else {
        preview.innerHTML = renderVideoPreview(url);
    }
};

window.handleFileUpload = async (fileInput, type = 'image') => {
    const file = fileInput.files[0];
    if (!file) return;

    const blockBody = fileInput.closest('.block-body');
    const urlInput = blockBody.querySelector('.url-input');
    const statusDiv = blockBody.querySelector('.upload-status');
    const preview = blockBody.querySelector('.block-preview');

    statusDiv.textContent = 'Uploading...';
    fileInput.disabled = true;

    try {
        const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        urlInput.value = downloadURL;
        statusDiv.textContent = 'Upload Complete!';

        if (type === 'image') {
            preview.innerHTML = `<img src="${downloadURL}">`;
        } else {
            preview.innerHTML = renderVideoPreview(downloadURL);
        }

    } catch (error) {
        console.error("Upload failed", error);
        statusDiv.textContent = 'Upload Failed: ' + error.message;
        statusDiv.style.color = 'red';
    } finally {
        fileInput.disabled = false;
    }
};

document.getElementById('add-text-btn').addEventListener('click', () => {
    contentBlocksContainer.appendChild(createBlockElement('text'));
});
document.getElementById('add-image-btn').addEventListener('click', () => {
    contentBlocksContainer.appendChild(createBlockElement('image'));
});
document.getElementById('add-video-btn').addEventListener('click', () => {
    contentBlocksContainer.appendChild(createBlockElement('video'));
});


// Show Create Form
createArticleBtn.addEventListener('click', () => {
    toggleView('form');
    document.getElementById('form-title').textContent = 'Create Article';
    articleForm.reset();
    document.getElementById('article-id').value = '';
    document.getElementById('import-url').value = '';
    document.getElementById('main-image-preview').innerHTML = '';
    contentBlocksContainer.innerHTML = ''; // Clear blocks
    // Add one default text block
    contentBlocksContainer.appendChild(createBlockElement('text'));
});

// Back / Cancel
backBtn.addEventListener('click', () => {
    toggleView('list');
    articleForm.reset();
});

cancelEditBtn.addEventListener('click', () => {
    toggleView('list');
    articleForm.reset();
});

// Main Image Preview Listener
// Main Image Preview Listener (Already declared above, removing duplicate declaration)
// Just ensure the event listeners are attached if not already
if (mainImageInput) {
    mainImageInput.addEventListener('input', (e) => {
        const url = e.target.value;
        const preview = document.getElementById('main-image-preview');
        if (url) {
            preview.innerHTML = `<img src="${url}">`;
        } else {
            preview.innerHTML = '';
        }
    });
    // Trigger on change as well for pasted values
    mainImageInput.addEventListener('change', (e) => {
        mainImageInput.dispatchEvent(new Event('input'));
    });
}

// Smart Publish Fetch Logic
const fetchUrlBtn = document.getElementById('fetch-url-btn');

document.getElementById('import-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        fetchUrlBtn.click();
    }
});

// Load Readability Dynamically
function loadReadability() {
    return new Promise((resolve, reject) => {
        if (window.Readability) return resolve();

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@mozilla/readability@0.5.0/Readability.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

fetchUrlBtn.addEventListener('click', async () => {
    const url = document.getElementById('import-url').value;
    if (!url) {
        showToast('Please enter a URL', 'error');
        return;
    }

    fetchUrlBtn.textContent = 'Initialising...';
    fetchUrlBtn.disabled = true;

    try {
        await loadReadability();
        fetchUrlBtn.textContent = 'Fetching...';

        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");

        // Base URI fix for relative links
        const base = doc.createElement('base');
        base.href = url;
        doc.head.appendChild(base);

        // Check for Readability
        if (!window.Readability) {
            throw new Error("Readability library failed to load");
        }

        const reader = new window.Readability(doc);
        const article = reader.parse();

        if (!article) {
            throw new Error("Could not parse article content");
        }

        // Populate Fields
        document.getElementById('article-title').value = article.title || '';

        // Try to find a high-res image from OG tags if Readability didn't find a good one/or to augment
        const ogImage = doc.querySelector('meta[property="og:image"]')?.content;
        mainImageInput.value = ogImage || '';
        mainImageInput.dispatchEvent(new Event('input'));

        // Clear Blocks
        contentBlocksContainer.innerHTML = '';

        // Process Content
        // Readability returns HTML string in article.content
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = article.content;

        // Reuse our block logic on this clean HTML
        const processNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                // We barely get pure text nodes at top level from Readability, mostly p tags
                if (text.length > 20) {
                    contentBlocksContainer.appendChild(createBlockElement('text', `<p>${text}</p>`));
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();

                if (tagName === 'img') {
                    const src = node.getAttribute('src');
                    if (src && src.startsWith('http')) {
                        // Double Image Fix: Check if this is the same as the main image we just set
                        if (src !== mainImageInput.value) {
                            contentBlocksContainer.appendChild(createBlockElement('image', src));
                        }
                    }
                } else if (tagName === 'iframe' || tagName === 'video') {
                    const src = node.getAttribute('src');
                    if (src) contentBlocksContainer.appendChild(createBlockElement('video', src));
                } else if (['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote'].includes(tagName)) {
                    // Check if it contains ONLY an image
                    const images = node.getElementsByTagName('img');
                    if (images.length === 1 && node.innerText.trim().length < 5) {
                        const src = images[0].getAttribute('src');
                        // Double Image Fix: Check if duplicates main image
                        if (src && src !== mainImageInput.value) {
                            contentBlocksContainer.appendChild(createBlockElement('image', src));
                        }
                    } else {
                        // Keep formatting for text blocks, but STRIP the main image if it exists inside
                        const images = node.getElementsByTagName('img');
                        for (let i = images.length - 1; i >= 0; i--) {
                            const src = images[i].getAttribute('src');
                            if (src && (src === mainImageInput.value || src.includes(mainImageInput.value) || mainImageInput.value.includes(src))) {
                                images[i].remove();
                            }
                        }
                        // Only add if there is still content left
                        if (node.innerText.trim().length > 0 || node.getElementsByTagName('img').length > 0 || node.getElementsByTagName('iframe').length > 0) {
                            contentBlocksContainer.appendChild(createBlockElement('text', node.outerHTML));
                        }
                    }
                } else if (tagName === 'div' || tagName === 'section') {
                    node.childNodes.forEach(child => processNode(child));
                }
            }
        };

        contentDiv.childNodes.forEach(child => processNode(child));

        // Add Source Attribution
        const domain = new URL(url).hostname.replace('www.', '');
        const attributionHtml = `<p><em>Source: <a href="${url}" target="_blank">${article.siteName || domain}</a></em></p>`;
        contentBlocksContainer.appendChild(createBlockElement('text', attributionHtml));

        showToast('Article imported successfully!', 'success');

    } catch (error) {
        console.error('Error fetching URL:', error);
        showToast('Failed to fetch content. ' + error.message, 'error');
    } finally {
        fetchUrlBtn.textContent = 'Fetch';
        fetchUrlBtn.disabled = false;
    }
});


// Create or Update Article
articleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('article-title').value;
    const image = document.getElementById('article-image').value;
    const id = document.getElementById('article-id').value;
    const slug = generateSlug(title);

    // Gather Blocks
    const blocks = [];
    document.querySelectorAll('.content-block').forEach(block => {
        const type = block.dataset.type;
        let content = '';
        if (type === 'text') {
            // Get innerHTML for rich text
            content = block.querySelector('.block-input-rich').innerHTML;
        } else {
            const urlInput = block.querySelector('.url-input');
            if (urlInput) content = urlInput.value;
            else content = block.querySelector('input').value;
        }
        if (content && content.trim()) {
            blocks.push({ type, content });
        }
    });

    const status = document.getElementById('article-status').value;
    const category = document.getElementById('article-category').value;
    const dateInput = document.getElementById('article-date').value;

    const articleData = {
        title: title,
        slug: slug,
        imageUrl: image,
        blocks: blocks,
        status: status,
        category: category,
        updatedAt: serverTimestamp()
    };

    // Handle Publish Date
    if (dateInput) {
        articleData.publishedAt = Timestamp.fromDate(new Date(dateInput));
    } else if (status === 'published' && !id) {
        // If creating new published article without specific date, use now
        articleData.publishedAt = serverTimestamp();
    }
    // If editing and no date input, we assume we keep the existing publishedAt (it won't be overwritten because we didn't add it to articleData)

    try {
        if (id) {
            await updateDoc(doc(db, "articles", id), articleData);
            showToast('Article updated successfully!', 'success');
        } else {
            articleData.createdAt = serverTimestamp();
            await addDoc(collection(db, "articles"), articleData);
            showToast('Article created successfully!', 'success');
        }

        toggleView('list');
        articleForm.reset();
        loadArticles();
    } catch (error) {
        console.error("Error saving article: ", error);
        showToast("Error saving article: " + error.message, 'error');
    }
});

// Load Articles
let allArticles = [];
let currentFilter = 'all';

// Filter Buttons Logic
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderArticles();
    });
});

async function loadArticles() {
    articlesList.innerHTML = '<p>Loading articles...</p>';

    try {
        const q = query(collection(db, "articles"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        allArticles = [];
        querySnapshot.forEach((doc) => {
            allArticles.push({ id: doc.id, ...doc.data() });
        });

        renderArticles();

    } catch (error) {
        console.error("Error loading articles:", error);
        articlesList.innerHTML = '<p>Error loading articles.</p>';
    }
}

function renderArticles() {
    articlesList.innerHTML = '';

    let filtered = allArticles;

    if (currentFilter === 'draft') {
        filtered = allArticles.filter(article => article.status === 'draft');
    } else if (currentFilter === 'scheduled') {
        filtered = allArticles.filter(article => article.status !== 'draft' && article.publishedAt && article.publishedAt.seconds * 1000 > Date.now());
    } else if (currentFilter === 'live') {
        filtered = allArticles.filter(article => {
            const isDraft = article.status === 'draft';
            const isScheduled = article.publishedAt && article.publishedAt.seconds * 1000 > Date.now();
            return !isDraft && !isScheduled;
        });
    }

    if (filtered.length === 0) {
        articlesList.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-muted);">No articles found for this category.</div>';
        return;
    }

    filtered.forEach(article => {
        const articleLink = article.slug ? `article.html?s=${article.slug}` : `article.html?id=${article.id}`;
        const div = document.createElement('div');
        div.className = 'admin-article-item';
        let statusBadge = '';

        // Re-calculate status for badge display
        if (article.status === 'draft') {
            statusBadge = '<span style="background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:600;">DRAFT</span>';
        } else if (article.publishedAt && article.publishedAt.seconds * 1000 > Date.now()) {
            statusBadge = '<span style="background:#fff7ed; color:#ea580c; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:600;">SCHEDULED</span>';
        } else {
            statusBadge = '<span style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:600;">LIVE</span>';
        }

        div.innerHTML = `
            <div style="flex: 1; min-width: 0;">
                <strong style="display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${article.title}</strong>
                <div style="display: flex; align-items:center; gap: 12px; font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                    ${statusBadge}
                    <span>/<code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${article.slug || article.id}</code></span>
                </div>
            </div>
            <div class="admin-actions">
                <a href="${articleLink}" target="_blank" class="btn-ctrl" title="View Article">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </a>
                <button class="btn-ctrl" onclick="editArticle('${article.id}')" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-ctrl remove" onclick="deleteArticle('${article.id}')" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
            </div>
        `;
        articlesList.appendChild(div);
    });

    // Re-apply search filter if exists
    if (searchInput.value) {
        searchInput.dispatchEvent(new Event('input'));
    }
}

window.editArticle = async (id) => {
    try {
        const docRef = doc(db, "articles", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('article-id').value = id;
            document.getElementById('article-title').value = data.title;
            const imgVal = data.imageUrl || '';
            document.getElementById('article-image').value = imgVal;
            if (imgVal) {
                document.getElementById('main-image-preview').innerHTML = `<img src="${imgVal}">`;
            } else {
                document.getElementById('main-image-preview').innerHTML = '';
            }

            document.getElementById('article-status').value = data.status || 'published';

            // Format Timestamp to DateTime-Local string (YYYY-MM-DDTHH:MM)
            if (data.publishedAt) {
                const date = new Date(data.publishedAt.seconds * 1000);
                // Adjust to local ISO string considering timezone offset
                date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                document.getElementById('article-date').value = date.toISOString().slice(0, 16);
            } else {
                document.getElementById('article-date').value = '';
            }

            // Set Category
            document.getElementById('article-category').value = data.category || 'Uncategorized';

            // Load Blocks
            contentBlocksContainer.innerHTML = '';
            if (data.blocks && Array.isArray(data.blocks)) {
                data.blocks.forEach(block => {
                    contentBlocksContainer.appendChild(createBlockElement(block.type, block.content));
                });
            } else if (data.content) {
                contentBlocksContainer.appendChild(createBlockElement('text', data.content));
            }

            document.getElementById('form-title').textContent = 'Edit Article';
            toggleView('form');
            window.scrollTo(0, 0);
        } else {
            showToast("Article not found!", 'error');
        }
    } catch (error) {
        console.error("Error fetching article:", error);
    }
};

window.deleteArticle = async (id) => {
    const articleRow = document.querySelector(`.admin-article-item button[onclick="deleteArticle('${id}')"]`).closest('.admin-article-item');

    // Hide immediately (Optimistic UI)
    articleRow.style.display = 'none';

    let isUndone = false;

    // Timer for actual deletion
    const deleteTimer = setTimeout(async () => {
        if (!isUndone) {
            try {
                await deleteDoc(doc(db, "articles", id));
                // Only reload if we are still on the list view? 
                // Actually, since we hid the row, we don't strictly need to reload, 
                // but let's do it to keep state clean or mostly just leave it hidden.
                // Best practice: remove from DOM permanently now.
                articleRow.remove();

                // If we want to refresh the list to be 100% sure of order:
                // loadArticles(); 
            } catch (error) {
                console.error("Error removing document: ", error);
                showToast("Error deleting article.", 'error');
                articleRow.style.display = 'flex'; // Revert on error
            }
        }
    }, 4000); // 4 seconds to undo

    showToast('Article deleted', 'success', {
        label: 'Undo',
        callback: () => {
            isUndone = true;
            clearTimeout(deleteTimer);
            articleRow.style.display = 'flex'; // Show it again
        }
    });
};

function showToast(message, type = 'success', action = null) {
    // Check if container exists, if not create it
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');

    // Inline styles for the toast
    const baseStyles = `
        min-width: 300px;
        padding: 16px;
        border-radius: 8px;
        background: #1f2937;
        color: white;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: center;
        gap: 12px;
        transform: translateX(120%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-left: 4px solid ${type === 'success' ? '#10b981' : '#ef4444'};
    `;

    toast.style.cssText = baseStyles;

    // Icon SVG
    let icon = '';
    if (type === 'success') {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" width="20" height="20"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }

    let actionBtn = '';
    if (action) {
        actionBtn = `<button class="toast-undo-btn">${action.label}</button>`;
    }

    toast.innerHTML = `${icon}<span style="font-size: 0.9rem; font-weight: 500;">${message}</span>${actionBtn}`;

    if (action) {
        const btn = toast.querySelector('.toast-undo-btn');
        btn.onclick = () => {
            action.callback();
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => toast.remove(), 300);
        };
    }

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });

    // Remove after duration (default 3s, or longer if action exists)
    const duration = action ? 4000 : 3000;
    setTimeout(() => {
        if (toast.parentElement) { // Check if not already removed by undo
            toast.style.transform = 'translateX(120%)';
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 400);
        }
    }, duration);
}

