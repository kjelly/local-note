// HTML escape：補強原版缺少的 > " '
// 用於把使用者字串插入 DOM 文字節點前；對於要插入 attribute 也要用 escAttr

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_ESCAPE_RE = /[&<>"']/g;

export function escapeHtml(input) {
  if (input == null) return '';
  return String(input).replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPES[ch]);
}

// 屬性值 escape：比 escapeHtml 更嚴格，因為屬性會被 " ' 終止
// 實務上 escapeHtml 對屬性也安全（已含 " '），這裡保留別名讓語意清楚
export const escapeAttr = escapeHtml;

// 反向：把 escape 過的字串還原（除錯用，不會在一般流程使用）
export function unescapeHtml(input) {
  if (input == null) return '';
  return String(input)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}
