export function parseHeadline(headline: string): { title?: string; company?: string } {
  // "Title at Company" or "Title @ Company" (strip trailing "| field" if present)
  const atMatch = headline.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (atMatch) {
    const company = atMatch[2].split('|')[0].trim();
    return { title: atMatch[1]?.trim(), company };
  }

  const pipeMatch = headline.match(/^(.+?)\s*\|\s*(.+)$/);
  if (pipeMatch) {
    return { title: pipeMatch[1]?.trim(), company: pipeMatch[2]?.trim() };
  }

  const dashMatch = headline.match(/^(.+?)\s*-\s*(.+)$/);
  if (dashMatch) {
    return { title: dashMatch[1]?.trim(), company: dashMatch[2]?.trim() };
  }

  return { title: headline.trim() };
}
