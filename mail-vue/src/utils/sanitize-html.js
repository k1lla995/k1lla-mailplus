import DOMPurify from 'dompurify'

const SANITIZE_OPTIONS = {
  FORBID_TAGS: [
    'script', 'style', 'iframe', 'object', 'embed', 'base', 'meta', 'form',
    'input', 'button', 'textarea', 'select', 'option', 'svg', 'math'
  ],
  FORBID_ATTR: ['srcdoc', 'formaction']
}

export function sanitizeEmailHtml(html) {
  return DOMPurify.sanitize(html || '', SANITIZE_OPTIONS)
}
