// APEXLang parser — v1
//
// Grammar observed from real APEX 26.1 exports (Oracle "Reading APEXlang Syntax"
// reference + fixtures in ../fixtures):
//
//   block:    <type> [identifier] ( <entry>* )
//   group:    <key> { <entry>* }
//   property: <key>: <value>
//   value:    fenced code (```lang ... ```) | array ([ v v v ]) | bare text to EOL
//   refs:     @path/to/thing        (component reference)
//   token:    #PLACEHOLDER#         (e.g. #DEFAULT#)
//
// Not spec-complete (no formal grammar file is public — this is reverse-fit to
// real exports). Good enough to build a structural tree for visualization.

function isIdentChar(ch) {
  return /[A-Za-z0-9_\-./]/.test(ch);
}

function isWhitespace(ch) {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

class Cursor {
  constructor(text) {
    this.text = text;
    this.pos = 0;
    this.len = text.length;
  }

  peek() {
    return this.text[this.pos];
  }

  eof() {
    return this.pos >= this.len;
  }

  skipWhitespace() {
    while (!this.eof() && isWhitespace(this.peek())) this.pos++;
  }

  skipInlineWhitespace() {
    while (!this.eof() && (this.peek() === ' ' || this.peek() === '\t')) this.pos++;
  }

  readWord() {
    const start = this.pos;
    while (!this.eof() && isIdentChar(this.peek())) this.pos++;
    return this.text.slice(start, this.pos);
  }

  // Identifiers can be bare words OR double-quoted strings (e.g.
  // `installScript "Install Data" (`) when the name contains spaces/
  // punctuation that isIdentChar excludes.
  readIdentifierOrQuoted() {
    if (this.peek() === '"') {
      const start = this.pos;
      this.pos++;
      while (!this.eof() && this.peek() !== '"') {
        if (this.peek() === '\\') this.pos++; // skip escaped char
        this.pos++;
      }
      if (!this.eof()) this.pos++; // consume closing quote
      return this.text.slice(start + 1, this.pos - 1);
    }
    return this.readWord();
  }

  readToEol() {
    const start = this.pos;
    while (!this.eof() && this.peek() !== '\n') this.pos++;
    const value = this.text.slice(start, this.pos).trim();
    return value;
  }

  startsWith(str) {
    return this.text.startsWith(str, this.pos);
  }
}

function readFencedBlock(cur) {
  // cur.pos is at the opening ```
  cur.pos += 3;
  // optional language tag to end of this line
  let langStart = cur.pos;
  while (!cur.eof() && cur.peek() !== '\n') cur.pos++;
  const lang = cur.text.slice(langStart, cur.pos).trim();
  if (!cur.eof()) cur.pos++; // consume newline
  const bodyStart = cur.pos;
  const closeIdx = cur.text.indexOf('```', cur.pos);
  const bodyEnd = closeIdx === -1 ? cur.len : closeIdx;
  const body = cur.text.slice(bodyStart, bodyEnd).replace(/\s+$/, '');
  cur.pos = closeIdx === -1 ? cur.len : closeIdx + 3;
  return { kind: 'code', lang: lang || null, text: body };
}

function readArray(cur) {
  // cur.pos is at '['
  cur.pos++;
  const items = [];
  while (!cur.eof()) {
    cur.skipWhitespace();
    if (cur.peek() === ']') { cur.pos++; break; }
    const start = cur.pos;
    while (!cur.eof() && cur.peek() !== '\n' && cur.peek() !== ']') cur.pos++;
    const item = cur.text.slice(start, cur.pos).trim();
    if (item) items.push(item);
    if (cur.peek() === ']') { cur.pos++; break; }
  }
  return { kind: 'array', items };
}

function readValue(cur) {
  cur.skipInlineWhitespace();
  if (cur.startsWith('```')) return readFencedBlock(cur);
  if (cur.peek() === '[') return readArray(cur);

  // The fence (or an array) may start on the following line, indented
  // (e.g. `htmlCode:\n    ```html`). Look ahead past blank/whitespace-only
  // lines; if we don't land on a fence/array, rewind and treat as a
  // same-line scalar (usually empty in that case).
  if (cur.peek() === '\n' || cur.peek() === '\r') {
    const saved = cur.pos;
    cur.skipWhitespace();
    if (cur.startsWith('```')) return readFencedBlock(cur);
    if (cur.peek() === '[') return readArray(cur);
    cur.pos = saved;
  }

  const text = cur.readToEol();
  return { kind: 'scalar', text };
}

// Parses entries inside a block/group until `closeChar` is consumed.
// Returns an array of entry nodes.
function parseEntries(cur, closeChar) {
  const entries = [];
  while (true) {
    cur.skipWhitespace();
    if (cur.eof()) break;
    if (cur.peek() === closeChar) { cur.pos++; break; }

    // skip stray characters we don't understand (defensive, avoids infinite loop)
    if (!isIdentChar(cur.peek())) { cur.pos++; continue; }

    const entryStart = cur.pos; // offset of word1 — used for click-to-navigate
    const word1 = cur.readWord();
    cur.skipInlineWhitespace();

    if (cur.peek() === '(' || cur.peek() === '{') {
      const isBlock = cur.peek() === '(';
      cur.pos++;
      const children = parseEntries(cur, isBlock ? ')' : '}');
      entries.push({
        kind: isBlock ? 'block' : 'group',
        typeName: word1,
        identifier: null,
        children,
        startOffset: entryStart,
      });
      continue;
    }

    if (cur.peek() === ':') {
      cur.pos++;
      const value = readValue(cur);
      entries.push({ kind: 'property', key: word1, value });
      continue;
    }

    // word1 was a type name; word2 might be its identifier (bare word or
    // a "quoted string" — e.g. `installScript "Install Data" (`)
    if (isIdentChar(cur.peek()) || cur.peek() === '"') {
      const savedPos = cur.pos;
      const word2 = cur.readIdentifierOrQuoted();
      cur.skipInlineWhitespace();
      if (cur.peek() === '(' || cur.peek() === '{') {
        const isBlock = cur.peek() === '(';
        cur.pos++;
        const children = parseEntries(cur, isBlock ? ')' : '}');
        entries.push({
          kind: isBlock ? 'block' : 'group',
          typeName: word1,
          identifier: word2,
          children,
          startOffset: entryStart,
        });
        continue;
      }
      // didn't turn out to be an identifier — rewind, treat word1 alone
      cur.pos = savedPos;
    }

    // couldn't classify — treat as a bare property with no value to avoid getting stuck
    entries.push({ kind: 'property', key: word1, value: { kind: 'scalar', text: '' } });
  }
  return entries;
}

// Strips full-line `//` comments (not officially documented, defensive only —
// APEXLang's comment syntax isn't confirmed anywhere in Oracle's published
// reference, this is a guess). Skips content inside ``` fenced blocks so it
// never mangles a `//` that's part of embedded JS/CSS/PL-SQL source.
function stripLineComments(text) {
  const lines = text.split('\n');
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return /^\s*\/\//.test(line) ? '' : line;
    })
    .join('\n');
}

function parseApx(text) {
  const cleaned = stripLineComments(text);
  const cur = new Cursor(cleaned);
  const roots = parseEntries(cur, ' '); // sentinel: never matches, consumes to EOF
  return roots;
}

// Flattens the parsed tree into a graph-friendly node/edge structure for the webview.
// Only 'block' entries become graph nodes; 'group' entries contribute their
// scalar properties to the nearest enclosing block node (as metadata), and
// nested blocks inside groups (rare) still become child nodes.
// 0-based line number for a character offset — good enough for
// click-to-navigate (jumps to the start of the block's declaration line;
// doesn't need to be column-precise). Note: stripLineComments() preserves
// line COUNT (blanks comment lines rather than removing them), so offsets
// computed against the cleaned text still map to the right line in the
// original file.
function offsetToLine(text, offset) {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

let _nodeSeq = 0;
function buildGraph(entries, parentId, nodes, edges, cleanedText) {
  for (const entry of entries) {
    if (entry.kind === 'block') {
      const id = `n${_nodeSeq++}`;
      const props = {};
      collectPropsInto(entry.children, props);
      nodes.push({
        id,
        typeName: entry.typeName,
        identifier: entry.identifier,
        label: props.name || entry.identifier || entry.typeName,
        props,
        line: offsetToLine(cleanedText, entry.startOffset),
      });
      if (parentId) edges.push({ from: parentId, to: id, kind: 'contains' });
      buildGraph(entry.children, id, nodes, edges, cleanedText);
    } else if (entry.kind === 'group') {
      buildGraph(entry.children, parentId, nodes, edges, cleanedText);
    }
    // 'property' entries are absorbed via collectPropsInto, nothing to recurse into
  }
}

function collectPropsInto(entries, props) {
  for (const entry of entries) {
    if (entry.kind === 'property' && entry.value.kind === 'scalar') {
      if (!(entry.key in props)) props[entry.key] = entry.value.text;
    } else if (entry.kind === 'group') {
      collectPropsInto(entry.children, props);
    }
  }
}

// Component cross-references: a block declares an identifier (`button save
// (...)`), and elsewhere a property value points at it with `@identifier`
// (`button: @save`). `@/path/to/template` refs (leading slash) point at
// built-in Universal Theme templates, not local blocks — the char class
// below deliberately excludes '/' so those never match, no local node could
// resolve them anyway. Confirmed against real exports (see
// apex-apps/sample-apps/brookstrut-sample-app/pages/p00007.apx: `button save
// (` + later `button: @save`) rather than guessed from the docs.
const REF_PATTERN = /@([A-Za-z0-9_-]+)/g;

function resolveReferences(nodes, edges) {
  const byIdentifier = new Map();
  for (const n of nodes) {
    if (!n.identifier) continue;
    if (!byIdentifier.has(n.identifier)) byIdentifier.set(n.identifier, []);
    byIdentifier.get(n.identifier).push(n);
  }

  for (const n of nodes) {
    for (const [key, value] of Object.entries(n.props || {})) {
      if (typeof value !== 'string' || value.indexOf('@') === -1) continue;
      REF_PATTERN.lastIndex = 0;
      let m;
      while ((m = REF_PATTERN.exec(value)) !== null) {
        const targets = byIdentifier.get(m[1]);
        if (!targets) continue;
        for (const target of targets) {
          if (target.id === n.id) continue;
          edges.push({ from: n.id, to: target.id, kind: 'reference', via: key });
        }
      }
    }
  }
}

// Page-to-page navigation (roadmap #3): a button/dynamicAction/branch can
// trigger client-side or server-side navigation to another page via
// `behavior { action: redirectThisApp target: { page: N } } }` or a page-level
// `branch (... behavior { target: { page: N } } )`. Both nest the target
// under groups, which collectPropsInto already flattens onto the enclosing
// block's props — confirmed against real exports (grep across
// apex-apps/sample-apps: `action: redirectThisApp` appears 420 times; the
// page-level `branch (...)` form is used e.g. in apextogo/pages/p00008-cart.apx
// "Go to Orders" -> target.page: 9). This function only detects the target
// PAGE NUMBER from single-file data — resolving that number to an actual
// file is a workspace-level concern the parser has no business doing, so
// it's left to the caller (extension.js, which already owns filesystem
// access) via the returned `navTargets` array.
const NAV_TRIGGER_TYPES = new Set(['branch', 'button', 'dynamicAction']);

function collectNavTargets(nodes) {
  const targets = [];
  for (const n of nodes) {
    if (!NAV_TRIGGER_TYPES.has(n.typeName)) continue;
    const page = n.props && n.props.page;
    if (page && /^\d+$/.test(page.trim())) {
      targets.push({ from: n.id, pageNumber: String(parseInt(page, 10)) });
    }
  }
  return targets;
}

function parseApxToGraph(text) {
  _nodeSeq = 0;
  const cleanedText = stripLineComments(text);
  const cur = new Cursor(cleanedText);
  const entries = parseEntries(cur, ' ');
  const nodes = [];
  const edges = [];
  buildGraph(entries, null, nodes, edges, cleanedText);
  resolveReferences(nodes, edges);
  const navTargets = collectNavTargets(nodes);
  return { nodes, edges, navTargets };
}

// Heuristic-only sanity check (there's no formal grammar to validate against).
// Same signal used to stress-test the parser against 1263 real exports in
// src/test-corpus.js — surfaced here so the extension can warn the user
// instead of silently rendering a wrong-looking tree as if it were correct.
function looksLikeGarbageTypeName(t) {
  if (!t) return true;
  if (/[\s<>"'.,;]/.test(t)) return true;
  if (t.length > 40) return true;
  return false;
}

function assessParseQuality(text, graph) {
  const kb = text.length / 1024;
  const reasons = [];
  if (graph.nodes.length === 0 && kb > 0.3) {
    reasons.push('No components found — this file may use syntax the parser doesn\'t recognize yet.');
  }
  const nodesPerKb = graph.nodes.length / Math.max(kb, 0.01);
  if (kb > 3 && nodesPerKb < 0.15) {
    // Legitimate for single-block plugin files with large embedded code —
    // flagged as informational, not necessarily wrong.
    reasons.push('Low component density for this file size — likely fine for a plugin/single-block file, but double-check if this looks wrong.');
  }
  const garbageTypes = graph.nodes.filter((n) => looksLikeGarbageTypeName(n.typeName));
  if (garbageTypes.length > 0) {
    reasons.push(`${garbageTypes.length} component(s) have unexpected-looking names — the parser may have misread this file.`);
  }
  return { suspicious: reasons.length > 0, reasons };
}

module.exports = { parseApx, parseApxToGraph, assessParseQuality };
