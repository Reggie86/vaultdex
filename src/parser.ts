import { ParsedQuery } from './types';

export function parseQuery(raw: string): ParsedQuery {
  let query = raw.trim();
  let folderFilter: string | null = null;

  const folderMatch = query.match(/^folder:(\S+)\s*/i);
  if (folderMatch) {
    folderFilter = folderMatch[1];
    query = query.slice(folderMatch[0].length);
  }

  const phrases = [...query.matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const remainder = query.replace(/"[^"]+"/g, '').trim();
  const required: string[] = [];
  const terms: string[] = [];

  for (const token of remainder.split(/\s+/).filter(Boolean)) {
    if (token.includes('+')) {
      required.push(...token.split('+').filter(Boolean));
    } else {
      terms.push(token);
    }
  }

  return { phrases, required, terms, folderFilter };
}
