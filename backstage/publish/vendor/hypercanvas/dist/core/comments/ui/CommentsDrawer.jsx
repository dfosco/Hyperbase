/**
 * CommentsDrawer — right-side panel listing all comments across all routes.
 * Uses shadcn Avatar, Badge, Button.
 */

import { useState, useEffect } from 'react'
import { listDiscussions, fetchRouteDiscussion } from '../api.js'
import { getCommentsConfig } from '../config.js'
import * as Avatar from '../../lib/components/ui/avatar/index.js'
import { Badge } from '../../lib/components/ui/badge/index.js'
import { Button } from '../../lib/components/ui/button/index.js'

function timeAgo(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CommentsDrawer({ onClose, onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [groups, setGroups] = useState([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const discussions = await listDiscussions()
        if (cancelled) return
        if (!discussions || discussions.length === 0) { setLoading(false); return }
        const basePath = getCommentsConfig()?.basePath ?? '/'
        const result = []
        for (const disc of discussions) {
          const routeMatch = disc.title?.match(/^Comments:\s*(.+)$/)
          if (!routeMatch) continue
          const route = routeMatch[1]
          if (!route.startsWith(basePath)) continue
          let discussion
          try { discussion = await fetchRouteDiscussion(route) } catch { continue }
          if (!discussion?.comments?.length) continue
          result.push({ route, comments: discussion.comments })
        }
        if (!cancelled) setGroups(result)
      } catch (err) { if (!cancelled) setError(err.message) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <>
      <div className="hc-flex hc-items-center hc-justify-between hc-px-4 hc-py-3 hc-border-b hc-border-border hc-shrink-0">
        <h2 className="hc-text-base hc-font-semibold">All Comments</h2>
        <Button variant="ghost" size="icon" className="hc-h-7 hc-w-7 hc-text-muted-foreground" aria-label="Close" onClick={onClose}>&#215;</Button>
      </div>

      <div className="hc-flex-auto hc-overflow-y-auto">
        {loading && (
          <div className="hc-py-8 hc-px-4 hc-text-center hc-text-sm hc-text-muted-foreground">Loading comments&#8230;</div>
        )}
        {!loading && error && (
          <div className="hc-py-8 hc-px-4 hc-text-center hc-text-sm hc-text-muted-foreground">Failed to load comments: {error}</div>
        )}
        {!loading && !error && groups.length === 0 && (
          <div className="hc-py-8 hc-px-4 hc-text-center hc-text-sm hc-text-muted-foreground">No comments yet</div>
        )}
        {!loading && !error && groups.map((group) => (
          <div key={group.route} className="hc-border-b hc-border-border">
            <div className="hc-flex hc-items-center hc-px-4 hc-py-2 hc-bg-muted/50 hc-text-xs hc-font-semibold hc-text-muted-foreground">
              <code className="hc-text-primary">{group.route}</code>
              <span className="hc-ml-auto hc-font-normal hc-whitespace-nowrap">{group.comments.length} {group.comments.length !== 1 ? 'comments' : 'comment'}</span>
            </div>
            {group.comments.map((comment) => (
              <button
                key={comment.id}
                className={`hc-flex hc-px-4 hc-py-2 hc-cursor-pointer hc-border-none hc-bg-transparent hc-w-full hc-text-left hc-font-sans hc-hover:bg-accent/50 hc-transition-colors${comment.meta?.resolved ? " hc-opacity-60" : ''}`}
                onClick={() => onNavigate?.(group.route, comment.id)}
              >
                {comment.author?.avatarUrl && (
                  <Avatar.Root className="hc-h-6 hc-w-6 hc-shrink-0 hc-mr-2">
                    <Avatar.Image src={comment.author.avatarUrl} alt={comment.author?.login ?? ''} />
                    <Avatar.Fallback className="hc-text-[10px]">{(comment.author?.login ?? '?')[0]?.toUpperCase()}</Avatar.Fallback>
                  </Avatar.Root>
                )}
                <div className="hc-flex hc-flex-col hc-flex-auto hc-min-w-0 hc-gap-0.5">
                  <div className="hc-flex hc-items-center hc-gap-1">
                    <span className={`hc-text-xs hc-font-semibold ${comment.meta?.resolved ? "hc-text-muted-foreground" : "hc-text-foreground"}`}>{comment.author?.login ?? 'unknown'}</span>
                    {comment.createdAt && <span className="hc-text-[11px] hc-text-muted-foreground">{timeAgo(comment.createdAt)}</span>}
                    {comment.meta?.resolved && <Badge variant="outline" className="hc-text-success hc-text-[10px] hc-px-1 hc-py-0">Resolved</Badge>}
                  </div>
                  <p className={`hc-text-sm hc-leading-snug hc-overflow-hidden hc-whitespace-nowrap hc-text-ellipsis hc-m-0 ${comment.meta?.resolved ? "hc-text-muted-foreground" : "hc-text-foreground"}`}>{(comment.text ?? '').slice(0, 100)}</p>
                  {(comment.replies?.length ?? 0) > 0 && (
                    <div className="hc-text-[11px] hc-text-muted-foreground hc-mt-0.5">&#128172; {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
