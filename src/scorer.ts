import { NoteRecord, ParsedQuery, SearchResult } from './types';
import { parseQuery } from './parser';

const STOP_WORDS = new Set([
  'a','an','the','is','in','on','of','to','at','by','for',
  'or','and','but','this','that','these','those','with','from',
  'one','two','as','be','it','its','not','are','was','were',
  'has','have','had','do','did','does','will','would','could',
  'should','may','might','can','my','your','his','her','our',
  'their','we','you','he','she','they','i','me','him','us',
]);

function count(haystack: string, needle: string): number {
  let n = 0, pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) { n++; pos += needle.length; }
  return n;
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractSnippet(body: string, terms: string[], length = 240): string {
  let plain = body.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  plain = plain.replace(/[*_`#>~]/g, '').replace(/\s+/g, ' ').trim();
  const lower = plain.toLowerCase();
  let bestPos = 0, bestScore = 0;
  for (let i = 0; i < Math.max(1, lower.length - length); i += 40) {
    const s = terms.reduce((acc, t) => acc + count(lower.slice(i, i + length), t.toLowerCase()), 0);
    if (s > bestScore) { bestScore = s; bestPos = i; }
  }
  let snip = plain.slice(bestPos, bestPos + length).trim();
  if (bestPos > 0) snip = '…' + snip;
  if (bestPos + length < plain.length) snip += '…';
  for (const term of [...terms].sort((a, b) => b.length - a.length)) {
    snip = snip.replace(new RegExp(`(${escRe(term)})`, 'gi'), '<mark>$1</mark>');
  }
  return snip;
}

export function scoreNote(
  record: NoteRecord,
  query: ParsedQuery,
  paraFilter: string | null,
  folderFilter: string | null,
): SearchResult | null {
  if (paraFilter && record.para !== paraFilter) return null;

  if (folderFilter) {
    const dirs = record.path.split('/').slice(0, -1);
    if (!dirs.some(d => d.toLowerCase() === folderFilter.toLowerCase())) return null;
  }

  const lTitle = record.title.toLowerCase();
  const lTags  = record.tags.join(' ').toLowerCase();
  const lHdrs  = record.headers.toLowerCase();
  const lBody  = record.body.toLowerCase();

  let score = 0, matched = false;

  for (const term of query.required) {
    const t = term.toLowerCase();
    if (![lBody, lTitle, lTags, lHdrs].some(s => s.includes(t))) return null;
    const nT = count(lTitle, t), nG = count(lTags, t), nH = count(lHdrs, t), nB = count(lBody, t);
    if (nT) { score += 15 * nT; matched = true; }
    if (nG) { score += 12 * nG; matched = true; }
    if (nH) { score += 8  * nH; matched = true; }
    if (nB) { score += Math.min(nB, 20) * 2; matched = true; }
  }

  for (const phrase of query.phrases) {
    const p = phrase.toLowerCase();
    if (![lBody, lTitle, lTags, lHdrs].some(s => s.includes(p))) return null;
    const nT = count(lTitle, p), nG = count(lTags, p), nH = count(lHdrs, p), nB = count(lBody, p);
    if (nT) { score += 40 * nT; matched = true; }
    if (nG) { score += 30 * nG; matched = true; }
    if (nH) { score += 20 * nH; matched = true; }
    if (nB) { score += Math.min(nB, 20) * 3; matched = true; }
  }

  for (const term of query.terms) {
    const t = term.toLowerCase();
    const nT = count(lTitle, t), nG = count(lTags, t), nH = count(lHdrs, t), nB = count(lBody, t);
    if (nT) { score += 10 * nT; matched = true; }
    if (nG) { score += 8  * nG; matched = true; }
    if (nH) { score += Math.min(nH, 5) * 5; matched = true; }
    if (nB) { score += Math.min(nB, 20); matched = true; }
  }

  if (!matched) return null;

  if (query.terms.length > 1) {
    const sig = query.terms.filter(t => !STOP_WORDS.has(t.toLowerCase()));
    const eff = sig.length > 0 ? sig : query.terms;
    const allPresent = eff.every(t => {
      const tl = t.toLowerCase();
      return lBody.includes(tl) || lTitle.includes(tl) || lTags.includes(tl) || lHdrs.includes(tl);
    });
    if (allPresent) score += 100 * eff.length;
    if (eff.every(t => lTitle.includes(t.toLowerCase()))) score += 600;
  }

  const parts = record.path.split('/');
  return {
    score,
    title: record.title,
    path: record.path,
    breadcrumb: parts.slice(0, -1).join(' › '),
    para: record.para,
    snippet: extractSnippet(record.body, [...query.phrases, ...query.required, ...query.terms]),
    tags: record.tags.slice(0, 6),
    created: record.created,
  };
}

export function search(
  index: NoteRecord[],
  rawQuery: string,
  paraFilter: string | null,
  sort: 'score' | 'date',
  maxResults: number,
): SearchResult[] {
  const query = parseQuery(rawQuery);
  const { folderFilter } = query;
  if (!query.phrases.length && !query.required.length && !query.terms.length && !folderFilter) return [];

  const results = index
    .map(r => scoreNote(r, query, paraFilter, folderFilter))
    .filter((r): r is SearchResult => r !== null);

  results.sort(sort === 'date'
    ? (a, b) => b.created.localeCompare(a.created)
    : (a, b) => b.score - a.score,
  );
  return results.slice(0, maxResults);
}
