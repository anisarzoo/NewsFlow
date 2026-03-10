import { db, auth } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const ALLOWED_ADMIN_IDS = ["KvgaucrF9GdnXMbX4MtijnYrFYp2", "DWs7CpYdY4gaVwPwLPHdeBAnHDE3"];

const articleTitle = document.getElementById('article-title');
const articleDate = document.getElementById('article-date');
const articleImage = document.getElementById('article-image');
const articleContent = document.getElementById('article-content');

async function loadArticle() {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id');
    const articleSlug = urlParams.get('s');

    if (!articleId && !articleSlug) {
        articleContent.textContent = 'Article not found.';
        return;
    }

    try {
        let article = null;

        let resolvedId = articleId;

        if (articleId) {
            // Direct ID lookup
            const docRef = doc(db, "articles", articleId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) article = docSnap.data();
        } else if (articleSlug) {
            // Slug lookup
            const q = query(collection(db, "articles"), where("slug", "==", articleSlug));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                // Assuming unique slugs, but we take the first match
                const doc = querySnapshot.docs[0];
                article = doc.data();
                resolvedId = doc.id;
            }
        }

        if (article) {
            const date = article.createdAt ? new Date(article.createdAt.seconds * 1000).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            }) : 'Recently Published';

            document.title = `${article.title} | NewsFlow`;

            // Check Admin Auth for Edit Button
            onAuthStateChanged(auth, (user) => {
                if (user && ALLOWED_ADMIN_IDS.includes(user.uid)) {
                    const editBtn = document.createElement('button');
                    editBtn.id = 'live-edit-btn';
                    editBtn.onclick = () => toggleEditMode(resolvedId);
                    editBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit Live
                    `;
                    editBtn.className = 'admin-edit-floating-btn';
                    document.body.appendChild(editBtn);
                }
            });

            // Clean/Update Container
            articleContent.innerHTML = `
                <h1>${article.title}</h1>
                <div class="article-meta">${date}</div>
                ${article.imageUrl ? `
                    <div class="article-header-image">
                        <img src="${article.imageUrl}" alt="${article.title}">
                    </div>
                ` : ''}
                <div id="article-blocks"></div>
            `;

            const blocksContainer = document.getElementById('article-blocks');

            if (article.blocks && Array.isArray(article.blocks)) {
                article.blocks.forEach(block => {
                    const blockWrapper = document.createElement('div');
                    blockWrapper.className = `article-block block-${block.type}`;

                    if (block.type === 'text') {
                        blockWrapper.innerHTML = `<div class="block-text">${block.content}</div>`;
                    } else if (block.type === 'image') {
                        blockWrapper.innerHTML = `<img src="${block.content}" alt="Story Illustration" loading="lazy">`;
                    } else if (block.type === 'video') {
                        // Store original content for saving later
                        blockWrapper.dataset.originalContent = block.content;
                        blockWrapper.innerHTML = renderVideoEmbed(block.content);
                    }

                    blocksContainer.appendChild(blockWrapper);
                });
            } else {
                // Fallback for non-block content
                const blockWrapper = document.createElement('div');
                blockWrapper.className = 'article-block block-text';
                blockWrapper.innerHTML = `<div class="block-text">${article.content || ''}</div>`;
                blocksContainer.appendChild(blockWrapper);
            }

        } else {
            articleContent.textContent = 'Article not found.';
        }
    } catch (error) {
        console.error("Error loading article:", error);
        articleContent.textContent = 'Error loading article.';
    }
}

function renderVideoEmbed(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let embedUrl = url;
        if (url.includes('watch?v=')) {
            const vId = url.split('v=')[1].split('&')[0];
            embedUrl = `https://www.youtube.com/embed/${vId}`;
        } else if (url.includes('youtu.be/')) {
            const vId = url.split('youtu.be/')[1].split('?')[0];
            embedUrl = `https://www.youtube.com/embed/${vId}`;
        }
        return `<div class="video-container" style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden;">
                    <iframe src="${embedUrl}" frameborder="0" allowfullscreen style="position:absolute; top:0; left:0; width:100%; height:100%;"></iframe>
                </div>`;
    } else {
        return `<video src="${url}" controls style="width:100%"></video>`;
    }
}


// Live Edit Logic
let isEditMode = false;
let originalArticleData = null; // To revert cancels

function toggleEditMode(resolvedId) {
    isEditMode = !isEditMode;
    const btn = document.getElementById('live-edit-btn');
    const container = document.getElementById('single-article');
    const title = document.querySelector('.single-article h1');
    const blocks = document.querySelectorAll('.block-text');

    if (isEditMode) {
        // Enable Editing
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Save Changes
        `;
        btn.classList.add('saving');

        container.classList.add('edit-mode');
        title.contentEditable = true;

        // Make text blocks editable
        blocks.forEach(b => b.contentEditable = true);

        // Add Delete Buttons to Blocks
        document.querySelectorAll('.article-block').forEach((block, index) => {
            if (!block.querySelector('.delete-block-btn')) {
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-block-btn';
                delBtn.innerHTML = '×';
                delBtn.onclick = (e) => {
                    if (confirm('Remove this block?')) block.remove();
                };
                block.style.position = 'relative';
                block.appendChild(delBtn);
            }
        });

    } else {
        // Save Changes
        saveLiveChanges(resolvedId);
    }
}

async function saveLiveChanges(docId) {
    const btn = document.getElementById('live-edit-btn');
    btn.textContent = 'Saving...';

    try {
        const newTitle = document.querySelector('.single-article h1').innerText;
        const newBlocks = [];

        // Reconstruct Blocks from DOM
        const blockElements = document.querySelectorAll('#article-blocks .article-block');
        blockElements.forEach(el => {
            if (el.classList.contains('block-text')) {
                newBlocks.push({
                    type: 'text',
                    content: el.querySelector('.block-text').innerHTML
                });
            } else if (el.classList.contains('block-image')) {
                const img = el.querySelector('img');
                newBlocks.push({
                    type: 'image',
                    content: img.src
                });
            } else if (el.classList.contains('block-video')) {
                // For video, we might have lost the original simple URL if we rendered iframe.
                // Best to store original URL in data attribute during render.
                const originalUrl = el.dataset.originalContent;
                if (originalUrl) {
                    newBlocks.push({ type: 'video', content: originalUrl });
                }
            }
        });

        await updateDoc(doc(db, "articles", docId), {
            title: newTitle,
            blocks: newBlocks
        });

        showToast('Changes saved successfully!', 'success');

        // Slight delay to let user see toast before reload
        setTimeout(() => {
            window.location.reload();
        }, 1500);

    } catch (error) {
        console.error("Error saving:", error);
        showToast('Failed to save changes.', 'error');
        btn.innerHTML = 'Save Changes'; // Revert button if failed
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;

    let icon = '';
    if (type === 'success') {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" width="18" height="18"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3" width="18" height="18"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }

    toast.innerHTML = `${icon}<span>${message}</span>`;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 3000);
}



// Initialize
document.addEventListener('DOMContentLoaded', loadArticle);
