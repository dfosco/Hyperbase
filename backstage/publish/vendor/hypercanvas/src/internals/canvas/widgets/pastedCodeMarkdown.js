const KNOWN_LANGUAGES = new Set([
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'diff',
  'dockerfile',
  'go',
  'graphql',
  'html',
  'java',
  'javascript',
  'js',
  'jsx',
  'json',
  'jsonc',
  'kotlin',
  'markdown',
  'md',
  'php',
  'powershell',
  'python',
  'ruby',
  'rust',
  'sass',
  'scss',
  'sh',
  'shell',
  'sql',
  'swift',
  'ts',
  'tsx',
  'typescript',
  'xml',
  'yaml',
  'yml',
])

function normalizeLanguage(language) {
  if (typeof language !== 'string') return ''

  const normalized = language.trim().toLowerCase()
  return KNOWN_LANGUAGES.has(normalized) ? normalized : ''
}

function isStandaloneFencedSnippet(source) {
  const trimmed = source.trim()
  if (!trimmed) return false

  const lines = trimmed.split(/\r\n|\n|\r/)
  if (lines.length < 2) return false

  const opening = lines[0].match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
  if (!opening) return false

  const fence = opening[1]
  const marker = fence[0]
  const info = opening[2]
  // CommonMark does not allow backticks in the info string of a backtick fence.
  if (marker === '`' && info.includes('`')) return false

  const closing = lines.at(-1).match(/^ {0,3}(`+|~+)[ \t]*$/)
  return Boolean(closing && closing[1][0] === marker && closing[1].length >= fence.length)
}

function longestRun(source, marker) {
  const runs = source.match(marker === '`' ? /`+/g : /~+/g) ?? []
  let longest = 0
  for (const run of runs) longest = Math.max(longest, run.length)
  return longest
}

function chooseFence(source) {
  const backticks = longestRun(source, '`')
  const tildes = longestRun(source, '~')
  const marker = backticks <= tildes ? '`' : '~'
  const longestMatchingRun = Math.min(backticks, tildes)
  return marker.repeat(Math.max(3, longestMatchingRun + 1))
}

/**
 * Wrap source text as a Markdown code block without trimming or normalizing it.
 * `language` must already be a reliable hint from the caller; unknown labels are
 * omitted so pasted text cannot inject fence attributes.
 */
export function formatPastedCodeMarkdown({ source, language } = {}) {
  const text = typeof source === 'string' ? source : String(source ?? '')

  if (isStandaloneFencedSnippet(text)) return text

  const fence = chooseFence(text)
  const info = normalizeLanguage(language)
  const hasTerminalNewline = text.endsWith('\n') || text.endsWith('\r')
  return `${fence}${info ? ` ${info}` : ''}\n${text}${hasTerminalNewline ? '' : '\n'}${fence}`
}
