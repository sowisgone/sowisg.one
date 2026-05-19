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
  // Notion wraps everything in <article class="page ..."> or <div class="page-body">
  const articleMatch = body.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) body = articleMatch[1];

  // ── 3. Parse title ────────────────────────────────────────────────────────
  let title = 'untitled';
  const h1Match = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    title = stripTags(h1Match[1]).trim();
    // Remove the h1 from body — we'll keep it in content too (styled by blog.css)
  }
  if (title === 'untitled') {
    const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) title = stripTags(titleMatch[1]).trim();
  }

  // ── 4. Extract tags ───────────────────────────────────────────────────────
  // Notion exports property rows like:
  //   <table class="properties"><tr><th>Tags</th><td>...</td></tr></table>
  // OR plain text like:  tags: dev, astro
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

  // Remove Notion property tables (first table is usually metadata)
  content = content.replace(/<table class="properties[\s\S]*?<\/table>/gi, '');

  // Remove inline styles (Notion adds tons of these)
  content = content.replace(/\s*style="[^"]*"/gi, '');

  // Remove Notion-specific class attributes
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

  // Convert <span class="notion-..."> → plain span
  content = content.replace(/<span([^>]*)>/gi, '<span>');

  // Strip toggle/detail wrappers (Notion uses <details><summary>)
  content = content.replace(/<details[^>]*>/gi, '<div>');
  content = content.replace(/<\/details>/gi, '</div>');
  content = content.replace(/<summary[^>]*>/gi, '<strong>');
  content = content.replace(/<\/summary>/gi, '</strong>');

  // Remove script and style tags
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Remove Notion bookmark blocks (replace with plain link if possible)
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

  // Trim
  content = content.trim();

  return { title, tags, content };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}
