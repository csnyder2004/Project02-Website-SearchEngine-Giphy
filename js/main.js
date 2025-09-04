/* ===== Vols GIF Search - main.js =====
   - Search + "Vols" quick action
   - Sort (relevance | recent)
   - Skeleton loaders + pagination
   - Favorites drawer (localStorage)
   - Settings dialog for API key (localStorage)
   - Home / Docs / Favorites nav wired
====================================== */

/* ========== CONFIG ========== */
// ⚙️ Defaults for API and pagination
const DEFAULT_API_KEY = 'uUe03wef0NF4O2AYn9ZS8eZbGanXydbN'; 
const DEFAULT_LIMIT = 24;

/* ========== DOM HELPERS ========== */
// 🔎 Query helpers
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ========== DOM HOOKS ========== */
// 🔤 Search form + input
const searchForm = $('#searchForm');
const searchInput = $('#searchInput');

// 🧱 Results grid + status
const resultsEl = $('#results');
const resultCountEl = $('#resultCount');
const sortRelevantBtn = $('#sortRelevant');
const sortRecentBtn = $('#sortRecent');

// 🧭 Top nav
const navHome = $('#navHome');
const navDocs = $('#navDocs');
const navFavorites = $('#navFavorites');

// 🟠 Quick action: “Vols”
const btnVols = $('#btnVols');

// ⚙️ Settings dialog + API key controls
const settingsDialog = $('#settingsDialog');
const openSettingsLink = $('#openSettings');
const apiKeyInput = $('#apiKeyInput');
const saveApiKeyBtn = $('#saveApiKey');

// 🧩 Templates for cards/skeletons
const gifCardTpl = $('#gif-card-template');
const skeletonTpl = $('#skeleton-card-template');

// ⭐ Favorites drawer elements
const favoritesDrawer = $('#favoritesDrawer');
const favList = $('#favList');
const closeFavsBtn = $('#closeFavs');

// ⬇️ Create (or reuse) a Load More button after results
let loadMoreBtn = $('#loadMoreBtn');
if (!loadMoreBtn) {
  loadMoreBtn = document.createElement('button');
  loadMoreBtn.id = 'loadMoreBtn';
  loadMoreBtn.type = 'button';
  loadMoreBtn.textContent = 'Load more';
  loadMoreBtn.setAttribute('aria-label', 'Load more search results');
  loadMoreBtn.style.display = 'none';
  resultsEl.insertAdjacentElement('afterend', loadMoreBtn);
}

/* ========== STATE ========== */
// 🧠 Runtime state for the search session
const state = {
  mode: 'search',          // 'search'
  query: '',               // current query string
  limit: DEFAULT_LIMIT,    // page size
  sort: 'relevance',       // 'relevance' | 'recent'
  offset: 0,               // for pagination
  totalCount: null,        // server-reported total (if any)
  isLoading: false,        // UI busy flag
};

// 🔑 LocalStorage keys
const FAV_KEY = 'GIF_FAVORITES';
const API_KEY_STORAGE = 'GIPHY_API_KEY';

/* ========== API KEY HELPERS ========== */
// 🔑 Resolve API key from localStorage, fallback to default
function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY || '';
}

// 🔑 Exposed helper to set the API key programmatically
window.setApiKey = function setApiKey(key) {
  if (typeof key !== 'string' || !key.trim()) return;
  localStorage.setItem(API_KEY_STORAGE, key.trim());
  console.log('✅ GIPHY API key saved.');
};

// 🔑 Ensure we have a key; otherwise prompt Settings
function requireApiKeyOrPrompt() {
  const key = getApiKey();
  if (!key) {
    showMessage('No GIPHY API key found. Open Settings to add one, or embed it in main.js.');
    openSettings();
    return false;
  }
  return true;
}

/* ========== FAVORITES ========== */
// 📖 Read favorites from localStorage (robust to parse errors)
function readFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } }

// ✍️ Write favorites to localStorage
function writeFavs(arr) { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); }

// ❓ Check if a GIF id is currently favorited
function isFav(id) { return readFavs().some(x => x.id === id); }

// 🔁 Toggle favorite for a given GIF summary {id,url,title}
function toggleFav(g) {
  const favs = readFavs();
  const i = favs.findIndex(f => f.id === g.id);
  if (i >= 0) favs.splice(i, 1); else favs.push(g);
  writeFavs(favs);
  renderFavs();
}

// 🎛️ Render the favorites drawer list
function renderFavs() {
  const favs = readFavs();
  favList.innerHTML = '';
  if (!favs.length) {
    const li = document.createElement('li');
    li.className = 'small';
    li.textContent = 'No favorites yet.';
    favList.appendChild(li);
    return;
  }
  for (const f of favs) {
    const li = document.createElement('li');

    // Link to the GIF on GIPHY
    const a = document.createElement('a');
    a.href = f.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = f.title || 'Untitled';

    // Remove button to un-favorite
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => toggleFav({ id: f.id, url: f.url, title: f.title }));

    li.appendChild(a); 
    li.appendChild(removeBtn);
    favList.appendChild(li);
  }
}

/* ========== UI UTILS ========== */
// 🚦 Set busy state for grid + Load More button
function setBusy(b) {
  state.isLoading = b;
  resultsEl.setAttribute('aria-busy', b ? 'true' : 'false');
  loadMoreBtn.disabled = !!b;
  loadMoreBtn.textContent = b ? 'Loading…' : 'Load more';
}

// 🧹 Clear grid + reset counters
function clearResults() {
  resultsEl.innerHTML = '';
  state.offset = 0;
  state.totalCount = null;
  hideLoadMore();
  updateResultCount(0, 0, null);
}

// 💬 Show a notice/message inside the results area
function showMessage(msg) {
  resultsEl.querySelector('.notice')?.remove();
  const div = document.createElement('div');
  div.className = 'notice';
  div.textContent = msg;
  resultsEl.appendChild(div);
}

// 🦴 Add skeleton placeholders
function showSkeletons(n = 8) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const tpl = skeletonTpl.content.cloneNode(true);
    tpl.querySelector('.gif-card').classList.add('is-skeleton');
    frag.appendChild(tpl);
  }
  resultsEl.appendChild(frag);
}

// 🧽 Remove skeletons
function clearSkeletons() { $$('.gif-card.is-skeleton', resultsEl).forEach(el => el.remove()); }

// 👇/👆 Load More visibility toggles
function showLoadMore() { loadMoreBtn.style.display = 'inline-block'; }
function hideLoadMore() { loadMoreBtn.style.display = 'none'; }

// 🔢 Update “Showing X–Y of Z” label
function updateResultCount(showing, offset, total) {
  if (!resultCountEl) return;
  if (typeof total === 'number') resultCountEl.textContent = `Showing ${offset}–${offset + showing} of ${total}`;
  else resultCountEl.textContent = `Showing ${offset}–${offset + showing}`;
}

/* ========== RENDERING ========== */
// 🖼️ Render GIF cards into the grid
function renderGifs(gifs, append = false) {
  const frag = document.createDocumentFragment();

  for (const gif of gifs) {
    // Pick the best available image rendition
    const imgData =
      gif.images?.fixed_width_downsampled ||
      gif.images?.fixed_width ||
      gif.images?.downsized ||
      gif.images?.original;
    if (!imgData?.url) continue;

    // Clone template and wire up elements
    const node = gifCardTpl.content.cloneNode(true);
    const link = node.querySelector('a');
    const img = node.querySelector('img');
    const cap = node.querySelector('.gif-caption');
    const favBtn = node.querySelector('.fav-toggle');

    // Link to GIPHY page
    link.href = gif.url;

    // Image src/alt and intrinsic size to reduce CLS
    img.src = imgData.url;
    img.alt = gif.title || 'GIF result';
    if (imgData.width && imgData.height) {
      img.width = parseInt(imgData.width, 10);
      img.height = parseInt(imgData.height, 10);
    }

    // Caption text
    cap.textContent = gif.title || 'Untitled';

    // Favorite toggle state + behavior
    const summary = { id: gif.id, url: gif.url, title: gif.title || 'Untitled' };
    if (isFav(gif.id)) favBtn.classList.add('is-fav');
    favBtn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleFav(summary);
      favBtn.classList.toggle('is-fav', isFav(gif.id));
      openFavoritesDrawer();
    });

    frag.appendChild(node);
  }

  // If not appending, replace the grid
  if (!append) resultsEl.innerHTML = '';
  resultsEl.appendChild(frag);
}

/* ========== DATA FETCH ========== */
// 🌐 Build the GIPHY search endpoint with API key + query + pagination
function buildEndpoint() {
  const apiKey = getApiKey();
  const base = 'https://api.giphy.com/v1/gifs/search';
  const params = new URLSearchParams({
    api_key: apiKey,
    q: state.query,
    limit: String(state.limit),
    offset: String(state.offset),
  });
  return `${base}?${params.toString()}`;
}

// 🗂️ Sort helper (applies only when sort = 'recent')
function sortIfNeeded(data) {
  if (state.sort !== 'recent') return data;
  return data.slice().sort((a, b) => {
    const ad = Date.parse(a.import_datetime || a.trending_datetime || 0) || 0;
    const bd = Date.parse(b.import_datetime || b.trending_datetime || 0) || 0;
    return bd - ad;
  });
}

// 🔁 Core fetch → render routine with skeletons, pagination, error handling
async function runQuery({ append = false } = {}) {
  if (!requireApiKeyOrPrompt()) return;

  // Guard for empty query
  if (!state.query) {
    showMessage('Type a search and press Enter (or use the Vols button).');
    return;
  }

  // Enter busy mode and show skeletons for fresh loads
  setBusy(true);
  if (!append) { 
    clearResults(); 
    showSkeletons(Math.max(6, Math.min(12, state.limit))); 
  }

  try {
    // Fetch data
    const res = await fetch(buildEndpoint());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // Parse payload and normalize to array
    const json = await res.json();
    const raw = Array.isArray(json.data) ? json.data : [];

    // Optional sort (recent)
    const gifs = sortIfNeeded(raw);

    // Pagination bookkeeping from API
    const count = json.pagination?.count ?? gifs.length;
    const total = json.pagination?.total_count ?? null;

    // Swap in real cards
    clearSkeletons();
    renderGifs(gifs, append);

    // Update offsets + counters
    state.offset += count;
    state.totalCount = total;
    updateResultCount(count, state.offset - count, total);

    // Show/hide Load More based on total/limit
    if (total !== null) {
      if (state.offset < total && count > 0) showLoadMore(); else hideLoadMore();
    } else {
      if (count >= state.limit) showLoadMore(); else hideLoadMore();
    }

    // Empty state message for fresh loads
    if (!append && gifs.length === 0) {
      showMessage(`No results for “${state.query}”. Try another keyword.`);
    }
  } catch (err) {
    console.error(err);
    clearSkeletons();
    showMessage('Something went wrong fetching results. Please try again.');
    hideLoadMore();
  } finally {
    // Always leave busy mode
    setBusy(false);
  }
}

/* ========== NAV & UI EVENTS ========== */
// 🔍 Search submit → set query, reset offset, run
searchForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput?.value?.trim() || '';
  if (!q) return;
  state.query = q;
  state.offset = 0;
  runQuery({ append: false });
});

// ↕️ Sort toggles (relevance)
sortRelevantBtn?.addEventListener('click', () => {
  if (state.sort === 'relevance') return;
  state.sort = 'relevance';
  sortRelevantBtn.setAttribute('aria-pressed', 'true');
  sortRecentBtn.setAttribute('aria-pressed', 'false');
  state.offset = 0;
  runQuery({ append: false });
});

// ↕️ Sort toggles (recent)
sortRecentBtn?.addEventListener('click', () => {
  if (state.sort === 'recent') return;
  state.sort = 'recent';
  sortRelevantBtn.setAttribute('aria-pressed', 'false');
  sortRecentBtn.setAttribute('aria-pressed', 'true');
  state.offset = 0;
  runQuery({ append: false });
});

// ➕ “Load more” pagination
loadMoreBtn.addEventListener('click', () => {
  if (state.isLoading) return;
  runQuery({ append: true });
});

// 🏠 Nav: Home → reset UI + focus search
navHome?.addEventListener('click', (e) => {
  e.preventDefault();
  // Reset UI
  searchInput.value = '';
  state.query = '';
  clearResults();
  searchInput.focus();
});

// 📚 Nav: Docs → open GIPHY docs
navDocs?.addEventListener('click', (e) => {
  e.preventDefault();
  window.open('https://developers.giphy.com/docs/api/endpoint#search', '_blank', 'noopener');
});

// ⭐ Nav: Favorites → open drawer
navFavorites?.addEventListener('click', (e) => {
  e.preventDefault();
  openFavoritesDrawer();
});

// 🟠 Quick action: Vols (pre-fills query)
btnVols?.addEventListener('click', () => {
  const q = 'Tennessee Volunteers football';
  searchInput.value = q;
  state.query = q;
  state.offset = 0;
  runQuery({ append: false });
});

// ⚙️ Settings dialog open/close/save
openSettingsLink?.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });

// Show settings (dialog or fallback)
function openSettings() {
  apiKeyInput.value = getApiKey();
  if ('showModal' in settingsDialog) settingsDialog.showModal();
  else settingsDialog.setAttribute('open', '');
}

// Close settings (dialog or fallback)
function closeSettings() {
  if ('close' in settingsDialog) settingsDialog.close();
  else settingsDialog.removeAttribute('open');
}

// Save API key from input (or clear)
saveApiKeyBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  const val = apiKeyInput.value.trim();
  if (val) localStorage.setItem(API_KEY_STORAGE, val);
  else localStorage.removeItem(API_KEY_STORAGE);
  closeSettings();
});

// ⭐ Favorites drawer controls
function openFavoritesDrawer() { favoritesDrawer?.setAttribute('aria-hidden', 'false'); renderFavs(); }
closeFavsBtn?.addEventListener('click', () => { favoritesDrawer?.setAttribute('aria-hidden', 'true'); });

// 🚀 Initial favorites render + focus convenience
renderFavs();
// Convenience
searchInput?.focus();
