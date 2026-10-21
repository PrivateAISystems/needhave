/** Escape text before it is placed in HTML or markdown. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * HTML-escape first so a stored `<script>` cannot run, then escape
 * markdown punctuation so the text cannot open a link or a raw block.
 */
export function escapeMarkdown(value) {
  return escapeHtml(value)
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/([\\`*_{}[\]()#+\-.!|])/g, "\\$1");
}
