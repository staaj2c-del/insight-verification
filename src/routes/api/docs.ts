import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { readFileSync } from "fs";
import { join } from "path";

// GET /api/docs — renders API.md as styled HTML
export const Route = createFileRoute("/api/docs")({
  server: {
    handlers: {
      GET: async () => {
        let content = "";
        try {
          content = readFileSync(join(process.cwd(), "API.md"), "utf-8");
        } catch {
          return new Response("<h1>API docs not found</h1>", {
            status: 404,
            headers: { "Content-Type": "text/html" },
          });
        }

        const html = renderMarkdown(content);
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      },
    },
  },
});

function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  let out = "";
  let inCodeBlock = false;
  let codeLang = "";
  let codeBuf = "";
  let inTable = false;

  function flushCode() {
    if (!codeBuf.trim()) return "";
    const escaped = escapeHtml(codeBuf);
    const langClass = codeLang ? ` class="language-${codeLang}"` : "";
    const result = `<pre><code${langClass}>${escaped}</code></pre>`;
    codeBuf = "";
    codeLang = "";
    return result;
  }

  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        out += flushCode();
        inCodeBlock = false;
        continue;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeBuf = "";
        continue;
      }
    }

    if (inCodeBlock) {
      codeBuf += (codeBuf ? "\n" : "") + raw;
      continue;
    }

    // Tables
    if (line.startsWith("|") && line.endsWith("|")) {
      if (line.startsWith("|---") || line.startsWith("| ---")) continue; // separator row
      if (!inTable) { out += '<table class="api-table">'; inTable = true; }
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      out += "<tr>" + cells.map((c) => `<td>${renderInline(c)}</td>`).join("") + "</tr>";
      continue;
    }
    if (inTable) { out += "</table>"; inTable = false; }

    // Headings
    if (line.startsWith("### ")) {
      out += `<h3>${renderInline(line.slice(4))}</h3>`;
    } else if (line.startsWith("## ")) {
      out += `<h2>${renderInline(line.slice(3))}</h2>`;
    } else if (line.startsWith("# ")) {
      out += `<h1>${renderInline(line.slice(2))}</h1>`;
    } else if (line.startsWith("---")) {
      out += "<hr>";
    } else if (line.trim() === "") {
      out += "";
    } else {
      out += `<p>${renderInline(line)}</p>`;
    }
  }

  if (inTable) { out += "</table>"; }
  if (inCodeBlock) out += flushCode();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>API Docs | Insight Bot Verification</title>
<style>
  :root {
    --bg: #0a0a0b;
    --card: #111115;
    --border: #222228;
    --fg: #e4e4e7;
    --muted: #71717a;
    --primary: #5865F2;
    --accent: #3b82f6;
    --code-bg: #1a1a22;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg);
    color: var(--fg);
    line-height: 1.7;
  }
  .container { max-width: 820px; margin: 0 auto; padding: 40px 24px 80px; }
  h1 { font-size: 2rem; margin-bottom: 0.3em; }
  h2 { font-size: 1.4rem; margin-top: 2em; margin-bottom: 0.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
  h3 { font-size: 1.1rem; margin-top: 1.5em; margin-bottom: 0.5em; }
  p { margin-bottom: 0.8em; color: #d4d4d8; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    overflow-x: auto;
    margin-bottom: 1em;
    font-size: 0.875rem;
  }
  code { font-family: "Fira Code", "JetBrains Mono", monospace; font-size: 0.85rem; }
  p code { background: var(--code-bg); padding: 1px 6px; border-radius: 4px; font-size: 0.85em; }
  .api-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1em;
    font-size: 0.875rem;
  }
  .api-table td {
    border: 1px solid var(--border);
    padding: 8px 12px;
    vertical-align: top;
  }
  .api-table tr:first-child td { font-weight: 600; background: var(--card); }
  hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
  .header-bar {
    display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
    padding-bottom: 16px; border-bottom: 1px solid var(--border);
  }
  .badge { display: inline-block; background: var(--primary); color: #fff; font-size: 0.7rem;
    font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .nav-back { font-size: 0.875rem; color: var(--muted); }
  .nav-back:hover { color: var(--fg); }
</style>
</head>
<body>
<div class="container">
  <div class="header-bar">
    <span class="badge">API v1</span>
    <a href="/" class="nav-back">← verify.insightbot.online</a>
    <a href="/dashboard" class="nav-back" style="margin-left:8px">Dashboard</a>
  </div>
  ${out}
</div>
</body>
</html>`;
}

function renderInline(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

