/**
 * Composer — inline comment textarea at click position.
 * Uses shadcn Button, Textarea, Avatar.
 */

import { useState, useMemo } from 'react'
import { Button } from '../../lib/components/ui/button/index.js'
import { Textarea } from '../../lib/components/ui/textarea/index.js'
import * as Avatar from '../../lib/components/ui/avatar/index.js'
import { saveDraft, getDraft, clearDraft, composerDraftKey } from '../commentDrafts.js'

export default function Composer({ user = null, route = '', onCancel, onSubmit }) {
  const draftKey = useMemo(() => composerDraftKey(route), [route])
  const [text, setText] = useState(() => getDraft(draftKey)?.text ?? '')

  function submit() {
    const val = text.trim()
    if (!val) return
    onSubmit?.(val)
  }

  function cancel() {
    onCancel?.()
  }

  function handleBlur() {
    if (text.trim()) {
      saveDraft(draftKey, { type: 'comment', text })
    } else {
      clearDraft(draftKey)
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() }
  }

  return (
    <div className="hc-flex hc-flex-col hc-font-sans" onKeyDown={handleKeydown}>
      {user && (
        <div className="hc-flex hc-items-center hc-px-3 hc-pt-2 hc-gap-2">
          <Avatar.Root className="hc-h-5 hc-w-5">
            <Avatar.Image src={user.avatarUrl} alt={user.login} />
            <Avatar.Fallback className="hc-text-[10px]">{user.login[0]?.toUpperCase()}</Avatar.Fallback>
          </Avatar.Root>
          <span className="hc-text-xs hc-text-muted-foreground hc-font-medium">{user.login}</span>
        </div>
      )}
      <div className="hc-px-3 hc-pt-3">
        <Textarea
          className="hc-min-h-[60px] hc-max-h-[160px] hc-resize-y hc-text-sm"
          placeholder="Leave a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
        />
      </div>
      <div className="hc-flex hc-items-center hc-justify-end hc-p-3 hc-gap-1">
        <Button variant="outline" size="sm" className="hc-border hc-border-input hc-text-foreground" onClick={cancel}>Cancel</Button>
        <Button size="sm" onClick={submit}>Comment</Button>
      </div>
    </div>
  )
}
