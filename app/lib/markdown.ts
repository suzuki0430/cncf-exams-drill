/**
 * Escapes a standalone numeric sentence that Markdown would parse as an empty
 * ordered-list item.
 *
 * CommonMark treats values such as `4245.` as list markers, so port-number
 * choices can render without visible text. Normal prose and intentional list
 * items remain unchanged.
 *
 * @param content - Markdown source shown in the question UI.
 * @returns Markdown with a standalone trailing period escaped when necessary.
 *
 * @example
 * ```ts
 * escapeStandaloneNumber("4245."); // "4245\\."
 * escapeStandaloneNumber("TCP 4245."); // "TCP 4245."
 * ```
 */
export function escapeStandaloneNumber(content: string): string {
  return content.replace(/^(\s*\d{1,9})\.(\s*)$/, "$1\\.$2");
}
