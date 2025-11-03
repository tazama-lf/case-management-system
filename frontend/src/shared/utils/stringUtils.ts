
export function generateReportFilename(reportType: string, extension: string = ''): string {
  const date = new Date().toISOString().split('T')[0];
  const normalizedType = reportType.toLowerCase().replace('_', '-');
  return `${normalizedType}-report-${date}${extension}`;
}


export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert kebab-case to Title Case
 */
export function kebabToTitleCase(str: string): string {
  if (!str) return '';
  return str
    .split('-')
    .map(word => capitalize(word))
    .join(' ');
}


export function normalizeForSearch(str: string): string {
  if (!str) return '';
  return str.toLowerCase().trim();
}


export function containsAnyTerm(text: string, searchTerms: string[]): boolean {
  if (!text || !searchTerms?.length) return false;
  const normalizedText = normalizeForSearch(text);
  return searchTerms.some(term => 
    normalizedText.includes(normalizeForSearch(term))
  );
}


export function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}


export function getInitials(name: string, maxLength: number = 2): string {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, maxLength)
    .join('');
}