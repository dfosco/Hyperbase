import { describe, expect, it } from 'vitest'
import { classifyPastedText } from './pasteClassification.js'

describe('classifyPastedText', () => {
  it.each([
    'Meeting notes: we should ship this next week.',
    'Use <thing> as a metaphor in your explanation.',
    'This is a sentence with {braces} in it.',
    'const is a word in this documentation.',
    'A heading\n# Not code',
  ])('keeps ambiguous prose as plain text: %s', (source) => {
    expect(classifyPastedText(source)).toEqual({ kind: 'plain-text', source, language: null })
  })

  it('preserves whitespace and the exact source text', () => {
    const source = '\n  Hello, world.\n'
    expect(classifyPastedText(source)).toEqual({ kind: 'plain-text', source, language: null })
  })

  it.each([
    ['<section><h1>Hello</h1><p>Welcome.</p></section>', 'html'],
    ['<!doctype html>\n<html><body><p>Hello</p></body></html>', 'html'],
    ['<my-widget data-ready="true"></my-widget>', 'html'],
  ])('recognizes HTML markup', (source, language) => {
    expect(classifyPastedText(source)).toEqual({ kind: 'html', source, language })
  })

  it.each([
    ['<Button />', 'jsx'],
    ['<>Hello</>', 'jsx'],
    ['<div className="card">{title}</div>', 'jsx'],
    ['<>Hello <strong>world</strong></>', 'jsx'],
    ['type Props = { title: string };\nexport function Card(props: Props) { return <h1>{props.title}</h1> }', 'tsx'],
    ['interface Props { title: string }\nconst Card = (props: Props) => <h1>{props.title}</h1>', 'tsx'],
  ])('recognizes JSX and TSX shapes', (source, kind) => {
    expect(classifyPastedText(source)).toEqual({ kind, source, language: kind })
  })

  it.each([
    ['{"ok": true}', undefined, 'json'],
    ['const answer = 42;', undefined, 'javascript'],
    ['def greet(name):\n    return f"Hello {name}"', undefined, 'python'],
    ['SELECT id FROM users;', undefined, 'sql'],
    ['.card { color: red; }', undefined, 'css'],
    ['npm install react', 'shell', 'bash'],
    ['function greet(name) { return name }', 'ts', 'typescript'],
  ])('recognizes code with reliable language hints', (source, languageHint, language) => {
    expect(classifyPastedText(source, { languageHint })).toEqual({ kind: 'code', source, language })
  })

  it('does not let a language hint turn plain prose into code', () => {
    const source = 'Please use Python for the next example.'
    expect(classifyPastedText(source, { languageHint: 'python' })).toEqual({
      kind: 'plain-text', source, language: null,
    })
  })

  it('normalizes supported language aliases only for detected code', () => {
    const source = 'let count = 1'
    expect(classifyPastedText(source, { languageHint: 'Language-JS' })).toEqual({
      kind: 'code', source, language: 'javascript',
    })
  })

  it('rejects non-string input rather than silently coercing it', () => {
    expect(() => classifyPastedText({ text: 'hello' })).toThrow(TypeError)
  })
})
