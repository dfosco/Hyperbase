import { describe, expect, it } from 'vitest'
import { formatPastedCodeMarkdown } from './pastedCodeMarkdown.js'

describe('formatPastedCodeMarkdown', () => {
  it('preserves source text and surrounding whitespace exactly', () => {
    const source = '\n  const answer = 42;  \n\n'

    expect(formatPastedCodeMarkdown({ source, language: 'javascript' })).toBe(
      `\`\`\` javascript\n${source}\`\`\``,
    )
  })

  it('chooses a fence longer than every backtick run', () => {
    const source = 'const marker = "````"; const other = "~~~~";\n'

    expect(formatPastedCodeMarkdown({ source, language: 'js' })).toBe(
      `\`\`\`\`\` js\n${source}\`\`\`\`\``,
    )
  })

  it('uses the safer tilde fence when source has a longer backtick run', () => {
    const source = `const marker = '${'`'.repeat(5)}'; and ~~~\n`

    expect(formatPastedCodeMarkdown({ source })).toBe(`~~~~\n${source}~~~~`)
  })

  it('adds a separator before the closing fence when source lacks a final newline', () => {
    expect(formatPastedCodeMarkdown({ source: 'print("hello")', language: 'python' })).toBe(
      '``` python\nprint("hello")\n```',
    )
  })

  it('omits unknown or unsafe language labels', () => {
    expect(formatPastedCodeMarkdown({ source: 'x', language: 'js onload=alert(1)' })).toBe(
      '```\nx\n```',
    )
    expect(formatPastedCodeMarkdown({ source: 'x', language: 'made-up-language' })).toBe(
      '```\nx\n```',
    )
  })

  it('keeps a standalone fenced snippet unchanged instead of double wrapping it', () => {
    const source = '  ~~~~tsx\nconst View = () => <span />\n~~~~  \n'

    expect(formatPastedCodeMarkdown({ source, language: 'html' })).toBe(source)
  })

  it('does not treat prose around a fenced snippet as a standalone fence', () => {
    const source = 'Example:\n```js\nconst x = 1\n```'

    expect(formatPastedCodeMarkdown({ source })).toBe(`~~~\n${source}\n~~~`)
  })
})
