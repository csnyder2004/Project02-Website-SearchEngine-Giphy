/* ===== Vols GIF Search - main.js =====
   - Search + "Vols" quick action
   - Sort (relevance | recent)
   - Skeleton loaders + pagination
   - Favorites drawer (localStorage)
   - Settings dialog for API key (localStorage)
   - Home / Docs / Favorites nav wired
====================================== */

/* ========== CONFIG ========== */

const DEFAULT_API_KEY = 'uUe03wef0NF4O2AYn9ZS8eZbGanXydbN'; 

const DEFAULT_LIMIT = 24;

/* ========== DOM HELPERS ========== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ========== DOM HOOKS ========== */
const searchForm = $('#searchForm');
const searchInput = $('#searchInput');

const resultsEl = $('#results');
const resultCountEl = $('#resultCount');
const sortRelevantBtn = $('#sortRelevant');
const sortRecentBtn = $('#sortRecent');

const navHome = $('#navHome');
const navDocs = $('#navDocs');
const navFavorites = $('#navFavorites');

const btnVols = $('#btnVols');

const settingsDialog = $('#settingsDialog');
const openSettingsLink = $('#openSettings');
const apiKeyInput = $('#apiKeyInput');
const saveApiKeyBtn = $('#saveApiKey');

const gifCardTpl = $('#gif-card-template');
const skeletonTpl = $('#skeleton-card-template');

const favoritesDrawer = $('#favoritesDrawer');
const favList = $('#favList');
const closeFavsBtn = $('#closeFavs');

// Create (or reuse) a Load More button after results
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
const state = {
  mode: 'search',          // 'search'
  query: '',
  limit: DEFAULT_LIMIT,
  sort: 'relevance',       // 'relevance' | 'recent'
  offset: 0,
  totalCount: null,
  isLoading: false,
};

const FAV_KEY = 'GIF_FAVORITES';
const API_KEY_STORAGE = 'GIPHY_API_KEY';

/* ========== API KEY HELPERS ========== */
function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || DEFAULT_API_KEY || '';
}
window.setApiKey = function setApiKey(key) {
  if (typeof key !== 'string' || !key.trim()) return;
  localStorage.setItem(API_KEY_STORAGE, key.trim());
  console.log('✅ GIPHY API key saved.');
};
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
function readFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } }
function writeFavs(arr) { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); }
function isFav(id) { return readFavs().some(x => x.id === id); }
function toggleFav(g) {
  const favs = readFavs();
  const i = favs.findIndex(f => f.id === g.id);
  if (i >= 0) favs.splice(i, 1); else favs.push(g);
  writeFavs(favs);
  renderFavs();
}
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
    const a = document.createElement('a');
    a.href = f.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = f.title || 'Untitled';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => toggleFav({ id: f.id, url: f.url, title: f.title }));
    li.appendChild(a); li.appendChild(removeBtn);
    favList.appendChild(li);
  }
}

/* ========== UI UTILS ========== */
function setBusy(b) {
  state.isLoading = b;
  resultsEl.setAttribute('aria-busy', b ? 'true' : 'false');
  loadMoreBtn.disabled = !!b;
  loadMoreBtn.textContent = b ? 'Loading…' : 'Load more';
}
function clearResults() {
  resultsEl.innerHTML = '';
  state.offset = 0;
  state.totalCount = null;
  hideLoadMore();
  updateResultCount(0, 0, null);
}
function showMessage(msg) {
  resultsEl.querySelector('.notice')?.remove();
  const div = document.createElement('div');
  div.className = 'notice';
  div.textContent = msg;
  resultsEl.appendChild(div);
}
function showSkeletons(n = 8) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const tpl = skeletonTpl.content.cloneNode(true);
    tpl.querySelector('.gif-card').classList.add('is-skeleton');
    frag.appendChild(tpl);
  }
  resultsEl.appendChild(frag);
}
function clearSkeletons() { $$('.gif-card.is-skeleton', resultsEl).forEach(el => el.remove()); }
function showLoadMore() { loadMoreBtn.style.display = 'inline-block'; }
function hideLoadMore() { loadMoreBtn.style.display = 'none'; }
function updateResultCount(showing, offset, total) {
  if (!resultCountEl) return;
  if (typeof total === 'number') resultCountEl.textContent = `Showing ${offset}–${offset + showing} of ${total}`;
  else resultCountEl.textContent = `Showing ${offset}–${offset + showing}`;
}

/* ========== RENDERING ========== */
function renderGifs(gifs, append = false) {
  const frag = document.createDocumentFragment();
  for (const gif of gifs) {
    const imgData =
      gif.images?.fixed_width_downsampled ||
      gif.images?.fixed_width ||
      gif.images?.downsized ||
      gif.images?.original;
    if (!imgData?.url) continue;

    const node = gifCardTpl.content.cloneNode(true);
    const link = node.querySelector('a');
    const img = node.querySelector('img');
    const cap = node.querySelector('.gif-caption');
    const favBtn = node.querySelector('.fav-toggle');

    link.href = gif.url;
    img.src = imgData.url;
    img.alt = gif.title || 'GIF result';
    // reduce layout shift
    if (imgData.width && imgData.height) {
      img.width = parseInt(imgData.width, 10);
      img.height = parseInt(imgData.height, 10);
    }
    cap.textContent = gif.title || 'Untitled';

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
  if (!append) resultsEl.innerHTML = '';
  resultsEl.appendChild(frag);
}

/* ========== DATA FETCH ========== */
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

function sortIfNeeded(data) {
  if (state.sort !== 'recent') return data;
  return data.slice().sort((a, b) => {
    const ad = Date.parse(a.import_datetime || a.trending_datetime || 0) || 0;
    const bd = Date.parse(b.import_datetime || b.trending_datetime || 0) || 0;
    return bd - ad;
  });
}

async function runQuery({ append = false } = {}) {
  if (!requireApiKeyOrPrompt()) return;
  if (!state.query) {
    showMessage('Type a search and press Enter (or use the Vols button).');
    return;
  }

  setBusy(true);
  if (!append) { clearResults(); showSkeletons(Math.max(6, Math.min(12, state.limit))); }

  try {
    const res = await fetch(buildEndpoint());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const raw = Array.isArray(json.data) ? json.data : [];
    const gifs = sortIfNeeded(raw);

    const count = json.pagination?.count ?? gifs.length;
    const total = json.pagination?.total_count ?? null;

    clearSkeletons();
    renderGifs(gifs, append);

    state.offset += count;
    state.totalCount = total;
    updateResultCount(count, state.offset - count, total);

    if (total !== null) {
      if (state.offset < total && count > 0) showLoadMore(); else hideLoadMore();
    } else {
      if (count >= state.limit) showLoadMore(); else hideLoadMore();
    }

    if (!append && gifs.length === 0) {
      showMessage(`No results for “${state.query}”. Try another keyword.`);
    }
  } catch (err) {
    console.error(err);
    clearSkeletons();
    showMessage('Something went wrong fetching results. Please try again.');
    hideLoadMore();
  } finally {
    setBusy(false);
  }
}

/* ========== NAV & UI EVENTS ========== */
// Search submit
searchForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput?.value?.trim() || '';
  if (!q) return;
  state.query = q;
  state.offset = 0;
  runQuery({ append: false });
});

// Sort toggles
sortRelevantBtn?.addEventListener('click', () => {
  if (state.sort === 'relevance') return;
  state.sort = 'relevance';
  sortRelevantBtn.setAttribute('aria-pressed', 'true');
  sortRecentBtn.setAttribute('aria-pressed', 'false');
  state.offset = 0;
  runQuery({ append: false });
});
sortRecentBtn?.addEventListener('click', () => {
  if (state.sort === 'recent') return;
  state.sort = 'recent';
  sortRelevantBtn.setAttribute('aria-pressed', 'false');
  sortRecentBtn.setAttribute('aria-pressed', 'true');
  state.offset = 0;
  runQuery({ append: false });
});

// Load more
loadMoreBtn.addEventListener('click', () => {
  if (state.isLoading) return;
  runQuery({ append: true });
});

// Nav: Home
navHome?.addEventListener('click', (e) => {
  e.preventDefault();
  // Reset UI
  searchInput.value = '';
  state.query = '';
  clearResults();
  searchInput.focus();
});

// Nav: Docs (open GIPHY docs)
navDocs?.addEventListener('click', (e) => {
  e.preventDefault();
  window.open('https://developers.giphy.com/docs/api/endpoint#search', '_blank', 'noopener');
});

// Nav: Favorites
navFavorites?.addEventListener('click', (e) => {
  e.preventDefault();
  openFavoritesDrawer();
});

// Quick action: Vols
btnVols?.addEventListener('click', () => {
  const q = 'Tennessee Volunteers football';
  searchInput.value = q;
  state.query = q;
  state.offset = 0;
  runQuery({ append: false });
});

// Settings dialog open/close/save
openSettingsLink?.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });
function openSettings() {
  apiKeyInput.value = getApiKey();
  if ('showModal' in settingsDialog) settingsDialog.showModal();
  else settingsDialog.setAttribute('open', '');
}
function closeSettings() {
  if ('close' in settingsDialog) settingsDialog.close();
  else settingsDialog.removeAttribute('open');
}
saveApiKeyBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  const val = apiKeyInput.value.trim();
  if (val) localStorage.setItem(API_KEY_STORAGE, val);
  else localStorage.removeItem(API_KEY_STORAGE);
  closeSettings();
});

// Favorites drawer controls
function openFavoritesDrawer() { favoritesDrawer?.setAttribute('aria-hidden', 'false'); renderFavs(); }
closeFavsBtn?.addEventListener('click', () => { favoritesDrawer?.setAttribute('aria-hidden', 'true'); });

// Initial favorites render
renderFavs();
// Convenience
searchInput?.focus();
