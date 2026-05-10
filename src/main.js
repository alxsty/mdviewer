import DOMPurify from 'dompurify';
import './styles.css';
import 'highlight.js/styles/github-dark.css';

const SETTINGS_KEY = 'md-viewer-v1-settings';
const APP_VERSION = '3.0.0-alpha.1';
const SETTINGS_SCHEMA_VERSION = 4;
const INSTALL_STATE_KEY = 'md-viewer-install-state';
const FILE_BINDING_DB_NAME = 'md-viewer-file-binding';
const FILE_BINDING_DB_VERSION = 1;
const FILE_BINDING_STORE_NAME = 'file-bindings';
const LAST_FILE_BINDING_KEY = 'last-file';
const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  fontFamily: 'system',
  fontSize: 18,
  showLineNumbers: false,
  copyWithLineNumbers: false,
  settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
  sourcePanelOpen: false,
  settingsPanelOpen: false,
  searchCaseSensitive: false,
  searchWholeWords: false
});

const FONT_FAMILIES = Object.freeze({
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  opendyslexic: 'Atkinson Hyperlegible, Verdana, Arial, sans-serif'
});

const VIRTUAL_LINE_HEIGHT_PX = 24.8;
const VIRTUAL_OVERSCAN_LINES = 18;
const MAX_TOAST_LENGTH = 160;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'];
const SEARCH_MIN_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 150;
const TOUCH_RANGE_LONG_PRESS_MS = 520;
const TOUCH_RANGE_MOVE_TOLERANCE_PX = 12;
const SEARCH_EXCLUDE_SELECTOR = '[data-search-exclude=\"true\"], .metadata-card';

const elements = Object.freeze({
  appShell: document.querySelector('#app'),
  settingsbar: document.querySelector('#settingsbar'),
  fileInput: document.querySelector('#fileInput'),
  openFileButton: document.querySelector('#openFileButton'),
  tocToggle: document.querySelector('#tocToggle'),
  tocPanel: document.querySelector('#tocPanel'),
  tocList: document.querySelector('#tocList'),
  showLineNumbersToggle: document.querySelector('#showLineNumbersToggle'),
  linePanelToggle: document.querySelector('#linePanelToggle'),
  sourcePanel: document.querySelector('#sourcePanel'),
  themeToggle: document.querySelector('#themeToggle'),
  settingsToggle: document.querySelector('#settingsToggle'),
  installButton: document.querySelector('#installButton'),
  fontFamilySelect: document.querySelector('#fontFamilySelect'),
  fontSizeInput: document.querySelector('#fontSizeInput'),
  fontSizeOutput: document.querySelector('#fontSizeOutput'),
  copyWithLineNumbersToggle: document.querySelector('#copyWithLineNumbersToggle'),
  markdownBody: document.querySelector('#markdownBody'),
  dropZone: document.querySelector('#dropZone'),
  statusbar: document.querySelector('#statusbar'),
  lineFromInput: document.querySelector('#lineFromInput'),
  lineToInput: document.querySelector('#lineToInput'),
  copyRangeButton: document.querySelector('#copyRangeButton'),
  sourceViewport: document.querySelector('#sourceViewport'),
  sourceSpacer: document.querySelector('#sourceSpacer'),
  sourceItems: document.querySelector('#sourceItems'),
  scrollJumpControls: document.querySelector('#scrollJumpControls'),
  scrollTopButton: document.querySelector('#scrollTopButton'),
  scrollBottomButton: document.querySelector('#scrollBottomButton'),
  appVersion: document.querySelector('#appVersion'),
  searchControl: document.querySelector('#searchControl'),
  searchToggle: document.querySelector('#searchToggle'),
  searchPanel: document.querySelector('#searchPanel'),
  searchInput: document.querySelector('#searchInput'),
  searchCaseToggle: document.querySelector('#searchCaseToggle'),
  searchWholeWordToggle: document.querySelector('#searchWholeWordToggle'),
  searchPrevButton: document.querySelector('#searchPrevButton'),
  searchNextButton: document.querySelector('#searchNextButton'),
  searchCounter: document.querySelector('#searchCounter')
});

const state = {
  settings: loadSettings(),
  worker: null,
  parseRequestId: 0,
  currentFileName: '',
  markdownText: '',
  sourceLines: [],
  selectedLineStart: 1,
  selectedLineEnd: 1,
  selectedBlockElement: null,
  deferredInstallPrompt: null,
  updateReloadPending: false,
  updateAccepted: false,
  headingObserver: null,
  activeHeadingSlug: '',
  frontmatter: null,
  searchOpen: false,
  searchHits: [],
  currentSearchIndex: -1,
  searchDebounceTimer: null,
  previousCurrentSearchHit: null,
  touchRangeAnchorLine: null,
  touchRangeMode: false,
  touchLongPressTimer: null,
  touchPointerStartX: 0,
  touchPointerStartY: 0,
  touchLongPressBlock: null,
  suppressNextMarkdownClick: false,
  fileBindingRestoreInProgress: false,
  currentFileLinked: false
};

const INITIAL_MARKDOWN_BODY_HTML = elements.markdownBody.innerHTML;

function loadSettings() {
  try {
    const rawValue = localStorage.getItem(SETTINGS_KEY);
    if (!rawValue) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsedSettings = JSON.parse(rawValue);
    const migratedSettings = { ...DEFAULT_SETTINGS, ...parsedSettings };

    if (parsedSettings.settingsSchemaVersion !== SETTINGS_SCHEMA_VERSION) {
      migratedSettings.showLineNumbers = DEFAULT_SETTINGS.showLineNumbers;
      migratedSettings.settingsSchemaVersion = SETTINGS_SCHEMA_VERSION;
    }

    return migratedSettings;
  } catch (_error) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function formatBytes(bytes) {
  let value = Number(bytes) || 0;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${BYTE_UNITS[unitIndex]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clampLine(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 1;
  }
  return Math.min(Math.max(parsed, 1), Math.max(state.sourceLines.length, 1));
}

function setStatus(message) {
  const text = String(message || '').trim();
  elements.statusbar.textContent = text.length > MAX_TOAST_LENGTH
    ? `${text.slice(0, MAX_TOAST_LENGTH - 1)}…`
    : text;
}

function setPressedState(button, isPressed, activeLabel, inactiveLabel, activeText, inactiveText) {
  if (!button) {
    return;
  }

  button.classList.toggle('is-active', Boolean(isPressed));
  button.setAttribute('aria-pressed', String(Boolean(isPressed)));
  button.setAttribute('aria-label', isPressed ? activeLabel : inactiveLabel);
  button.title = isPressed ? activeLabel : inactiveLabel;

  if (activeText && inactiveText) {
    button.textContent = isPressed ? activeText : inactiveText;
  }
}

function getThemeIconSvg(isDarkTheme) {
  if (isDarkTheme) {
    return `
      <svg class="icon-svg theme-icon theme-icon-moon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M20.15 15.32a.92.92 0 0 1 .22.96 8.9 8.9 0 0 1-8.32 5.72A9.05 9.05 0 0 1 3 12.95a8.9 8.9 0 0 1 5.72-8.32.92.92 0 0 1 1.18 1.1 7.1 7.1 0 0 0 8.37 8.37.92.92 0 0 1 .88.22ZM12.05 20.15a7.03 7.03 0 0 0 5.68-2.88 8.93 8.93 0 0 1-10.99-11 7.03 7.03 0 0 0-1.89 4.68 7.2 7.2 0 0 0 7.2 7.2Z"/>
      </svg>`;
  }

  return `
    <svg class="icon-svg theme-icon theme-icon-sun" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M12 7.25A4.75 4.75 0 1 0 12 16.75 4.75 4.75 0 0 0 12 7.25Zm0 1.8A2.95 2.95 0 1 1 12 14.95 2.95 2.95 0 0 1 12 9.05Z"/>
      <path d="M12 2.2a.9.9 0 0 1 .9.9v1.3a.9.9 0 1 1-1.8 0V3.1a.9.9 0 0 1 .9-.9ZM12 18.7a.9.9 0 0 1 .9.9v1.3a.9.9 0 1 1-1.8 0v-1.3a.9.9 0 0 1 .9-.9ZM21.8 12a.9.9 0 0 1-.9.9h-1.3a.9.9 0 1 1 0-1.8h1.3a.9.9 0 0 1 .9.9ZM5.3 12a.9.9 0 0 1-.9.9H3.1a.9.9 0 1 1 0-1.8h1.3a.9.9 0 0 1 .9.9ZM18.93 5.07a.9.9 0 0 1 0 1.27l-.92.92a.9.9 0 0 1-1.27-1.27l.92-.92a.9.9 0 0 1 1.27 0ZM7.26 16.74a.9.9 0 0 1 0 1.27l-.92.92a.9.9 0 0 1-1.27-1.27l.92-.92a.9.9 0 0 1 1.27 0ZM18.93 18.93a.9.9 0 0 1-1.27 0l-.92-.92a.9.9 0 0 1 1.27-1.27l.92.92a.9.9 0 0 1 0 1.27ZM7.26 7.26a.9.9 0 0 1-1.27 0l-.92-.92A.9.9 0 1 1 6.34 5.07l.92.92a.9.9 0 0 1 0 1.27Z"/>
    </svg>`;
}

function setThemeToggleState(isDarkTheme) {
  const button = elements.themeToggle;
  if (!button) {
    return;
  }

  button.classList.toggle('is-active', Boolean(isDarkTheme));
  button.setAttribute('aria-pressed', String(Boolean(isDarkTheme)));
  button.setAttribute('aria-label', isDarkTheme ? 'Passa al tema chiaro' : 'Passa al tema scuro');
  button.title = isDarkTheme ? 'Passa al tema chiaro' : 'Passa al tema scuro';
  button.innerHTML = getThemeIconSvg(isDarkTheme);
}

function syncControlStates() {
  const sourcePanelOpen = Boolean(state.settings.sourcePanelOpen);
  const tocPanelOpen = elements.tocPanel.classList.contains('open');
  const lineNumbersVisible = Boolean(state.settings.showLineNumbers);
  const darkThemeActive = state.settings.theme === 'dark';
  const settingsPanelOpen = Boolean(state.settings.settingsPanelOpen);

  setPressedState(
    elements.linePanelToggle,
    sourcePanelOpen,
    'Nascondi sorgente',
    'Mostra sorgente'
  );

  setPressedState(
    elements.tocToggle,
    tocPanelOpen,
    'Nascondi indice',
    'Mostra indice'
  );

  setPressedState(
    elements.showLineNumbersToggle,
    lineNumbersVisible,
    'Nascondi numeri linea',
    'Mostra numeri linea'
  );

  setThemeToggleState(darkThemeActive);

  setPressedState(
    elements.settingsToggle,
    settingsPanelOpen,
    'Nascondi impostazioni',
    'Mostra impostazioni'
  );

  setPressedState(
    elements.copyWithLineNumbersToggle,
    Boolean(state.settings.copyWithLineNumbers),
    'Disattiva copia con numeri di riga',
    'Copia con numeri di riga',
    '123',
    '123'
  );
}

function setTocPanelOpen(isOpen) {
  elements.tocPanel.classList.toggle('open', Boolean(isOpen));
  syncControlStates();
}

function toggleTocPanel() {
  setTocPanelOpen(!elements.tocPanel.classList.contains('open'));
}

function hasScrollableMarkdownDocument() {
  if (!state.markdownText || elements.markdownBody.classList.contains('empty-state')) {
    return false;
  }

  return elements.markdownBody.scrollHeight > elements.markdownBody.clientHeight + 8;
}

function updateScrollJumpControls() {
  if (!elements.scrollJumpControls) {
    return;
  }

  const canScroll = hasScrollableMarkdownDocument();
  elements.scrollJumpControls.hidden = !canScroll;

  if (!canScroll) {
    elements.scrollTopButton.disabled = true;
    elements.scrollBottomButton.disabled = true;
    return;
  }

  const scrollTop = elements.markdownBody.scrollTop;
  const maxScrollTop = Math.max(elements.markdownBody.scrollHeight - elements.markdownBody.clientHeight, 0);
  const atTop = scrollTop <= 4;
  const atBottom = scrollTop >= maxScrollTop - 4;

  elements.scrollTopButton.disabled = atTop;
  elements.scrollBottomButton.disabled = atBottom;
}

function scrollMarkdownToEdge(edge) {
  if (!hasScrollableMarkdownDocument()) {
    updateScrollJumpControls();
    return;
  }

  const top = edge === 'bottom'
    ? Math.max(elements.markdownBody.scrollHeight - elements.markdownBody.clientHeight, 0)
    : 0;

  elements.markdownBody.scrollTo({ top, behavior: 'smooth' });
  window.setTimeout(updateScrollJumpControls, 220);
}


function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isWordChar(value) {
  return Boolean(value) && /[\p{L}\p{N}_]/u.test(value);
}

function hasWordBoundaries(text, start, end) {
  return !isWordChar(text[start - 1]) && !isWordChar(text[end]);
}

function getSearchQuery() {
  return elements.searchInput.value.trim();
}

function setSearchPanelOpen(isOpen, options = {}) {
  const { focusInput = false } = options;
  state.searchOpen = Boolean(isOpen);
  elements.searchControl.classList.toggle('open', state.searchOpen);
  elements.searchPanel.setAttribute('aria-hidden', String(!state.searchOpen));

  for (const control of elements.searchPanel.querySelectorAll('input, button')) {
    control.tabIndex = state.searchOpen ? 0 : -1;
  }

  setPressedState(
    elements.searchToggle,
    state.searchOpen,
    'Nascondi ricerca',
    'Cerca nel documento'
  );

  if (state.searchOpen && focusInput) {
    requestAnimationFrame(() => elements.searchInput.focus());
  }
}

function closeSearchPanel(options = {}) {
  const { clearQuery = true } = options;

  setSearchPanelOpen(false);

  if (clearQuery) {
    elements.searchInput.value = '';
  }

  clearSearchHighlights();
  updateSearchCounter();

  const selection = window.getSelection?.();
  if (selection && !selection.isCollapsed) {
    selection.removeAllRanges();
  }
}

function toggleSearchPanel() {
  if (state.searchOpen) {
    closeSearchPanel({ clearQuery: true });
    return;
  }

  setSearchPanelOpen(true, { focusInput: true });
}

function updateSearchOptionButtons() {
  setPressedState(
    elements.searchCaseToggle,
    Boolean(state.settings.searchCaseSensitive),
    'Case sensitive attivo',
    'Case sensitive non attivo'
  );

  setPressedState(
    elements.searchWholeWordToggle,
    Boolean(state.settings.searchWholeWords),
    'Solo parole intere attivo',
    'Solo parole intere non attivo'
  );
}

function updateSearchCounter() {
  const query = getSearchQuery();
  const hasEnoughCharacters = query.length >= SEARCH_MIN_LENGTH;
  const total = state.searchHits.length;
  const hasHits = total > 0 && state.currentSearchIndex >= 0;

  if (!query) {
    elements.searchCounter.textContent = '';
  } else if (!hasEnoughCharacters) {
    elements.searchCounter.textContent = `min ${SEARCH_MIN_LENGTH}`;
  } else if (!total) {
    elements.searchCounter.textContent = '0/0';
  } else {
    elements.searchCounter.textContent = `${state.currentSearchIndex + 1}/${total}`;
  }

  elements.searchPrevButton.disabled = !hasHits;
  elements.searchNextButton.disabled = !hasHits;
}

function clearSearchHighlights() {
  if (state.searchDebounceTimer) {
    window.clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = null;
  }

  const marks = [...elements.markdownBody.querySelectorAll('mark.search-hit')];
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) {
      continue;
    }

    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }

    mark.remove();
    parent.normalize();
  }

  state.searchHits = [];
  state.currentSearchIndex = -1;
  state.previousCurrentSearchHit = null;
}

function findTextMatches(text, query) {
  const flags = state.settings.searchCaseSensitive ? 'gu' : 'giu';
  const regex = new RegExp(escapeRegExp(query), flags);
  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (!state.settings.searchWholeWords || hasWordBoundaries(text, start, end)) {
      matches.push({ start, end });
    }

    if (match[0].length === 0) {
      regex.lastIndex += 1;
    }
  }

  return matches;
}

function shouldSearchTextNode(node) {
  if (!node.textContent || !node.textContent.trim()) {
    return NodeFilter.FILTER_REJECT;
  }

  const parent = node.parentElement;
  if (!parent || parent.closest(SEARCH_EXCLUDE_SELECTOR)) {
    return NodeFilter.FILTER_REJECT;
  }

  if (parent.closest('script, style, noscript')) {
    return NodeFilter.FILTER_REJECT;
  }

  return NodeFilter.FILTER_ACCEPT;
}

function collectSearchTextNodes() {
  const walker = document.createTreeWalker(
    elements.markdownBody,
    NodeFilter.SHOW_TEXT,
    { acceptNode: shouldSearchTextNode }
  );

  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }

  return nodes;
}

function wrapTextNodeMatches(node, matches) {
  const text = node.textContent || '';
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  const wrappedMarks = [];

  for (const match of matches) {
    if (match.start > cursor) {
      fragment.append(document.createTextNode(text.slice(cursor, match.start)));
    }

    const mark = document.createElement('mark');
    mark.className = 'search-hit';
    mark.textContent = text.slice(match.start, match.end);
    fragment.append(mark);
    wrappedMarks.push(mark);
    cursor = match.end;
  }

  if (cursor < text.length) {
    fragment.append(document.createTextNode(text.slice(cursor)));
  }

  node.replaceWith(fragment);
  return wrappedMarks;
}

function applyCurrentSearchHit(options = {}) {
  const { scroll = true } = options;

  if (state.previousCurrentSearchHit) {
    state.previousCurrentSearchHit.classList.remove('search-hit-current');
  }

  const currentHit = state.searchHits[state.currentSearchIndex] || null;
  state.previousCurrentSearchHit = currentHit;

  if (!currentHit) {
    updateSearchCounter();
    return;
  }

  currentHit.classList.add('search-hit-current');
  updateSearchCounter();

  if (scroll) {
    currentHit.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }
}

function runSearch(options = {}) {
  const { scrollToFirst = true } = options;
  const query = getSearchQuery();

  clearSearchHighlights();

  if (query.length < SEARCH_MIN_LENGTH) {
    updateSearchCounter();
    return;
  }

  const nodes = collectSearchTextNodes();
  const hits = [];

  for (const node of nodes) {
    const matches = findTextMatches(node.textContent || '', query);
    if (matches.length) {
      hits.push(...wrapTextNodeMatches(node, matches));
    }
  }

  state.searchHits = hits;
  state.currentSearchIndex = hits.length ? 0 : -1;
  state.previousCurrentSearchHit = null;
  applyCurrentSearchHit({ scroll: scrollToFirst && Boolean(hits.length) });
}

function scheduleSearch() {
  if (state.searchDebounceTimer) {
    window.clearTimeout(state.searchDebounceTimer);
  }

  state.searchDebounceTimer = window.setTimeout(() => {
    state.searchDebounceTimer = null;
    runSearch({ scrollToFirst: true });
  }, SEARCH_DEBOUNCE_MS);
}

function moveSearch(delta) {
  if (!state.searchHits.length) {
    updateSearchCounter();
    return;
  }

  state.currentSearchIndex = (state.currentSearchIndex + delta + state.searchHits.length) % state.searchHits.length;
  applyCurrentSearchHit({ scroll: true });
}

function resetSearchForNewDocument() {
  clearSearchHighlights();
  updateSearchCounter();
}

function applySettings() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.body.classList.toggle('line-numbers', Boolean(state.settings.showLineNumbers));
  document.documentElement.style.setProperty('--reader-font-size', `${state.settings.fontSize}px`);
  document.documentElement.style.setProperty('--reader-font-family', FONT_FAMILIES[state.settings.fontFamily] || FONT_FAMILIES.system);

  elements.fontFamilySelect.value = state.settings.fontFamily;
  elements.fontSizeInput.value = String(state.settings.fontSize);
  elements.fontSizeOutput.textContent = `${state.settings.fontSize}px`;
  setThemeToggleState(state.settings.theme === 'dark');
  elements.appVersion.textContent = `v${APP_VERSION}`;
  updateSearchOptionButtons();
  updateSearchCounter();
  elements.sourcePanel.hidden = !state.settings.sourcePanelOpen;
  elements.settingsbar.hidden = !state.settings.settingsPanelOpen;
  document.body.classList.toggle('settings-collapsed', !state.settings.settingsPanelOpen);
  syncControlStates();
  requestAnimationFrame(updateScrollJumpControls);
}


function isFileSystemAccessSupported() {
  return window.isSecureContext
    && 'showOpenFilePicker' in window
    && 'indexedDB' in window;
}

function openFileBindingDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_BINDING_DB_NAME, FILE_BINDING_DB_VERSION);

    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(FILE_BINDING_STORE_NAME)) {
        database.createObjectStore(FILE_BINDING_STORE_NAME, { keyPath: 'id' });
      }
    });

    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error || new Error('IndexedDB non disponibile.')));
  });
}

async function withFileBindingStore(mode, callback) {
  const database = await openFileBindingDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(FILE_BINDING_STORE_NAME, mode);
      const store = transaction.objectStore(FILE_BINDING_STORE_NAME);
      let callbackResult;

      transaction.addEventListener('complete', () => resolve(callbackResult));
      transaction.addEventListener('abort', () => reject(transaction.error || new Error('Transazione IndexedDB annullata.')));
      transaction.addEventListener('error', () => reject(transaction.error || new Error('Errore IndexedDB.')));

      try {
        callbackResult = callback(store);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  } finally {
    database.close();
  }
}

function getStoreRequestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error || new Error('Richiesta IndexedDB non riuscita.')));
  });
}

async function getStoredFileBinding() {
  if (!isFileSystemAccessSupported()) {
    return null;
  }

  try {
    return await withFileBindingStore('readonly', (store) => getStoreRequestResult(store.get(LAST_FILE_BINDING_KEY)));
  } catch (_error) {
    return null;
  }
}

async function saveStoredFileBinding(handle, file) {
  if (!isFileSystemAccessSupported() || !handle || !file) {
    return false;
  }

  const record = {
    id: LAST_FILE_BINDING_KEY,
    handle,
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    savedAt: Date.now()
  };

  try {
    await withFileBindingStore('readwrite', (store) => getStoreRequestResult(store.put(record)));
    return true;
  } catch (_error) {
    return false;
  }
}

async function clearStoredFileBinding() {
  if (!('indexedDB' in window)) {
    return;
  }

  try {
    await withFileBindingStore('readwrite', (store) => getStoreRequestResult(store.delete(LAST_FILE_BINDING_KEY)));
  } catch (_error) {
    // Best effort: un errore nel reset del binding non deve bloccare l'app.
  }
}

async function ensureFileReadPermission(handle) {
  if (!handle) {
    return 'denied';
  }

  if (typeof handle.queryPermission !== 'function') {
    return 'granted';
  }

  let permission = await handle.queryPermission({ mode: 'read' });
  if (permission === 'granted') {
    return permission;
  }

  if (typeof handle.requestPermission === 'function') {
    permission = await handle.requestPermission({ mode: 'read' });
  }

  return permission;
}

function resetDocumentToEmptyState() {
  state.currentFileName = '';
  state.markdownText = '';
  state.sourceLines = [];
  state.selectedLineStart = 1;
  state.selectedLineEnd = 1;
  state.selectedBlockElement = null;
  state.frontmatter = null;
  state.currentFileLinked = false;
  clearTouchRangeMode();
  resetSearchForNewDocument();

  elements.markdownBody.classList.add('empty-state');
  elements.markdownBody.innerHTML = INITIAL_MARKDOWN_BODY_HTML;
  elements.markdownBody.scrollTo({ top: 0 });

  elements.lineFromInput.value = '1';
  elements.lineToInput.value = '1';
  elements.lineFromInput.max = '1';
  elements.lineToInput.max = '1';
  elements.sourceSpacer.style.height = `${VIRTUAL_LINE_HEIGHT_PX}px`;
  elements.sourceItems.textContent = '';
  elements.tocList.innerHTML = '<p class="empty-panel">Apri un file Markdown per generare l’indice.</p>';

  if (state.headingObserver) {
    state.headingObserver.disconnect();
    state.headingObserver = null;
  }

  updateSourceVirtualList();
  updateScrollJumpControls();
}

function splitMarkdownLines(text) {
  if (!text) {
    return [''];
  }

  return text.split(/\r\n|\n|\r/);
}

function getMarkdownWorker() {
  if (state.worker) {
    return state.worker;
  }

  state.worker = new Worker(new URL('./markdown-worker.js', import.meta.url), { type: 'module' });
  state.worker.addEventListener('message', onWorkerMessage);
  state.worker.addEventListener('error', (event) => {
    setStatus(`Errore worker Markdown: ${event.message}`);
  });
  return state.worker;
}

function parseMarkdownAsync(markdown) {
  const worker = getMarkdownWorker();
  const id = state.parseRequestId + 1;
  state.parseRequestId = id;
  worker.postMessage({ id, markdown });
}

function onWorkerMessage(event) {
  const result = event.data || {};

  if (result.id !== state.parseRequestId) {
    return;
  }

  if (!result.ok) {
    setStatus(`Errore parsing Markdown: ${result.error || 'errore sconosciuto'}`);
    return;
  }

  state.frontmatter = result.frontmatter || null;
  renderMarkdown(result.html, state.frontmatter);
  renderToc(result.toc || []);
  observeHeadings(result.toc || []);
  updateSourceVirtualList();

  const fileInfo = state.currentFileName ? `${state.currentFileName}${state.currentFileLinked ? ' · collegato' : ''} · ` : '';
  const highlightInfo = result.stats?.highlightDisabled ? ' · highlight codice disattivato per performance' : '';
  const metadataInfo = state.frontmatter?.detected ? ' · metadati YAML' : '';
  setStatus(`${fileInfo}${state.sourceLines.length} righe · ${formatBytes(state.markdownText.length)} · render ${result.stats?.elapsedMs ?? '?'} ms${metadataInfo}${highlightInfo}`);
}

function renderMarkdown(html, frontmatter = null) {
  const safeHtml = DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'data-line-start', 'data-line-end', 'data-heading-level', 'data-search-exclude', 'tabindex', 'class', 'type', 'checked', 'disabled'],
    ADD_TAGS: ['mark', 'input']
  });

  elements.markdownBody.classList.remove('empty-state');
  elements.markdownBody.innerHTML = safeHtml;

  const metadataCard = createFrontmatterCard(frontmatter);
  if (metadataCard) {
    elements.markdownBody.prepend(metadataCard);
  }

  elements.markdownBody.scrollTo({ top: 0 });
  requestAnimationFrame(updateScrollJumpControls);
  requestAnimationFrame(() => {
    if (getSearchQuery().length >= SEARCH_MIN_LENGTH) {
      runSearch({ scrollToFirst: false });
    } else {
      resetSearchForNewDocument();
    }
  });
}

function createFrontmatterCard(frontmatter) {
  if (!frontmatter?.detected) {
    return null;
  }

  const details = document.createElement('details');
  details.className = 'metadata-card';
  details.setAttribute('data-search-exclude', 'true');
  details.setAttribute('data-line-start', String(frontmatter.lineStart || 1));
  details.setAttribute('data-line-end', String(frontmatter.lineEnd || frontmatter.lineStart || 1));

  const summary = document.createElement('summary');
  summary.className = 'metadata-summary';

  const summaryText = document.createElement('span');
  summaryText.className = 'metadata-summary-text';

  const label = document.createElement('span');
  label.className = 'metadata-label';
  label.textContent = 'Metadati documento';

  const title = document.createElement('strong');
  title.textContent = frontmatter.title || 'Frontmatter YAML';

  const hint = document.createElement('span');
  hint.className = 'metadata-line-badge';
  hint.textContent = `${frontmatter.lineStart || 1}-${frontmatter.lineEnd || 1}`;
  hint.setAttribute('aria-label', `righe ${frontmatter.lineStart || 1}-${frontmatter.lineEnd || 1}`);

  summaryText.append(label, title, hint);

  const chevron = document.createElement('span');
  chevron.className = 'metadata-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.innerHTML = `
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z"/>
    </svg>
  `;

  summary.append(summaryText, chevron);
  details.append(summary);

  const body = document.createElement('div');
  body.className = 'metadata-body';

  const parsedEntries = (frontmatter.entries || []).filter((entry) => entry.type === 'pair' && entry.key);

  if (parsedEntries.length) {
    const grid = document.createElement('dl');
    grid.className = 'metadata-grid';

    for (const entry of parsedEntries) {
      const key = document.createElement('dt');
      key.textContent = entry.key;

      const value = document.createElement('dd');
      value.textContent = entry.value || '—';

      grid.append(key, value);
    }

    body.append(grid);
  }

  const rawEntries = (frontmatter.entries || []).filter((entry) => entry.type !== 'pair' && String(entry.value || '').trim());
  if (rawEntries.length || !parsedEntries.length) {
    const raw = document.createElement('pre');
    raw.className = 'metadata-raw';
    raw.textContent = (frontmatter.rawLines || []).join('\n');
    body.append(raw);
  }

  details.append(body);
  return details;
}

function renderToc(tocItems) {
  elements.tocList.textContent = '';

  if (!tocItems.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-panel';
    empty.textContent = 'Nessun heading trovato nel documento.';
    elements.tocList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const item of tocItems) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toc-item';
    button.dataset.slug = item.slug;
    button.style.paddingLeft = `${0.55 + Math.max(item.level - 1, 0) * 0.85}rem`;
    button.title = item.title;

    const title = document.createElement('span');
    title.className = 'toc-title';
    title.textContent = item.title;

    button.append(title);

    if (item.lineStart) {
      const line = document.createElement('span');
      line.className = 'toc-line-badge';
      line.textContent = item.lineStart;
      line.setAttribute('aria-label', `riga ${item.lineStart}`);
      button.append(line);
    }

    button.addEventListener('click', () => scrollToHeading(item.slug));
    fragment.append(button);
  }

  elements.tocList.append(fragment);
}

function scrollToHeading(slug) {
  const heading = document.getElementById(slug);
  if (!heading) {
    return;
  }

  heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  heading.focus({ preventScroll: true });
  history.replaceState(null, '', `#${encodeURIComponent(slug)}`);

  if (window.matchMedia('(max-width: 1180px)').matches) {
    setTocPanelOpen(false);
  }
}

function observeHeadings(tocItems) {
  if (state.headingObserver) {
    state.headingObserver.disconnect();
    state.headingObserver = null;
  }

  if (!tocItems.length) {
    return;
  }

  const headings = tocItems
    .map((item) => document.getElementById(item.slug))
    .filter(Boolean);

  state.headingObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

    if (!visible.length) {
      return;
    }

    state.activeHeadingSlug = visible[0].target.id;
    for (const item of elements.tocList.querySelectorAll('.toc-item')) {
      item.classList.toggle('active', item.dataset.slug === state.activeHeadingSlug);
    }
  }, {
    root: elements.markdownBody,
    rootMargin: '-18% 0px -72% 0px',
    threshold: [0, 1]
  });

  for (const heading of headings) {
    state.headingObserver.observe(heading);
  }
}

async function openMarkdownFile(file, options = {}) {
  if (!file) {
    return;
  }

  const { clearBinding = true, statusPrefix = 'Caricamento' } = options;

  if (clearBinding) {
    state.currentFileLinked = false;
    void clearStoredFileBinding();
  }

  state.currentFileName = file.name;
  setStatus(`${statusPrefix} ${file.name} (${formatBytes(file.size)})…`);

  try {
    const text = await file.text();
    loadMarkdownText(text, file.name);
  } catch (error) {
    setStatus(`Impossibile leggere il file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function openMarkdownFileFromHandle(handle, options = {}) {
  const { saveBinding = false, statusPrefix = 'Caricamento' } = options;

  const permission = await ensureFileReadPermission(handle);
  if (permission !== 'granted') {
    throw new Error('Permesso di lettura non concesso.');
  }

  const file = await handle.getFile();
  state.currentFileLinked = true;

  if (saveBinding) {
    const saved = await saveStoredFileBinding(handle, file);
    if (!saved) {
      setStatus(`File caricato: ${file.name}. Collegamento non salvato da questo browser.`);
    }
  }

  await openMarkdownFile(file, { clearBinding: false, statusPrefix });
  return file;
}

async function openMarkdownFileWithSystemPicker() {
  if (!isFileSystemAccessSupported()) {
    elements.fileInput.click();
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      excludeAcceptAllOption: false,
      types: [
        {
          description: 'Markdown',
          accept: {
            'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'],
            'text/plain': ['.txt']
          }
        }
      ]
    });

    const file = await openMarkdownFileFromHandle(handle, {
      saveBinding: true,
      statusPrefix: 'Caricamento'
    });
    setStatus(`File collegato: ${file.name}.`);
  } catch (error) {
    if (error?.name === 'AbortError') {
      return;
    }

    setStatus(`Apertura file non riuscita: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function restoreLastLinkedFile() {
  if (!isFileSystemAccessSupported()) {
    return;
  }

  const storedBinding = await getStoredFileBinding();
  if (!storedBinding?.handle) {
    return;
  }

  state.fileBindingRestoreInProgress = true;
  setStatus(`Controllo ultimo file collegato${storedBinding.name ? `: ${storedBinding.name}` : ''}…`);

  try {
    const file = await openMarkdownFileFromHandle(storedBinding.handle, {
      saveBinding: true,
      statusPrefix: 'Ripristino'
    });
    setStatus(`File collegato caricato dal dispositivo: ${file.name}.`);
  } catch (_error) {
    await clearStoredFileBinding();
    resetDocumentToEmptyState();
    setStatus('Il file originale non è più disponibile o il permesso è stato revocato. Ultimo file azzerato.');
  } finally {
    state.fileBindingRestoreInProgress = false;
  }
}

function loadMarkdownText(text, fileName = '') {
  state.markdownText = text;
  state.currentFileName = fileName;
  state.frontmatter = null;
  state.sourceLines = splitMarkdownLines(text);
  state.selectedLineStart = 1;
  state.selectedLineEnd = Math.min(1, state.sourceLines.length);
  resetSearchForNewDocument();
  elements.lineFromInput.max = String(state.sourceLines.length);
  elements.lineToInput.max = String(state.sourceLines.length);
  setSelectedLineRange(1, 1, { scrollSource: false, updateBlock: false });
  updateSourceVirtualList();
  updateScrollJumpControls();
  setStatus(`Parsing Markdown${fileName ? `: ${fileName}` : ''}…`);
  parseMarkdownAsync(text);
}

function setSelectedLineRange(start, end, options = {}) {
  const { scrollSource = true, updateBlock = false } = options;
  const normalizedStart = clampLine(start);
  const normalizedEnd = clampLine(end);
  state.selectedLineStart = Math.min(normalizedStart, normalizedEnd);
  state.selectedLineEnd = Math.max(normalizedStart, normalizedEnd);

  elements.lineFromInput.value = String(state.selectedLineStart);
  elements.lineToInput.value = String(state.selectedLineEnd);

  if (scrollSource && !elements.sourcePanel.hidden) {
    scrollSourceToLine(state.selectedLineStart);
  }

  if (updateBlock) {
    highlightRenderedBlockForRange(state.selectedLineStart, state.selectedLineEnd);
  }

  updateSourceVirtualList();
}

function scrollSourceToLine(lineNumber) {
  const exactTop = Math.max(clampLine(lineNumber) - 1, 0) * VIRTUAL_LINE_HEIGHT_PX;
  const maxTop = Math.max(elements.sourceViewport.scrollHeight - elements.sourceViewport.clientHeight, 0);
  const top = Math.min(exactTop, maxTop);

  elements.sourceViewport.scrollTo({ top, behavior: 'auto' });
  updateSourceVirtualList();
  window.requestAnimationFrame(updateSourceVirtualList);
}

function updateSourceVirtualList() {
  const lineCount = state.sourceLines.length;
  elements.sourceSpacer.style.height = `${Math.max(lineCount, 1) * VIRTUAL_LINE_HEIGHT_PX}px`;

  if (!lineCount) {
    elements.sourceItems.textContent = '';
    return;
  }

  const scrollTop = elements.sourceViewport.scrollTop;
  const viewportHeight = elements.sourceViewport.clientHeight || 1;
  const firstLineIndex = Math.max(Math.floor(scrollTop / VIRTUAL_LINE_HEIGHT_PX) - VIRTUAL_OVERSCAN_LINES, 0);
  const lastLineIndex = Math.min(
    Math.ceil((scrollTop + viewportHeight) / VIRTUAL_LINE_HEIGHT_PX) + VIRTUAL_OVERSCAN_LINES,
    lineCount
  );

  elements.sourceItems.style.transform = `translateY(${firstLineIndex * VIRTUAL_LINE_HEIGHT_PX}px)`;

  const html = [];
  for (let index = firstLineIndex; index < lastLineIndex; index += 1) {
    const lineNumber = index + 1;
    const selected = lineNumber >= state.selectedLineStart && lineNumber <= state.selectedLineEnd;
    html.push(`
      <button type="button" class="source-line${selected ? ' selected' : ''}" data-line="${lineNumber}">
        <span class="num">${lineNumber}</span>
        <span class="txt">${escapeHtml(state.sourceLines[index] || ' ')}</span>
      </button>
    `);
  }

  elements.sourceItems.innerHTML = html.join('');
}

function copySelectedRange() {
  if (!state.sourceLines.length) {
    setStatus('Nessun file Markdown caricato.');
    return;
  }

  const start = clampLine(elements.lineFromInput.value);
  const end = clampLine(elements.lineToInput.value);
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const includeLineNumbers = Boolean(state.settings.copyWithLineNumbers);
  const content = state.sourceLines
    .slice(from - 1, to)
    .map((line, index) => includeLineNumbers ? `[${from + index}]: ${line}` : line)
    .join('\n');

  navigator.clipboard.writeText(content)
    .then(() => setStatus(`Copiate righe ${from}-${to}${includeLineNumbers ? ' con numero linea' : ''}.`))
    .catch((error) => setStatus(`Copia non riuscita: ${error instanceof Error ? error.message : String(error)}`));
}

function highlightRenderedBlockForRange(start, end) {
  const candidates = [...elements.markdownBody.querySelectorAll('[data-line-start][data-line-end]')];
  let bestMatch = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const blockStart = Number(candidate.getAttribute('data-line-start'));
    const blockEnd = Number(candidate.getAttribute('data-line-end'));
    const containsRange = blockStart <= start && blockEnd >= end;
    const distance = Math.abs(blockStart - start) + Math.abs(blockEnd - end);

    if (containsRange && distance < bestDistance) {
      bestMatch = candidate;
      bestDistance = distance;
    }
  }

  if (bestMatch) {
    selectRenderedBlock(bestMatch, { updateRange: false });
  }
}

function getRenderedBlockLineRange(block) {
  const start = Number(block.getAttribute('data-line-start'));
  const end = Number(block.getAttribute('data-line-end')) || start;

  return {
    start: Number.isFinite(start) ? start : 1,
    end: Number.isFinite(end) ? end : start
  };
}

function selectRenderedBlock(block, options = {}) {
  const { updateRange = true, extendRange = false } = options;

  if (state.selectedBlockElement) {
    state.selectedBlockElement.classList.remove('selected-source-block');
  }

  state.selectedBlockElement = block;
  state.selectedBlockElement.classList.add('selected-source-block');

  if (updateRange) {
    const range = getRenderedBlockLineRange(block);

    if (extendRange) {
      const targetLine = range.end >= state.selectedLineStart ? range.end : range.start;
      setSelectedLineRange(state.selectedLineStart, targetLine, { scrollSource: true, updateBlock: false });
      return;
    }

    setSelectedLineRange(range.start, range.end, { scrollSource: true, updateBlock: false });
  }
}

function clearTouchRangeMode() {
  state.touchRangeAnchorLine = null;
  state.touchRangeMode = false;
}

function cancelTouchLongPressTimer() {
  if (state.touchLongPressTimer) {
    window.clearTimeout(state.touchLongPressTimer);
    state.touchLongPressTimer = null;
  }
}

function selectMarkdownBlockFromEvent(event) {
  const block = event.target.closest('[data-line-start][data-line-end]');
  if (!block || !elements.markdownBody.contains(block)) {
    return null;
  }
  return block;
}

function extendRenderedRangeFromAnchor(block) {
  const range = getRenderedBlockLineRange(block);
  const anchorLine = state.touchRangeAnchorLine || state.selectedLineStart;
  const targetLine = range.end >= anchorLine ? range.end : range.start;

  selectRenderedBlock(block, { updateRange: false });
  setSelectedLineRange(anchorLine, targetLine, { scrollSource: true, updateBlock: false });
  clearTouchRangeMode();
  setStatus(`Intervallo sorgente selezionato: righe ${state.selectedLineStart}-${state.selectedLineEnd}.`);
}

function handleRenderedBlockClick(event) {
  if (state.suppressNextMarkdownClick) {
    state.suppressNextMarkdownClick = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const block = selectMarkdownBlockFromEvent(event);
  if (!block) {
    return;
  }

  if (state.touchRangeMode && !event.shiftKey) {
    extendRenderedRangeFromAnchor(block);
    return;
  }

  if (!event.shiftKey) {
    clearTouchRangeMode();
  }

  selectRenderedBlock(block, { extendRange: event.shiftKey });
}

function startRenderedBlockTouchRange(event) {
  if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
    return;
  }

  const block = selectMarkdownBlockFromEvent(event);
  if (!block) {
    return;
  }

  cancelTouchLongPressTimer();
  state.touchLongPressBlock = block;
  state.touchPointerStartX = event.clientX;
  state.touchPointerStartY = event.clientY;

  state.touchLongPressTimer = window.setTimeout(() => {
    const range = getRenderedBlockLineRange(block);
    state.touchLongPressTimer = null;
    state.touchRangeAnchorLine = range.start;
    state.touchRangeMode = true;
    state.suppressNextMarkdownClick = true;
    selectRenderedBlock(block);
    setStatus(`Ancora selezione impostata alla riga ${range.start}. Tocca un altro blocco per estendere l’intervallo.`);
  }, TOUCH_RANGE_LONG_PRESS_MS);
}

function handleRenderedBlockTouchMove(event) {
  if (!state.touchLongPressTimer) {
    return;
  }

  const deltaX = Math.abs(event.clientX - state.touchPointerStartX);
  const deltaY = Math.abs(event.clientY - state.touchPointerStartY);
  if (deltaX > TOUCH_RANGE_MOVE_TOLERANCE_PX || deltaY > TOUCH_RANGE_MOVE_TOLERANCE_PX) {
    cancelTouchLongPressTimer();
  }
}

function isStandaloneDisplayMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || window.matchMedia('(display-mode: window-controls-overlay)').matches
    || document.referrer.startsWith('android-app://')
    || window.navigator.standalone === true;
}

function isAppInstalledKnown() {
  return localStorage.getItem(INSTALL_STATE_KEY) === 'installed';
}

function rememberInstalledApp() {
  localStorage.setItem(INSTALL_STATE_KEY, 'installed');
}

function updateInstallButtonVisibility() {
  if (isStandaloneDisplayMode()) {
    rememberInstalledApp();
  }

  elements.installButton.hidden = isStandaloneDisplayMode() || isAppInstalledKnown() || !state.deferredInstallPrompt;
}

function requestServiceWorkerVersion(worker) {
  if (!worker) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => resolve(null), 800);

    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      resolve(event.data?.version ?? null);
    };

    try {
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    } catch (error) {
      window.clearTimeout(timeout);
      resolve(null);
    }
  });
}

function createUpdateBanner(registration) {
  const existingBanner = document.querySelector('[data-update-banner="true"]');
  if (existingBanner) {
    return;
  }

  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.dataset.updateBanner = 'true';
  banner.setAttribute('role', 'status');
  banner.innerHTML = `
    <span>Nuova versione disponibile.</span>
    <button type="button" class="update-banner__button">Aggiorna</button>
  `;

  const button = banner.querySelector('button');
  button.addEventListener('click', () => {
    state.updateAccepted = true;
    button.disabled = true;
    button.textContent = 'Aggiornamento…';

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }

    window.location.reload();
  });

  document.body.append(banner);
}

async function handleWaitingServiceWorker(registration) {
  if (!registration.waiting || !navigator.serviceWorker.controller) {
    return;
  }

  const waitingVersion = await requestServiceWorkerVersion(registration.waiting);

  if (waitingVersion === APP_VERSION) {
    // La UI caricata è già la stessa versione del service worker in waiting:
    // allineiamo il SW in silenzio senza mostrare banner e senza reload.
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    return;
  }

  createUpdateBanner(registration);
}

function watchServiceWorkerUpdates(registration) {
  handleWaitingServiceWorker(registration);

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) {
      return;
    }

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        handleWaitingServiceWorker(registration);
      }
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!state.updateAccepted || state.updateReloadPending) {
      return;
    }

    state.updateReloadPending = true;
    window.location.reload();
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL
      });

      watchServiceWorkerUpdates(registration);
      registration.update().catch(() => undefined);
    } catch (error) {
      setStatus(`Service worker non registrato: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}

function bindInstallFlow() {
  updateInstallButtonVisibility();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    updateInstallButtonVisibility();
  });

  window.addEventListener('appinstalled', () => {
    rememberInstalledApp();
    state.deferredInstallPrompt = null;
    updateInstallButtonVisibility();
    setStatus('App installata.');
  });

  const displayModeQueries = [
    '(display-mode: standalone)',
    '(display-mode: fullscreen)',
    '(display-mode: minimal-ui)',
    '(display-mode: window-controls-overlay)'
  ].map((query) => window.matchMedia(query));

  for (const query of displayModeQueries) {
    if (query.addEventListener) {
      query.addEventListener('change', updateInstallButtonVisibility);
    } else if (query.addListener) {
      query.addListener(updateInstallButtonVisibility);
    }
  }

  window.setTimeout(updateInstallButtonVisibility, 250);
  window.setTimeout(updateInstallButtonVisibility, 1200);

  elements.installButton.addEventListener('click', async () => {
    if (!state.deferredInstallPrompt || isStandaloneDisplayMode()) {
      updateInstallButtonVisibility();
      return;
    }

    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    updateInstallButtonVisibility();
  });
}


function bindViewportZoomGuards() {
  let lastTouchEndAt = 0;

  const preventMultiTouch = (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  };

  const preventGesture = (event) => {
    event.preventDefault();
  };

  window.addEventListener('touchstart', preventMultiTouch, { capture: true, passive: false });
  window.addEventListener('touchmove', preventMultiTouch, { capture: true, passive: false });
  document.addEventListener('touchstart', preventMultiTouch, { capture: true, passive: false });
  document.addEventListener('touchmove', preventMultiTouch, { capture: true, passive: false });

  window.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEndAt <= 300) {
      event.preventDefault();
    }
    lastTouchEndAt = now;
  }, { capture: true, passive: false });

  window.addEventListener('gesturestart', preventGesture, { capture: true, passive: false });
  window.addEventListener('gesturechange', preventGesture, { capture: true, passive: false });
  window.addEventListener('gestureend', preventGesture, { capture: true, passive: false });

  window.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
    }
  }, { capture: true, passive: false });

  window.addEventListener('keydown', (event) => {
    const isZoomShortcut = (event.ctrlKey || event.metaKey) && ['+', '=', '-', '0'].includes(event.key);
    if (isZoomShortcut) {
      event.preventDefault();
    }
  }, { capture: true });
}

function bindEvents() {
  elements.fileInput.addEventListener('change', (event) => {
    openMarkdownFile(event.target.files?.[0]);
    event.target.value = '';
  });

  elements.tocToggle.addEventListener('click', toggleTocPanel);

  elements.showLineNumbersToggle.addEventListener('click', () => {
    state.settings.showLineNumbers = !state.settings.showLineNumbers;
    saveSettings();
    applySettings();
  });

  elements.linePanelToggle.addEventListener('click', () => {
    state.settings.sourcePanelOpen = !state.settings.sourcePanelOpen;
    saveSettings();
    applySettings();
    requestAnimationFrame(updateSourceVirtualList);
  });

  elements.themeToggle.addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    saveSettings();
    applySettings();
  });

  elements.settingsToggle.addEventListener('click', () => {
    state.settings.settingsPanelOpen = !state.settings.settingsPanelOpen;
    saveSettings();
    applySettings();
    requestAnimationFrame(updateSourceVirtualList);
  });

  elements.searchToggle.addEventListener('click', toggleSearchPanel);

  elements.searchInput.addEventListener('input', scheduleSearch);

  elements.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      moveSearch(event.shiftKey ? -1 : 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeSearchPanel({ clearQuery: true });
    }
  });

  elements.searchCaseToggle.addEventListener('click', () => {
    state.settings.searchCaseSensitive = !state.settings.searchCaseSensitive;
    saveSettings();
    updateSearchOptionButtons();
    runSearch({ scrollToFirst: true });
  });

  elements.searchWholeWordToggle.addEventListener('click', () => {
    state.settings.searchWholeWords = !state.settings.searchWholeWords;
    saveSettings();
    updateSearchOptionButtons();
    runSearch({ scrollToFirst: true });
  });

  elements.searchPrevButton.addEventListener('click', () => moveSearch(-1));
  elements.searchNextButton.addEventListener('click', () => moveSearch(1));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.searchOpen) {
      event.preventDefault();
      closeSearchPanel({ clearQuery: true });
    }
  });

  elements.fontFamilySelect.addEventListener('change', () => {
    state.settings.fontFamily = elements.fontFamilySelect.value;
    saveSettings();
    applySettings();
  });

  elements.fontSizeInput.addEventListener('input', () => {
    state.settings.fontSize = Number(elements.fontSizeInput.value);
    saveSettings();
    applySettings();
  });

  elements.copyWithLineNumbersToggle.addEventListener('click', () => {
    state.settings.copyWithLineNumbers = !state.settings.copyWithLineNumbers;
    saveSettings();
    syncControlStates();
  });

  elements.lineFromInput.addEventListener('change', () => {
    setSelectedLineRange(elements.lineFromInput.value, elements.lineToInput.value, { updateBlock: true });
  });

  elements.lineToInput.addEventListener('change', () => {
    setSelectedLineRange(elements.lineFromInput.value, elements.lineToInput.value, { updateBlock: true });
  });

  elements.copyRangeButton.addEventListener('click', copySelectedRange);

  elements.sourceViewport.addEventListener('scroll', () => requestAnimationFrame(updateSourceVirtualList));

  elements.sourceItems.addEventListener('click', (event) => {
    const lineButton = event.target.closest('.source-line');
    if (!lineButton) {
      return;
    }

    const lineNumber = Number(lineButton.dataset.line);
    if (event.shiftKey) {
      setSelectedLineRange(state.selectedLineStart, lineNumber, { scrollSource: false, updateBlock: true });
    } else {
      setSelectedLineRange(lineNumber, lineNumber, { scrollSource: false, updateBlock: true });
    }
  });

  elements.markdownBody.addEventListener('click', handleRenderedBlockClick);
  elements.markdownBody.addEventListener('pointerdown', startRenderedBlockTouchRange);
  elements.markdownBody.addEventListener('pointermove', handleRenderedBlockTouchMove);
  elements.markdownBody.addEventListener('pointerup', cancelTouchLongPressTimer);
  elements.markdownBody.addEventListener('pointercancel', cancelTouchLongPressTimer);
  elements.markdownBody.addEventListener('contextmenu', (event) => {
    const isRenderedBlock = Boolean(event.target.closest('[data-line-start][data-line-end]'));
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    if (state.touchRangeMode || state.suppressNextMarkdownClick || (isCoarsePointer && isRenderedBlock)) {
      event.preventDefault();
    }
  });

  elements.markdownBody.addEventListener('dblclick', (event) => {
    const block = event.target.closest('[data-line-start][data-line-end]');
    if (!block || !elements.markdownBody.contains(block)) {
      return;
    }

    selectRenderedBlock(block);
    copySelectedRange();
  });

  elements.markdownBody.addEventListener('scroll', () => requestAnimationFrame(updateScrollJumpControls));

  elements.scrollTopButton.addEventListener('click', () => scrollMarkdownToEdge('top'));
  elements.scrollBottomButton.addEventListener('click', () => scrollMarkdownToEdge('bottom'));

  document.addEventListener('dragenter', (event) => {
    event.preventDefault();
    elements.dropZone.hidden = false;
  });

  document.addEventListener('dragover', (event) => {
    event.preventDefault();
  });

  document.addEventListener('dragleave', (event) => {
    if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) {
      elements.dropZone.hidden = true;
    }
  });

  document.addEventListener('drop', (event) => {
    event.preventDefault();
    elements.dropZone.hidden = true;
    const file = event.dataTransfer?.files?.[0];
    openMarkdownFile(file, { clearBinding: true });
  });

  window.addEventListener('resize', () => {
    requestAnimationFrame(updateSourceVirtualList);
    requestAnimationFrame(updateScrollJumpControls);
  });
}

function boot() {
  applySettings();
  setSearchPanelOpen(false);
  bindEvents();
  bindViewportZoomGuards();
  bindInstallFlow();
  registerServiceWorker();
  updateSourceVirtualList();
  updateScrollJumpControls();
  void restoreLastLinkedFile();
}

boot();
