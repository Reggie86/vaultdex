import { ParsedQuery } from './types';

export function parseQuery(raw: string): ParsedQuery {
  let query = raw.trim();
  let folderFilter: string | null = null;

  // Support FolderName:search terms syntax (e.g. Snippets:music, Electronic:ambient)
  // Also accept legacy folder:FolderName search terms for backwards compatibility
  const newSyntax = query.match(/^([A-Za-z][^:\s]+):(.+)/);
  const legacySyntax = query.match(/^folder:(\S+)\s*/i);
  if (legacySyntax) {
    folderFilter = legacySyntax[1];
    query = query.slice(legacySyntax[0].length);
  } else if (newSyntax) {
    folderFilter = newSyntax[1];
    query = newSyntax[2].trim();
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
