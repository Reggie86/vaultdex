import { describe, it, expect } from 'vitest';
import { parseQuery } from '../src/parser';

describe('parseQuery', () => {
  it('no folder — folderFilter is null, terms parsed', () => {
    const r = parseQuery('ipfire root');
    expect(r.folderFilter).toBeNull();
    expect(r.terms.sort()).toEqual(['ipfire', 'root']);
    expect(r.phrases).toEqual([]);
    expect(r.required).toEqual([]);
  });

  it('folder: prefix extracted, remainder becomes terms', () => {
    const r = parseQuery('folder:Snippets ipfire root');
    expect(r.folderFilter).toBe('Snippets');
    expect(r.terms.sort()).toEqual(['ipfire', 'root']);
  });

  it('FOLDER: is case-insensitive', () => {
    const r = parseQuery('FOLDER:Linux bash');
    expect(r.folderFilter).toBe('Linux');
    expect(r.terms).toEqual(['bash']);
  });

  it('folder: works alongside quoted phrases', () => {
    const r = parseQuery('folder:Resources "exact phrase" term');
    expect(r.folderFilter).toBe('Resources');
    expect(r.phrases).toEqual(['exact phrase']);
    expect(r.terms).toEqual(['term']);
  });

  it('folder: with no trailing terms — terms empty', () => {
    const r = parseQuery('folder:Snippets');
    expect(r.folderFilter).toBe('Snippets');
    expect(r.terms).toEqual([]);
  });

  it('mid-query folder: is NOT parsed', () => {
    const r = parseQuery('bash folder:Linux');
    expect(r.folderFilter).toBeNull();
    expect(r.terms).toContain('bash');
  });

  it('AND operator (Word+Word) works alongside folder:', () => {
    const r = parseQuery('folder:Areas ipfire+root');
    expect(r.folderFilter).toBe('Areas');
    expect(r.required.sort()).toEqual(['ipfire', 'root']);
    expect(r.terms).toEqual([]);
  });
});
