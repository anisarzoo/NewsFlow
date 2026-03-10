import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit, startAfter } from "firebase/firestore";

const articlesGrid = document.getElementById('articles-grid');
const loadMoreBtn = document.getElementById('load-more-btn');
const searchInput = document.getElementById('search-input');
const filterChips = document.querySelectorAll('.filter-chip');

let lastVisible = null;
let articlesCache = [];
let currentCategory = 'all';
let searchTerm = '';

// DATE FORMATTER
const formatDate = (dateObj) => {
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// RENDER FUNCTION
function renderArticles(articles, append = false) {
    if (!append) articlesGrid.innerHTML = '';

    if (articles.length === 0 && !append) {
        articlesGrid.innerHTML = '<p>No stories found.</p>';
        return;
    }

    articles.forEach(article => {
        const articleLink = article.slug ? `article.html?s=${article.slug}` : `article.html?id=${article.id}`;

        let date = 'Recent';
        if (article.publishedAt) date = formatDate(new Date(article.publishedAt.seconds * 1000));
        else if (article.createdAt) date = formatDate(new Date(article.createdAt.seconds * 1000));

        const categoryTag = article.category ? `<span class="article-category-tag">${article.category}</span>` : '';

        const articleCard = document.createElement('div');
        articleCard.className = 'article-card';

        articleCard.innerHTML = `
            <a href="${articleLink}" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; height: 100%;">
                <div style="overflow: hidden; height: 220px; background: #e2e8f0; position: relative;">
                        <img src="${article.imageUrl || 'https://via.placeholder.com/400x220?text=News'}" alt="${article.title}">
                        ${categoryTag}
                </div>
                <div class="article-content">
                    <h3>${article.title}</h3>
                    <div class="article-meta">
                        <span>${date}</span>
                    </div>
                </div>
            </a>
        `;
        articlesGrid.appendChild(articleCard);
    });
}

// LOAD ARTICLES
async function loadArticles(isLoadMore = false) {
    // Note: We don't block on search here anymore because we filter cache
    // if (isSearching) return; 

    try {
        let q;
        if (isLoadMore && lastVisible) {
            q = query(collection(db, "articles"), orderBy("publishedAt", "desc"), startAfter(lastVisible), limit(9));
        } else {
            // First load
            q = query(collection(db, "articles"), orderBy("publishedAt", "desc"), limit(9));
        }

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            if (!isLoadMore) articlesGrid.innerHTML = '<p>No news yet. Check back later!</p>';
            loadMoreBtn.classList.add('hidden');
            return;
        }

        // Update cursor
        lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

        // Process docs
        const newArticles = [];
        const now = Date.now();

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Filter Logic (Status/Time)
            if (data.status === 'draft') return;
            if (data.publishedAt && (data.publishedAt.seconds * 1000 > now)) return;

            newArticles.push({ id: doc.id, ...data });
        });

        // Add to cache
        articlesCache = isLoadMore ? [...articlesCache, ...newArticles] : newArticles;

        // Render
        renderArticles(newArticles, isLoadMore);

        // Manage Button State
        if (querySnapshot.docs.length < 9) {
            loadMoreBtn.classList.add('hidden');
        } else {
            loadMoreBtn.classList.remove('hidden');
        }

    } catch (error) {
        console.error("Error loading news:", error);
        // Fallback to createdAt if publishedAt fails (e.g. index missing)
        if (error.message.includes("requires an index")) {
            console.warn("Missing index, falling back to simple query");
            // Minimal fallback logic could go here
        }
    }
}

function applyFilters() {
    let filtered = articlesCache;

    // 1. Filter by Category
    if (currentCategory !== 'all') {
        filtered = filtered.filter(a => a.category && a.category.toLowerCase() === currentCategory.toLowerCase());
    }

    // 2. Filter by Search
    if (searchTerm) {
        filtered = filtered.filter(a => a.title.toLowerCase().includes(searchTerm));
    }

    // Render
    renderArticles(filtered, false);

    // Manage Load More Visibility (Simplified: hide if filtering active to avoid complexity of mixed state)
    if (currentCategory !== 'all' || searchTerm) {
        loadMoreBtn.classList.add('hidden');
    } else {
        if (lastVisible) loadMoreBtn.classList.remove('hidden');
    }
}

// SEARCH HANDLER
searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase();
    applyFilters();
});

// CATEGORY HANDLER
filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
        // Toggle Active Class
        document.querySelector('.filter-chip.active').classList.remove('active');
        chip.classList.add('active');

        // Update State
        currentCategory = chip.dataset.category;
        applyFilters();
    });
});

loadMoreBtn.addEventListener('click', () => loadArticles(true));

// Initial Load
document.addEventListener('DOMContentLoaded', () => loadArticles(false));
