import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import container from 'markdown-it-container';
import hljs from 'highlight.js/lib/common';

const MAX_HIGHLIGHT_DOCUMENT_CHARS = 1_500_000;
const MAX_HIGHLIGHT_BLOCK_CHARS = 80_000;
const HEADING_OPEN = 'heading_open';
const INLINE = 'inline';
const LINK_OPEN = 'link_open';
const FENCE = 'fence';
const CODE_BLOCK = 'code_block';
const BLOCK_TYPES_WITH_LINE_ATTRS = new Set([
  'paragraph_open',
  HEADING_OPEN,
  'blockquote_open',
  'bullet_list_open',
  'ordered_list_open',
  'list_item_open',
  'table_open',
  'thead_open',
  'tbody_open',
  'tr_open',
  'th_open',
  'td_open',
  'hr',
  FENCE,
  CODE_BLOCK
]);

const FRONTMATTER_START_DELIMITER = '---';
const FRONTMATTER_ALT_END_DELIMITER = '...';
const FRONTMATTER_COMMENT_PREFIX = '#';
const FRONTMATTER_MAX_SUMMARY_VALUE_LENGTH = 220;

const splitSourceLines = (source) => source.split(/\r\n|\n|\r/);

const stripBom = (value) => String(value || '').replace(/^\uFEFF/, '');

const unquoteYamlScalar = (value) => {
  const trimmed = String(value || '').trim();

  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  return trimmed;
};

const truncateSummaryValue = (value) => {
  const normalized = normalizeText(value);
  return normalized.length > FRONTMATTER_MAX_SUMMARY_VALUE_LENGTH
    ? `${normalized.slice(0, FRONTMATTER_MAX_SUMMARY_VALUE_LENGTH - 1)}…`
    : normalized;
};

const parseFrontmatterLine = (line, lineNumber) => {
  const raw = String(line || '');
  const trimmed = raw.trim();

  if (!trimmed || trimmed.startsWith(FRONTMATTER_COMMENT_PREFIX)) {
    return {
      type: 'raw',
      key: '',
      value: raw,
      lineNumber
    };
  }

  const separatorIndex = raw.indexOf(':');

  if (separatorIndex <= 0) {
    return {
      type: 'raw',
      key: '',
      value: raw,
      lineNumber
    };
  }

  const key = raw.slice(0, separatorIndex).trim();
  const value = unquoteYamlScalar(raw.slice(separatorIndex + 1));

  return {
    type: 'pair',
    key,
    value: truncateSummaryValue(value),
    lineNumber
  };
};

const extractFrontmatter = (source) => {
  const lines = splitSourceLines(source);
  const firstLine = stripBom(lines[0] || '').trim();

  if (firstLine !== FRONTMATTER_START_DELIMITER) {
    return {
      renderSource: source,
      frontmatter: null
    };
  }

  let closingIndex = -1;

  for (let index = 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (trimmed === FRONTMATTER_START_DELIMITER || trimmed === FRONTMATTER_ALT_END_DELIMITER) {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex < 0) {
    return {
      renderSource: source,
      frontmatter: null
    };
  }

  const rawLines = lines.slice(1, closingIndex);
  const lineEnd = closingIndex + 1;
  const entries = rawLines.map((line, index) => parseFrontmatterLine(line, index + 2));
  const firstTitleEntry = entries.find((entry) => entry.type === 'pair' && entry.key.toLowerCase() === 'title');

  return {
    renderSource: `${'\n'.repeat(lineEnd)}${lines.slice(lineEnd).join('\n')}`,
    frontmatter: {
      detected: true,
      format: 'YAML frontmatter',
      title: firstTitleEntry?.value || '',
      lineStart: 1,
      lineEnd,
      rawLines,
      entries
    }
  };
};


const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const normalizeText = (value) => String(value || '')
  .replace(/\s+/g, ' ')
  .trim();

const createSlugFactory = () => {
  const counters = new Map();

  return (rawValue) => {
    const normalized = normalizeText(rawValue)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s_-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-');

    const baseSlug = normalized || 'heading';
    const count = counters.get(baseSlug) || 0;
    counters.set(baseSlug, count + 1);
    return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
  };
};

const addLineAttributes = (token) => {
  if (!token.map || token.map.length < 2) {
    return;
  }

  const start = token.map[0] + 1;
  const end = token.map[1];
  token.attrSet('data-line-start', String(start));
  token.attrSet('data-line-end', String(end));
};

const createMarkdownIt = () => {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: false,
    highlight: (source, language, _attrs, env) => {
      if (env.disableHighlight || source.length > MAX_HIGHLIGHT_BLOCK_CHARS) {
        return escapeHtml(source);
      }

      if (language && hljs.getLanguage(language)) {
        try {
          return hljs.highlight(source, { language, ignoreIllegals: true }).value;
        } catch (_error) {
          return escapeHtml(source);
        }
      }

      try {
        return hljs.highlightAuto(source).value;
      } catch (_error) {
        return escapeHtml(source);
      }
    }
  });

  md.use(footnote);
  md.use(taskLists, { enabled: false, label: true, labelAfter: true });
  md.use(container, 'tip', {
    render: (tokens, idx) => tokens[idx].nesting === 1
      ? '<div class="custom-block tip">\n'
      : '</div>\n'
  });
  md.use(container, 'note', {
    render: (tokens, idx) => tokens[idx].nesting === 1
      ? '<div class="custom-block note">\n'
      : '</div>\n'
  });
  md.use(container, 'warning', {
    render: (tokens, idx) => tokens[idx].nesting === 1
      ? '<div class="custom-block warning">\n'
      : '</div>\n'
  });

  md.core.ruler.push('toc_and_source_lines', (state) => {
    const slugify = createSlugFactory();
    const toc = [];

    for (let index = 0; index < state.tokens.length; index += 1) {
      const token = state.tokens[index];

      if (BLOCK_TYPES_WITH_LINE_ATTRS.has(token.type)) {
        addLineAttributes(token);
      }

      if (token.type === LINK_OPEN) {
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noopener noreferrer');
      }

      if (token.type === HEADING_OPEN) {
        const inlineToken = state.tokens[index + 1];
        const title = inlineToken?.type === INLINE ? normalizeText(inlineToken.content) : 'Heading';
        const slug = slugify(title);
        const level = Number(token.tag.replace('h', '')) || 1;
        const lineStart = token.map ? token.map[0] + 1 : null;
        const lineEnd = token.map ? token.map[1] : null;

        token.attrSet('id', slug);
        token.attrSet('tabindex', '-1');
        token.attrSet('data-heading-level', String(level));

        toc.push({
          level,
          title,
          slug,
          lineStart,
          lineEnd
        });
      }
    }

    state.env.toc = toc;
  });

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet('target', '_blank');
    tokens[idx].attrSet('rel', 'noopener noreferrer');
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = token.info ? token.info.trim() : '';
    const languageName = info ? info.split(/\s+/g)[0] : '';
    const highlighted = options.highlight
      ? options.highlight(token.content, languageName, '', env)
      : escapeHtml(token.content);
    const languageClass = languageName ? ` class="hljs language-${escapeHtml(languageName)}"` : ' class="hljs"';
    const lineStart = token.map ? token.map[0] + 1 : '';
    const lineEnd = token.map ? token.map[1] : '';

    return `<pre data-line-start="${lineStart}" data-line-end="${lineEnd}"><code${languageClass}>${highlighted}</code></pre>\n`;
  };

  return md;
};

const md = createMarkdownIt();

self.addEventListener('message', (event) => {
  const { id, markdown } = event.data || {};
  const startedAt = performance.now();

  try {
    const source = typeof markdown === 'string' ? markdown : '';
    const { renderSource, frontmatter } = extractFrontmatter(source);
    const env = {
      toc: [],
      disableHighlight: source.length > MAX_HIGHLIGHT_DOCUMENT_CHARS
    };
    const html = md.render(renderSource, env);
    const elapsedMs = Math.round(performance.now() - startedAt);

    self.postMessage({
      id,
      ok: true,
      html,
      toc: env.toc,
      frontmatter,
      stats: {
        elapsedMs,
        chars: source.length,
        highlightDisabled: env.disableHighlight
      }
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
