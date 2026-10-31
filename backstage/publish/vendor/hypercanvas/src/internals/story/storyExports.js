import { createElement, useMemo, useRef } from 'react'

const record = value => value && typeof value === 'object' ? value : {}
const matches = (rule, name) => Array.isArray(rule) ? rule.includes(name) : rule instanceof RegExp ? rule.test(name) : false

/** Normalize named React stories and React CSF2/CSF3 exports for both views. */
export function resolveStoryExports(module, { componentSet = false, exportNames = [] } = {}) {
  const meta = record(module.default)
  const names = [...new Set([...(Array.isArray(module.__namedExportsOrder) ? module.__namedExportsOrder : []), ...exportNames, ...Object.keys(module)])]
  const stories = {}
  for (const name of names) {
    if (!/^[A-Z]/.test(name) || name === 'default' || matches(meta.excludeStories, name)
      || (meta.includeStories && !matches(meta.includeStories, name))) continue
    const story = module[name]
    if (!story || (typeof story !== 'function' && typeof story !== 'object')) continue
    if (componentSet && story.componentSet === false) continue
    const render = typeof story === 'function' ? story : story.render || meta.render
    const component = meta.component
    if (typeof render !== 'function' && !component) continue
    const args = { ...record(meta.args), ...record(story.args) }
    const context = {
      id: name, name: story.name || story.storyName || name, story: name,
      args, initialArgs: args, argTypes: { ...record(meta.argTypes), ...record(story.argTypes) },
      parameters: { ...record(meta.parameters), ...record(story.parameters) },
      globals: {}, viewMode: 'story', component,
    }
    // Render callbacks stay inside a React component so story hooks work.
    const plainReactStory = typeof story === 'function' && !meta.component && !meta.render && !story.args
    let Preview = (overrides = {}) => {
      const effectiveArgs = { ...args, ...record(overrides.args) }
      const effectiveContext = { ...context, ...overrides, args: effectiveArgs }
      return plainReactStory || render?.prototype?.isReactComponent
        ? createElement(render, effectiveArgs)
        : typeof render === 'function' ? render(effectiveArgs, effectiveContext) : createElement(component, effectiveArgs)
    }
    for (const decorator of [...(meta.decorators || []), ...(story.decorators || [])].reverse()) {
      const Inner = Preview
      Preview = (overrides = {}) => {
        const decoratedContext = { ...context, ...overrides, args: { ...args, ...record(overrides.args) } }
        const current = useRef(null)
        current.current = { overrides, decoratedContext }
        // Decorators render <Story />. Its component type must survive parent
        // rerenders while still receiving the latest args and context.
        const Story = useMemo(() => function DecoratedStory(extra = {}) {
          return createElement(Inner, {
            ...current.current.overrides, ...extra,
            args: { ...current.current.decoratedContext.args, ...record(extra.args) },
          })
        }, [])
        return decorator(Story, decoratedContext)
      }
    }
    Preview.displayName = `Story(${name})`
    Preview.storyName = context.name
    Preview.minHeight = story.minHeight
    stories[name] = Preview
  }
  return stories
}
