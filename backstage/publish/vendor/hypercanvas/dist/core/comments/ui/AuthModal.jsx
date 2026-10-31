/**
 * AuthModal — PAT entry modal for comments authentication.
 * Uses shadcn Button, Input, Label, Alert, Avatar.
 */

import { useState, useEffect, useRef } from 'react'
import { setToken, validateToken } from '../auth.js'
import { getCommentsConfig } from '../config.js'
import { Button } from '../../lib/components/ui/button/index.js'
import { Input } from '../../lib/components/ui/input/index.js'
import { Label } from '../../lib/components/ui/label/index.js'
import * as Alert from '../../lib/components/ui/alert/index.js'
import * as Avatar from '../../lib/components/ui/avatar/index.js'

export default function AuthModal({ onDone, onClose, initialError = null }) {
  const [token, setTokenValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const inputRef = useRef(null)

  const commentsConfig = getCommentsConfig()
  const repoOwner = commentsConfig?.repo?.owner || 'github'
  const repoName = commentsConfig?.repo?.name || 'hypercanvas'
  const repoSlug = `${repoOwner}/${repoName}`
  const tokenTemplateName = 'Hypercanvas Comments'
  const tokenTemplateDescription =
    `Token for enabling comments on ${repoSlug} prototype. Configure as:\n\n` +
    `Owner: ${repoOwner}\n` +
    'Expiration: 366 days (recommended)\n' +
    `Repository access: Only select repositories > ${repoSlug}\n` +
    'Permissions: Repositories > Discussions > Access: Read and Write'
  const tokenCreateUrl =
    `https://github.com/settings/personal-access-tokens/new?` +
    new URLSearchParams({
      name: tokenTemplateName,
      description: tokenTemplateDescription,
    }).toString()

  useEffect(() => {
    setError(initialError)
    inputRef.current?.focus()
  }, [])

  async function submit() {
    const val = token.trim()
    if (!val) return
    setSubmitting(true); setError(null)
    try { const result = await validateToken(val); setToken(val); setUser(result) }
    catch (err) { setError(err.message) }
    finally { setSubmitting(false) }
  }

  function done() { if (user) onDone?.(user) }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !user) submit()
  }

  return (
    <div className="hc-bg-popover hc-text-popover-foreground hc-border hc-border-border hc-rounded-lg hc-shadow-lg hc-overflow-hidden hc-max-w-[600px] hc-w-full hc-font-sans">
      <div className="hc-flex hc-items-center hc-justify-between hc-px-4 hc-py-3 hc-border-b hc-border-border">
        <h2 className="text-medium hc-font-semibold">Sign in for comments</h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="hc-h-7 hc-w-7 hc-text-muted-foreground">&#215;</Button>
      </div>
      <div className="hc-p-4 hc-space-y-3">
        {error && <Alert.Root variant="destructive"><Alert.Description>{error}</Alert.Description></Alert.Root>}
        <p className="hc-text-sm hc-text-muted-foreground hc-leading-relaxed">
          Leave comments for other users to see and respond, and react to! Storyboard comments use Discussions as a back-end and require a GitHub PAT to be enabled.
        </p>
        <p className="hc-text-sm hc-text-muted-foreground hc-leading-relaxed">
          Create a <a className="hc-text-primary hc-underline" href={tokenCreateUrl} target="_blank" rel="noopener">GitHub Fine-Grained Personal Access Token</a> with the settings below to get started:
        </p>
        <div className="hc-px-3 hc-py-2 hc-bg-muted hc-border hc-border-border hc-rounded hc-text-xs hc-text-muted-foreground hc-leading-relaxed">
          <div className="hc-mb-1"><strong className="hc-text-foreground">Fine-grained Personal Access Token</strong></div>
          <div>Owner: <code className="hc-px-1 hc-bg-background hc-rounded hc-font-mono hc-text-foreground">{repoOwner}</code></div>
          <div>Expiration: <code className="hc-px-1 hc-bg-background hc-rounded hc-font-mono hc-text-foreground">366 days</code> (recommended)</div>
          <div>Repository access: <code className="hc-px-1 hc-bg-background hc-rounded hc-font-mono hc-text-foreground">Only select repositories &gt; {repoSlug}</code></div>
          <div>Permissions: <code className="hc-px-1 hc-bg-background hc-rounded hc-font-mono hc-text-foreground">Repositories &gt; Discussions &gt; Access: Read and Write</code></div>
        </div>
        <div className="hc-space-y-1">
          <Label htmlFor="sb-auth-token-input">Personal Access Token</Label>
          <Input
            id="sb-auth-token-input"
            type="password"
            placeholder="github_pat_… or ghp_…"
            autoComplete="off"
            spellCheck={false}
            className="hc-font-mono"
            value={token}
            onChange={(e) => setTokenValue(e.target.value)}
            ref={inputRef}
            onKeyDown={handleKeydown}
          />
        </div>
        {user && (
          <div className="hc-flex hc-items-center hc-py-1 hc-gap-3">
            <Avatar.Root className="hc-h-10 hc-w-10"><Avatar.Image src={user.avatarUrl} alt={user.login} /><Avatar.Fallback>{user.login[0]?.toUpperCase()}</Avatar.Fallback></Avatar.Root>
            <div className="hc-text-sm"><span className="hc-text-foreground">{user.login}</span><span className="hc-block hc-text-xs hc-text-success hc-mt-0.5">&#10003; Signed in</span></div>
          </div>
        )}
        <Alert.Root variant="warning" className="hc-bg-amber-100 hc-border-amber-300">
          <Alert.Description className="hc-text-amber-700">
            ⚠️ Comments are an experimental feature and may be unstable.
          </Alert.Description>
        </Alert.Root>
      </div>
      <div className="hc-flex hc-items-center hc-justify-end hc-px-4 hc-py-3 hc-border-t hc-border-border hc-gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={submitting} onClick={user ? done : submit}>{user ? 'Done' : (submitting ? 'Validating\u2026' : 'Sign in')}</Button>
      </div>
    </div>
  )
}
