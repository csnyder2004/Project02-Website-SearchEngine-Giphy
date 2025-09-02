/* ===== Project 5 - main.js =====
   Minimal client for Giphy Search API with:
   - Form handling
   - Loading + error states
   - Results grid rendering
   - "Load more" pagination
   - Simple API key helper via localStorage
================================= */

/* ========== CONFIG ========== */
// Put your key here temporarily OR call setApiKey('YOUR_KEY') in the console once.
const DEFAULT_API_KEY = ''; // safer to keep this empty and set via setApiKey()

// How many results per page
const PAGE_SIZE = 24;

/* ========== DOM HOOKS ========== */
const form = document.getElementById('searchForm');
const input = document.getElementById('searchInput');
const resultsEl = document.getElementById('results');

// Create (or reuse) a load more button
let loadMoreBtn = document.getElementById('loadMoreBtn');
if (!loadMoreBtn) {
  loadMoreBtn = document.createElement('button');
  loadMoreBtn.id = 'loadMoreBtn';
  loadMoreBtn.type = 'button';
  loadMoreBtn.textContent = 'Load more';
  loadMoreBtn.style.display = 'none'; // hidden until we have results
  // Append after the results grid
  resultsEl?.parentElement?.appendChild(loadMoreBtn);
}

/* ========== STATE ========== */
let currentQuery = '';
let offset = 0;
let isLoading = false;

/* ========== UTILITIES ========== */
function getApiKey() {
  // prefer localStorage so you don't commit your key
  const stored = localStorage.getItem('GIPHY_API_KEY');
  return stored || DEFAULT_API_KEY || '';
}

// Expose a helper so you can run this in DevTools once and not hard-code your key.
window.setApiKey = function setApiKey(key) {
  if (typeof key !== 'string' || !key.trim()) {
    console.warn('setApiKey: please provide a non-empty string.');
    return;
  }
  localStorage.setItem('GIPHY_API_KEY', key.trim());
  console.log('✅ Giphy API key saved to localStorage.');
};

function setLoading(loading) {
  isLoading = loading;
  if (loading) {
    resultsEl.setAttribute('aria-busy', 'true');
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading…';
  } else {
    resultsEl.removeAttribute('aria-busy');
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = 'Load more';
  }
}

function clearResults() {
  resultsEl.innerHTML = '';
  offset = 0;
  loadMoreBtn.style.display = 'none';
}

function showMessage(msg) {
  const div = document.createElement('div');
  div.className = 'notice';
  div.textContent = msg;
  resultsEl.appendChild(div);
}

/* ========== RENDERING ========== */
function renderGifs(gifs) {
  const frag = document.createDocumentFragment();

  gifs.forEach((gif) => {
    // Prefer a fixed width rendition for consistent grid sizing
    const imgData =
      gif.images?.fixed_width_downsampled ||
      gif.images?.fixed_width ||
      gif.images?.downsized ||
      gif.images?.original;

    if (!imgData?.url) return;

    const card = document.createElement('article');
    card.className = 'gif-card';

    const link = document.createElement('a');
    link.href = gif.url; // Giphy permalink
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const img = document.createElement('img');
    img.src = imgData.url;
    img.alt = gif.title || 'GIF result';
    img.loading = 'lazy';
    img.decoding = 'async';

    link.appendChild(img);

    // Optional caption
    const cap = document.createElement('div');
    cap.className = 'gif-caption';
    cap.textContent = gif.title || 'Untitled';

    card.appendChild(link);
    card.appendChild(cap);
    frag.appendChild(card);
  });

  resultsEl.appendChild(frag);
}

/* ========== DATA FETCH ========== */
async function searchGiphy(query, append = false) {
  const apiKey = getApiKey();
  if (!apiKey) {
    alert(
      'No Giphy API key set.\nOpen DevTools and run: setApiKey("YOUR_GIPHY_KEY")\n(You can get one from developers.giphy.com)'
    );
    return;
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    q: query,
    limit: String(PAGE_SIZE),
    offset: String(offset),
    rating: 'pg-13',
    lang: 'en',
  });

  const endpoint = `https://api.giphy.com/v1/gifs/search?${params.toString()}`;

  try {
    setLoading(true);
    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();

    const gifs = Array.isArray(json.data) ? json.data : [];
    if (!append && gifs.length === 0) {
      showMessage(`No results for “${query}”. Try another keyword.`);
      loadMoreBtn.style.display = 'none';
      return;
    }

    renderGifs(gifs);

    // Pagination controls
    const totalCount = json.pagination?.total_count ?? 0;
    const count = json.pagination?.count ?? gifs.length;

    offset += count;

    if (offset < totalCount && count > 0) {
      loadMoreBtn.style.display = 'inline-block';
    } else {
      loadMoreBtn.style.display = 'none';
    }
  } catch (err) {
    console.error(err);
    showMessage('Something went wrong fetching results. Please try again.');
    loadMoreBtn.style.display = 'none';
  } finally {
    setLoading(false);
  }
}

/* ========== EVENTS ========== */
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input?.value?.trim();
  if (!q) return;

  // New search
  clearResults();
  currentQuery = q;
  searchGiphy(currentQuery, /* append */ false);
});

loadMoreBtn.addEventListener('click', () => {
  if (isLoading || !currentQuery) return;
  searchGiphy(currentQuery, /* append */ true);
});

/* ========== OPTIONAL: ENTER TO SEARCH ON PAGE LOAD ========== */
// Focus the search box for convenience
input?.focus();
