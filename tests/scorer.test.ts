import { describe, it, expect } from 'vitest';
import { scoreNote, extractSnippet, search } from '../src/scorer';
import { NoteRecord, ParsedQuery } from '../src/types';

function makeNote(overrides: Partial<NoteRecord> = {}): NoteRecord {
  return {
    path: 'Projects/Test Note.md',
    title: 'Test Note',
    para: 'Projects',
    tags: [],
    headers: '',
    body: '',
    created: '2026-01-01 00:00:00',
    ...overrides,
  };
}

function emptyQuery(overrides: Partial<ParsedQuery> = {}): ParsedQuery {
  return { phrases: [], required: [], terms: [], folderFilter: null, ...overrides };
}

describe('scoreNote', () => {
  it('returns null when no terms match', () => {
    const note = makeNote({ body: 'hello world' });
    expect(scoreNote(note, emptyQuery({ terms: ['zzznomatch'] }), null, null)).toBeNull();
  });

  it('title match scores higher than body match', () => {
    const byTitle = makeNote({ title: 'firewall config', body: 'nothing' });
    const byBody  = makeNote({ title: 'unrelated', body: 'firewall config details here' });
    const q = emptyQuery({ terms: ['firewall'] });
    const scoreTitle = scoreNote(byTitle, q, null, null)!.score;
    const scoreBody  = scoreNote(byBody,  q, null, null)!.score;
    expect(scoreTitle).toBeGreaterThan(scoreBody);
  });

  it('required term missing from note returns null', () => {
    const note = makeNote({ body: 'only ipfire here' });
    expect(scoreNote(note, emptyQuery({ required: ['ipfire', 'root'] }), null, null)).toBeNull();
  });

  it('required term present scores positively', () => {
    const note = makeNote({ title: 'ipfire', tags: ['ipfire'], headers: 'ipfire setup', body: 'ipfire config' });
    const result = scoreNote(note, emptyQuery({ required: ['ipfire'] }), null, null);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(0);
  });

  it('phrase query excludes notes where terms appear non-adjacent', () => {
    const withPhrase = makeNote({ body: 'ipfire root access configured' });
    const withSeparate = makeNote({ body: 'ipfire is great and root is separate' });
    expect(scoreNote(withPhrase,   emptyQuery({ phrases: ['ipfire root'] }), null, null)).not.toBeNull();
    expect(scoreNote(withSeparate, emptyQuery({ phrases: ['ipfire root'] }), null, null)).toBeNull();
  });

  it('all-terms bonus applied when all sig terms present', () => {
    const note = makeNote({ body: 'ipfire root vpn setup' });
    const single = scoreNote(note, emptyQuery({ terms: ['ipfire'] }), null, null)!.score;
    const multi  = scoreNote(note, emptyQuery({ terms: ['ipfire', 'root', 'vpn'] }), null, null)!.score;
    expect(multi).toBeGreaterThan(single * 3);
  });

  it('para filter excludes non-matching notes', () => {
    expect(scoreNote(makeNote({ para: 'Resources', body: 'test' }), emptyQuery({ terms: ['test'] }), 'Projects', null)).toBeNull();
  });

  it('folder filter excludes notes not in that folder', () => {
    const note = makeNote({ path: 'Resources/Linux/bash.md', body: 'bash scripting' });
    const q = emptyQuery({ terms: ['bash'] });
    expect(scoreNote(note, q, null, 'Windows')).toBeNull();
    expect(scoreNote(note, q, null, 'Linux')).not.toBeNull();
  });

  it('folder filter is case-insensitive', () => {
    const note = makeNote({ path: 'Resources/Linux/bash.md', body: 'bash scripting' });
    expect(scoreNote(note, emptyQuery({ terms: ['bash'] }), null, 'linux')).not.toBeNull();
  });
});

describe('extractSnippet', () => {
  it('wraps matched terms in <mark>', () => {
    const snip = extractSnippet('The quick brown fox jumps over the lazy dog', ['fox', 'dog']);
    expect(snip).toContain('<mark>fox</mark>');
    expect(snip).toContain('<mark>dog</mark>');
  });

  it('strips markdown syntax', () => {
    const snip = extractSnippet('**bold** _italic_ `code` text', ['text']);
    expect(snip).not.toContain('**');
    expect(snip).not.toContain('_italic_');
  });

  it('adds ellipsis for truncated snippets', () => {
    const longBody = 'a '.repeat(200) + 'keyword ' + 'b '.repeat(200);
    const snip = extractSnippet(longBody, ['keyword']);
    expect(snip).toContain('…');
  });
});

describe('search', () => {
  const index: NoteRecord[] = [
    makeNote({ path: 'Projects/Alpha.md', title: 'Alpha', body: 'ipfire vpn config' }),
    makeNote({ path: 'Areas/Beta.md',     title: 'Beta',  body: 'linux bash scripts', para: 'Areas' }),
    makeNote({ path: 'Projects/Gamma.md', title: 'Gamma', body: 'unrelated content' }),
  ];

  it('returns matching notes sorted by score', () => {
    const results = search(index, 'ipfire', null, 'score', 25);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Alpha');
  });

  it('para filter scopes results', () => {
    expect(search(index, 'bash', 'Projects', 'score', 25)).toHaveLength(0);
    expect(search(index, 'bash', null, 'score', 25)).toHaveLength(1);
  });

  it('empty query returns empty array', () => {
    expect(search(index, '', null, 'score', 25)).toEqual([]);
  });

  it('maxResults is respected', () => {
    const bigIndex = Array.from({ length: 30 }, (_, i) =>
      makeNote({ path: `Projects/Note${i}.md`, title: `Note ${i}`, body: 'common term here' })
    );
    expect(search(bigIndex, 'common', null, 'score', 5).length).toBeLessThanOrEqual(5);
  });
});
