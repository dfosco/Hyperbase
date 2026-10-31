/**
 * CreateDialog — shared Dialog shell around CreateArtifactForm.
 *
 * The form, fields, validation, data-loading, and submission live in
 * `CreateArtifactForm`. This component just supplies the modal chrome.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../chrome/ui/dialog.jsx'
import CreateArtifactForm, { ARTIFACT_SCHEMAS } from './CreateArtifactForm.jsx'
import { resolveSchemaKey, TYPE_KEY_MAP } from './createHelpers.js'
import SiteForm from '../SiteForm/SiteForm.jsx'

const CREATE_DIALOG_STYLE = {
  maxWidth: 'min(640px, calc(100vw - 2rem))',
  maxHeight: 'calc(100dvh - 2rem)',
  overflowY: 'auto',
}

export default function CreateDialog({ type, basePath, initialValues = null, onClose }) {
  // `type === null`/`undefined` means "no dialog requested" — render nothing.
  // Explicit `'Any'` (or empty string) means picker mode.
  if (type == null) return null

  if (String(type).toLowerCase() === 'site') {
    const isPastedSite = Object.prototype.hasOwnProperty.call(initialValues || {}, 'route')
    return (
    <Dialog open onOpenChange={open => { if (!open) onClose?.() }}>
      <DialogContent style={CREATE_DIALOG_STYLE}>
        <DialogHeader className="hc-pr-8">
          <DialogTitle>{isPastedSite ? 'Create Site from pasted URL' : 'New Site'}</DialogTitle>
          <DialogDescription>{isPastedSite ? 'Choose the project directory, then review the detected Site URL and run command.' : 'Connect a local directory as a Site.'}</DialogDescription>
        </DialogHeader>
        <SiteForm initialValues={initialValues || {}} basePath={basePath} onClose={onClose} onSaved={site => {
          onClose?.()
          if (!site?.id) return
          if (Object.prototype.hasOwnProperty.call(initialValues || {}, 'route')) {
            document.dispatchEvent(new CustomEvent('storyboard:site-created-from-paste', {
              detail: { site, route: initialValues.route || '' },
            }))
            return
          }
          const base = (basePath || '/').replace(/\/+$/, '')
          window.location.href = `${base}/sites/${encodeURIComponent(site.id)}/`
        }} />
      </DialogContent>
    </Dialog>
    )
  }

  const schemaKey = resolveSchemaKey(type)
  const isPicker = schemaKey === null
  const schema = schemaKey ? ARTIFACT_SCHEMAS[schemaKey] : null

  if (!isPicker && !schema) return null

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose?.() }}>
      <DialogContent style={CREATE_DIALOG_STYLE}>
        <DialogHeader className="hc-pr-8">
          <DialogTitle>{isPicker ? 'New artifact' : `New ${schema.label}`}</DialogTitle>
          <DialogDescription>{isPicker ? 'Pick an artifact type to create.' : schema.description}</DialogDescription>
        </DialogHeader>
        <CreateArtifactForm
          type={type}
          basePath={basePath}
          initialValues={initialValues}
          onClose={onClose}
          hideHeader
        />
      </DialogContent>
    </Dialog>
  )
}

// Re-export for canvas/workspace integrations
export { ARTIFACT_SCHEMAS as CREATE_SCHEMAS, TYPE_KEY_MAP }
