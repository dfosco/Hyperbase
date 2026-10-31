/** Preserve authored route state while applying the preview's rendering controls. */
export function storyFrameUrl(story, storyId, props = {}, { theme, componentSet = false } = {}) {
  if (!story?._storyModule) return ''
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const params = new URLSearchParams(props.search || '')
  params.delete('_sb_component_view')
  params.set('_sb_embed', '')
  params.set('_sb_theme_target', 'prototype')
  if (theme && !params.has('theme')) params.set('theme', theme)
  let hash = props.hash || ''
  if (componentSet) {
    params.delete('export')
    params.set('_sb_component_set', '')
    if (props.layout) params.set('layout', props.layout)
    if (props.density) params.set('density', props.density)
    if (props.selected !== undefined) {
      const fragment = new URLSearchParams(hash.replace(/^#/, ''))
      if ((fragment.get('selected') || '') !== props.selected) {
        if (props.selected) fragment.set('selected', props.selected)
        else fragment.delete('selected')
        hash = fragment.size ? `#${fragment}` : ''
      }
    }
  } else {
    params.delete('_sb_component_set')
    if (props.exportName) params.set('export', props.exportName)
    else params.delete('export')
  }
  const route = story._route || `/components/${storyId}`
  return `${base}${import.meta.env.DEV ? '/stories.html' : ''}${route}?${params}${hash}`
}
