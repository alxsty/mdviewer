import DOMPurify from 'dompurify';
import './styles.css';
import 'highlight.js/styles/github-dark.css';

const SETTINGS_KEY = 'md-viewer-v1-settings';
const SETTINGS_SCHEMA_VERSION = 3;
const INSTALL_STATE_KEY = 'md-viewer-install-state';
const DEFAULT_SETTINGS = Object.freeze({
  theme: 'dark',
  fontFamily: 'system',
  fontSize: 18,
  showLineNumbers: false,
  copyWithLineNumbers: false,
  settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
  sourcePanelOpen: false,
  settingsPanelOpen: false
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

const elements = Object.freeze({
  appShell: document.querySelector('#app'),
  settingsbar: document.querySelector('#settingsbar'),
  fileInput: document.querySelector('#fileInput'),
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
  copyWithLineNumbersInput: document.querySelector('#copyWithLineNumbersInput'),
  markdownBody: document.querySelector('#markdownBody'),
  dropZone: document.querySelector('#dropZone'),
  statusbar: document.querySelector('#statusbar'),
  lineFromInput: document.querySelector('#lineFromInput'),
  lineToInput: document.querySelector('#lineToInput'),
  copyRangeButton: document.querySelector('#copyRangeButton'),
  sourceViewport: document.querySelector('#sourceViewport'),
  sourceSpacer: document.querySelector('#sourceSpacer'),
  sourceItems: document.querySelector('#sourceItems')
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
  headingObserver: null,
  activeHeadingSlug: '',
  frontmatter: null
};

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

function syncControlStates() {
  const sourcePanelOpen = Boolean(state.settings.sourcePanelOpen);
  const tocPanelOpen = elements.tocPanel.classList.contains('open');
  const lineNumbersVisible = Boolean(state.settings.showLineNumbers);
  const darkThemeActive = state.settings.theme === 'dark';
  const settingsPanelOpen = Boolean(state.settings.settingsPanelOpen);

  setPressedState(
    elements.linePanelToggle,
    sourcePanelOpen,
    'Nascondi pannello righe',
    'Mostra pannello righe'
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

  setPressedState(
    elements.themeToggle,
    darkThemeActive,
    'Tema dark attivo. Passa a tema chiaro',
    'Tema chiaro attivo. Passa a tema dark',
    '☾',
    '☀'
  );

  setPressedState(
    elements.settingsToggle,
    settingsPanelOpen,
    'Nascondi impostazioni',
    'Mostra impostazioni'
  );
}

function setTocPanelOpen(isOpen) {
  elements.tocPanel.classList.toggle('open', Boolean(isOpen));
  syncControlStates();
}

function toggleTocPanel() {
  setTocPanelOpen(!elements.tocPanel.classList.contains('open'));
}

function applySettings() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.body.classList.toggle('line-numbers', Boolean(state.settings.showLineNumbers));
  document.documentElement.style.setProperty('--reader-font-size', `${state.settings.fontSize}px`);
  document.documentElement.style.setProperty('--reader-font-family', FONT_FAMILIES[state.settings.fontFamily] || FONT_FAMILIES.system);

  elements.fontFamilySelect.value = state.settings.fontFamily;
  elements.fontSizeInput.value = String(state.settings.fontSize);
  elements.fontSizeOutput.textContent = `${state.settings.fontSize}px`;
  elements.copyWithLineNumbersInput.checked = Boolean(state.settings.copyWithLineNumbers);
  elements.sourcePanel.hidden = !state.settings.sourcePanelOpen;
  elements.settingsbar.hidden = !state.settings.settingsPanelOpen;
  document.body.classList.toggle('settings-collapsed', !state.settings.settingsPanelOpen);
  syncControlStates();
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

  const fileInfo = state.currentFileName ? `${state.currentFileName} · ` : '';
  const highlightInfo = result.stats?.highlightDisabled ? ' · highlight codice disattivato per performance' : '';
  const metadataInfo = state.frontmatter?.detected ? ' · metadati YAML' : '';
  setStatus(`${fileInfo}${state.sourceLines.length} righe · ${formatBytes(state.markdownText.length)} · render ${result.stats?.elapsedMs ?? '?'} ms${metadataInfo}${highlightInfo}`);
}

function renderMarkdown(html, frontmatter = null) {
  const safeHtml = DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'data-line-start', 'data-line-end', 'data-heading-level', 'tabindex', 'class', 'type', 'checked', 'disabled'],
    ADD_TAGS: ['mark', 'input']
  });

  elements.markdownBody.classList.remove('empty-state');
  elements.markdownBody.innerHTML = safeHtml;

  const metadataCard = createFrontmatterCard(frontmatter);
  if (metadataCard) {
    elements.markdownBody.prepend(metadataCard);
  }
}

function createFrontmatterCard(frontmatter) {
  if (!frontmatter?.detected) {
    return null;
  }

  const details = document.createElement('details');
  details.className = 'metadata-card';
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

async function openMarkdownFile(file) {
  if (!file) {
    return;
  }

  state.currentFileName = file.name;
  setStatus(`Caricamento ${file.name} (${formatBytes(file.size)})…`);

  try {
    const text = await file.text();
    loadMarkdownText(text, file.name);
  } catch (error) {
    setStatus(`Impossibile leggere il file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function loadMarkdownText(text, fileName = '') {
  state.markdownText = text;
  state.currentFileName = fileName;
  state.frontmatter = null;
  state.sourceLines = splitMarkdownLines(text);
  state.selectedLineStart = 1;
  state.selectedLineEnd = Math.min(1, state.sourceLines.length);
  elements.lineFromInput.max = String(state.sourceLines.length);
  elements.lineToInput.max = String(state.sourceLines.length);
  setSelectedLineRange(1, 1, { scrollSource: false, updateBlock: false });
  updateSourceVirtualList();
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
  const top = Math.max(lineNumber - VIRTUAL_OVERSCAN_LINES, 0) * VIRTUAL_LINE_HEIGHT_PX;
  elements.sourceViewport.scrollTo({ top, behavior: 'smooth' });
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
    .map((line, index) => includeLineNumbers ? `[${from + index}:]${line}` : line)
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

function selectRenderedBlock(block, options = {}) {
  const { updateRange = true } = options;

  if (state.selectedBlockElement) {
    state.selectedBlockElement.classList.remove('selected-source-block');
  }

  state.selectedBlockElement = block;
  state.selectedBlockElement.classList.add('selected-source-block');

  if (updateRange) {
    const start = Number(block.getAttribute('data-line-start'));
    const end = Number(block.getAttribute('data-line-end')) || start;
    setSelectedLineRange(start, end, { scrollSource: true, updateBlock: false });
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

function watchServiceWorkerUpdates(registration) {
  if (registration.waiting && navigator.serviceWorker.controller) {
    createUpdateBanner(registration);
  }

  registration.addEventListener('updatefound', () => {
    const newWorker = registration.installing;
    if (!newWorker) {
      return;
    }

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        createUpdateBanner(registration);
      }
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (state.updateReloadPending) {
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

  elements.copyWithLineNumbersInput.addEventListener('change', () => {
    state.settings.copyWithLineNumbers = elements.copyWithLineNumbersInput.checked;
    saveSettings();
    applySettings();
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

  elements.markdownBody.addEventListener('click', (event) => {
    const block = event.target.closest('[data-line-start][data-line-end]');
    if (!block || !elements.markdownBody.contains(block)) {
      return;
    }

    selectRenderedBlock(block);
  });

  elements.markdownBody.addEventListener('dblclick', (event) => {
    const block = event.target.closest('[data-line-start][data-line-end]');
    if (!block || !elements.markdownBody.contains(block)) {
      return;
    }

    selectRenderedBlock(block);
    copySelectedRange();
  });

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
    openMarkdownFile(file);
  });

  window.addEventListener('resize', () => requestAnimationFrame(updateSourceVirtualList));
}

function boot() {
  applySettings();
  bindEvents();
  bindInstallFlow();
  registerServiceWorker();
  updateSourceVirtualList();
}

boot();
