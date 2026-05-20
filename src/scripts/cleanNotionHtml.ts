/**
 * cleanNotionHtml.ts
 *
 * Strips Notion export noise and extracts:
 *   - title        (from <h1> or <title>)
 *   - tags         (from a "tags" property block, if present)
 *   - content      (sanitized inner HTML, blog-ready)
 *
 * Usage:
 *   import { cleanNotionHtml } from '../../utils/cleanNotionHtml';
 *   const { title, tags, content } = cleanNotionHtml(rawHtml);
 */

export type LogEntry = {
  title: string;
  tags: string[];
  content: string;
};

export function cleanNotionHtml(raw: string): LogEntry {
  // ── 1. Extract body content ───────────────────────────────────────────────
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : raw;

  // ── 2. Strip Notion wrapper article/page div ──────────────────────────────
  const articleMatch = body.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) body = articleMatch[1];

  // ── 3. Parse title ────────────────────────────────────────────────────────
  let title = 'untitled';
  const h1Match = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) title = stripTags(h1Match[1]).trim();
  if (title === 'untitled') {
    const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) title = stripTags(titleMatch[1]).trim();
  }

  // ── 4. Extract tags ───────────────────────────────────────────────────────
  const tags: string[] = [];
  const tagRowMatch = body.match(/tags?[^:]*:\s*(.*?)(?:<\/|$)/i);
  if (tagRowMatch) {
    const raw_tags = stripTags(tagRowMatch[1]);
    raw_tags.split(/[,;]+/).forEach(t => {
      const clean = t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (clean) tags.push(clean);
    });
  }

  // ── 5. Clean content HTML ─────────────────────────────────────────────────
  let content = body;

  // ── Equations (KaTeX) — stash before ANY stripping ───────────────────────
  // Notion exports equations as <figure class="equation"> with two children:
  //   - katex-mathml: raw MathML rendered as ugly plain text by browsers
  //   - katex-html:   the actual pretty render — needs KaTeX CSS + inline styles intact
  // Strategy: extract each equation into a stash array and replace with a plain
  // text placeholder, run all stripping freely, then restore equations at the end.
  // This is simpler and more reliable than trying to protect styles mid-pipeline.
  const equationStash: string[] = [];
  content = content.replace(
    /<figure[^>]*class="[^"]*equation[^"]*"[^>]*>[\s\S]*?(<span class="katex-display">[\s\S]*?<\/span><\/span><\/span>)\s*<\/div>\s*<\/figure>/gi,
    (_, katexDisplay) => {
      // Strip katex-mathml (plain-text MathML fallback — causes junk numbers)
      const clean = katexDisplay.replace(
        /<span class="katex-mathml">[\s\S]*?<\/span>(?=\s*<span class="katex-html")/i,
        ''
      );
      const placeholder = `__EQ_${equationStash.length}__`;
      equationStash.push(`<div class="log-equation">${clean}</div>`);
      return placeholder;
    }
  );
  const hasEquations = equationStash.length > 0;

  // ── Toggle lists — unwrap before class stripping ──────────────────────────
  // Notion wraps <details> toggles in <ul class="toggle"><li>...</li></ul>.
  // After class stripping that becomes a plain <ul><li>, picking up our
  // li::before ">" bullet and causing a phantom ">" above every dropdown.
  content = content.replace(
    /<ul[^>]*class="[^"]*toggle[^"]*"[^>]*>\s*<li>([\s\S]*?)<\/li>\s*<\/ul>/gi,
    (_, inner) => inner.trim()
  );

  // Remove Notion property tables
  content = content.replace(/<table class="properties[\s\S]*?<\/table>/gi, '');

  // Remove inline styles
  content = content.replace(/\s*style="[^"]*"/gi, '');

  // Remove class attributes
  content = content.replace(/\s*class="[^"]*"/gi, '');

  // Remove id attributes
  content = content.replace(/\s*id="[^"]*"/gi, '');

  // Remove empty block containers Notion adds
  content = content.replace(/<div>\s*<\/div>/gi, '');
  content = content.replace(/<p>\s*<\/p>/gi, '');
  content = content.replace(/<figure>\s*<\/figure>/gi, '');

  // Convert Notion's <figure> image blocks to plain <img>
  content = content.replace(
    /<figure[^>]*>\s*<img([^>]*)>\s*(?:<figcaption[^>]*>([\s\S]*?)<\/figcaption>)?\s*<\/figure>/gi,
    (_, attrs, caption) =>
      `<img${attrs}>${caption ? `<p><em>${caption.trim()}</em></p>` : ''}`
  );

  // Convert Notion callout blocks → blockquote
  content = content.replace(
    /<div[^>]*notion-callout[^>]*>([\s\S]*?)<\/div>/gi,
    (_, inner) => `<blockquote>${inner}</blockquote>`
  );

  // Strip span attributes
  content = content.replace(/<span([^>]*)>/gi, '<span>');

  // Preserve toggle/detail wrappers as interactive <details><summary>
  content = content.replace(/<details([^>]*)>/gi, '<details class="log-toggle">');
  content = content.replace(/<summary([^>]*)>/gi, '<summary class="log-toggle-label">');

  // Remove script and style tags
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');

  // ── Restore stashed equations ─────────────────────────────────────────────
  equationStash.forEach((eq, i) => {
    content = content.replace(`__EQ_${i}__`, eq);
  });

  // Inject KaTeX CSS once at the top if the log has any equations
  if (hasEquations) {
    content = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css">\n` + content;
  }

  // Remove Notion bookmark blocks → plain link
  content = content.replace(
    /<div[^>]*notion-bookmark[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/div>/gi,
    (_, href, text) => `<p><a href="${href}">${stripTags(text).trim()}</a></p>`
  );

  // Fix heading anchors Notion adds:  <h2><a href="#...">text</a></h2>  → <h2>text</h2>
  content = content.replace(
    /<(h[1-6])><a[^>]*>([\s\S]*?)<\/a><\/(h[1-6])>/gi,
    '<$1>$2</$3>'
  );

  // Collapse multiple blank lines
  content = content.replace(/(\s*\n){3,}/g, '\n\n');

  content = content.trim();

  return { title, tags, content };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}