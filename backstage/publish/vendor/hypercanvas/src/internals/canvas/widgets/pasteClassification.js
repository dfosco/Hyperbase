const LANGUAGE_ALIASES = new Map([
  ['bash', 'bash'],
  ['c', 'c'],
  ['c++', 'cpp'],
  ['cpp', 'cpp'],
  ['css', 'css'],
  ['go', 'go'],
  ['golang', 'go'],
  ['html', 'html'],
  ['java', 'java'],
  ['javascript', 'javascript'],
  ['js', 'javascript'],
  ['jsx', 'jsx'],
  ['json', 'json'],
  ['jsonc', 'jsonc'],
  ['md', 'markdown'],
  ['markdown', 'markdown'],
  ['py', 'python'],
  ['python', 'python'],
  ['rb', 'ruby'],
  ['ruby', 'ruby'],
  ['rs', 'rust'],
  ['rust', 'rust'],
  ['sh', 'bash'],
  ['shell', 'bash'],
  ['sql', 'sql'],
  ['ts', 'typescript'],
  ['tsx', 'tsx'],
  ['typescript', 'typescript'],
  ['xml', 'xml'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
])

const HTML_TAGS = new Set([
  'a', 'abbr', 'article', 'aside', 'audio', 'b', 'blockquote', 'body', 'br', 'button',
  'canvas', 'caption', 'code', 'dd', 'div', 'dl', 'dt', 'em', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'head', 'header', 'hr', 'html',
  'i', 'iframe', 'img', 'input', 'label', 'li', 'link', 'main', 'meta', 'nav', 'ol',
  'option', 'p', 'picture', 'pre', 'script', 'section', 'select', 'small', 'source',
  'span', 'strong', 'style', 'svg', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th',
  'thead', 'title', 'tr', 'ul', 'video',
])

const HTML_CUES = /\b(?:className|htmlFor|on[A-Z][\w]*)\s*=|\{\s*(?:[A-Za-z_$({[]|\.\.\.)/
const TYPESCRIPT_CUES = /(?:\binterface\s+[A-Z_$]|\btype\s+[A-Z_$][\w$]*\s*=|\b(?:string|number|boolean|unknown|never)\s*[;,)=]|\bas\s+(?:const|[A-Z_$]))/

function normalizeHint(hint) {
  if (typeof hint !== 'string') return null
  const key = hint.trim().toLowerCase().replace(/^language-/, '').replace(/^\./, '')
  return LANGUAGE_ALIASES.get(key) ?? null
}

function result(kind, source, language = null) {
  return { kind, source, language }
}

function getMarkupShape(text) {
  const tags = [...text.matchAll(/<\/?([A-Za-z][\w:.-]*)\b[^>]*>/g)]
  const hasFragment = /^\s*<>[\s\S]*<\/>\s*$/.test(text)
  if (tags.length === 0 && !hasFragment) return null

  const names = tags.map((match) => match[1])
  const hasComponent = hasFragment || names.some((name) => /^[A-Z]/.test(name))
  const hasSelfClosing = /<\/?[A-Za-z][\w:.-]*\b[^>]*\/>/.test(text)
  const hasJsxCue = HTML_CUES.test(text) || /<>|<\/>/.test(text)
  const hasTypeScriptCue = TYPESCRIPT_CUES.test(text)
  const hasHtmlDocument = /<!doctype\s+html\b|<html\b[\s>]/i.test(text)
  const hasKnownHtmlTag = names.some((name) => HTML_TAGS.has(name.toLowerCase()))
  const hasPairedTag = names.some((name) => new RegExp(`<${name}\\b[^>]*>[\\s\\S]*<\\/${name}\\s*>`, 'i').test(text))

  // A lowercase custom element is valid HTML too, but a bare angle-bracketed
  // phrase is not enough. Require a document cue, HTML tag, or paired element.
  const isMarkup = hasHtmlDocument || hasKnownHtmlTag || hasPairedTag
  if (!isMarkup && !hasComponent) return null

  return {
    hasComponent,
    hasSelfClosing,
    hasJsxCue,
    hasTypeScriptCue,
    isMarkup,
  }
}

function hasCodeEvidence(text, hint) {
  const trimmed = text.trim()
  if (!trimmed) return false

  if (/^(?:\{|\[)[\s\S]*(?:\}|\])$/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return true
    } catch {
      // Continue checking for non-JSON code such as an object literal.
    }
  }

  if (/^(?:#!|\/\/|\/\*|\*\/|#\s*(?:include|import|!\/))/.test(trimmed)) return true
  if (/^(?:<!doctype\s+html\b|<\/?[A-Za-z][\w:.-]*\b[^>]*>)/i.test(trimmed)) return true
  if (/^(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*(?::[^=\n]+)?\s*=/m.test(trimmed)) return true
  if (/^(?:function\s+[A-Za-z_$][\w$]*\s*\(|class\s+[A-Za-z_$][\w$]*\b|import\s+(?:[\w$*{]|['"])|export\s+(?:default|const|let|var|function|class|\{)|return\b|throw\b|new\s+[A-Z_$])/m.test(trimmed)) return true
  if (/^(?:def|async\s+def|class|from\s+\S+\s+import|import\s+\S+)/m.test(trimmed)) return true
  if (/^(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|WITH\s+\w+\s+AS)\b/i.test(trimmed)) return true
  if (/^(?:package\s+\w+|func\s+\w+|fn\s+\w+|pub\s+fn\s+|fn\s+main\s*\()/m.test(trimmed)) return true
  if (/^[.#][\w-]+(?:\s*,\s*[.#][\w-]+)?\s*\{[^}]*:[^}]*\}/s.test(trimmed)) return true
  if (/^(?:npm|npx|pnpm|yarn|git|docker|cd|mkdir|rm|cat|echo|curl|python|node|cargo|go)\s+\S+/m.test(trimmed)) return true
  if (/=>|\b(?:console\.log|print)\s*\(|\b(?:if|for|while|switch)\s*\([^\n]*\)\s*\{|\b(?:try|catch)\s*\{/m.test(trimmed)) return true
  if (/\b(?:interface|enum)\s+[A-Z_$][\w$]*/.test(trimmed) || TYPESCRIPT_CUES.test(trimmed)) return true

  // A language hint can disambiguate code-shaped syntax, but cannot turn
  // ordinary prose into code by itself.
  const hintedCodeSyntax = /[{};]|\b(?:def|fn|func|SELECT|return|import)\b/.test(trimmed)
  return Boolean(hint && hintedCodeSyntax)
}

function inferLanguage(text, hint) {
  if (hint && hint !== 'html' && hint !== 'jsx' && hint !== 'tsx' && hint !== 'xml') return hint
  if (/^\s*\{/.test(text) || /^\s*\[/.test(text)) {
    try {
      JSON.parse(text)
      return 'json'
    } catch {
      // Not strict JSON.
    }
  }
  if (/^(?:SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|WITH\s+\w+\s+AS)\b/i.test(text.trim())) return 'sql'
  if (/^(?:def|async\s+def|from\s+\S+\s+import|import\s+\S+)/m.test(text.trim())) return 'python'
  if (/^(?:#!.*\b(?:bash|sh)|(?:npm|npx|pnpm|yarn|git|docker|cd|mkdir|rm|cat|echo|curl)\s+\S+)/m.test(text.trim())) return 'bash'
  if (/\b(?:interface|enum)\s+[A-Z_$][\w$]*|\btype\s+[A-Z_$][\w$]*\s*=|\w+\s*:\s*(?:string|number|boolean|unknown)\b/.test(text)) return 'typescript'
  if (/\b(?:const|let|var|function|class|import|export)\b|=>|\bconsole\.log\s*\(/.test(text)) return 'javascript'
  if (/^\s*[.#][\w-]+(?:\s*,\s*[.#][\w-]+)?\s*\{/s.test(text)) return 'css'
  return hint
}

/**
 * Classify non-link text after URL, image, and widget-reference routes have run.
 * The classifier is intentionally conservative: ambiguous prose stays text.
 *
 * @param {string} source Exact clipboard text.
 * @param {{ languageHint?: string }} [options]
 * @returns {{ kind: 'plain-text' | 'html' | 'jsx' | 'tsx' | 'code', source: string, language: string | null }}
 */
export function classifyPastedText(source, { languageHint } = {}) {
  if (typeof source !== 'string') throw new TypeError('Pasted source must be a string')

  const hint = normalizeHint(languageHint)
  const markup = getMarkupShape(source)
  if (markup) {
    const isTsx = markup.hasTypeScriptCue || hint === 'tsx' || hint === 'typescript'
    const isJsx = markup.hasComponent || markup.hasSelfClosing || markup.hasJsxCue || hint === 'jsx' || hint === 'tsx'
    if (isTsx && isJsx) return result('tsx', source, 'tsx')
    if (isJsx) return result('jsx', source, 'jsx')
    return result('html', source, hint === 'xml' ? 'xml' : 'html')
  }

  if (!hasCodeEvidence(source, hint)) return result('plain-text', source)
  const language = inferLanguage(source, hint)
  return result('code', source, language)
}
