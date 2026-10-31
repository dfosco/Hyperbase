import { useState, useMemo, useEffect, useCallback } from 'react'

export default function WorkshopPanel({ features = [] }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeOverlay, setActiveOverlay] = useState(null)
  const [visible, setVisible] = useState(true)

  const activeFeature = useMemo(
    () => (activeOverlay ? features.find((f) => f.overlayId === activeOverlay) ?? null : null),
    [activeOverlay, features]
  )

  const showOverlay = useCallback((id) => {
    setActiveOverlay(id)
    setMenuOpen(false)
  }, [])

  const closeOverlay = useCallback(() => setActiveOverlay(null), [])

  const handleKeydown = useCallback(
    (e) => {
      if (e.key === '.' && (e.metaKey || e.ctrlKey)) {
        setVisible((v) => !v)
        return
      }
      if (e.key === 'Escape') {
        setActiveOverlay((cur) => {
          if (cur) return null
          setMenuOpen(false)
          return cur
        })
      }
    },
    []
  )

  const handleClickOutside = useCallback((e) => {
    if (!e.target.closest('[data-workshop-panel]')) {
      setMenuOpen(false)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown)
    document.addEventListener('click', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [handleKeydown, handleClickOutside])

  if (!visible) return null

  const ActiveOverlay = activeFeature?.overlay

  return (
    <div data-workshop-panel className="hc-fixed hc-bottom-6 hc-right-[76px] hc-z-[9999] hc-font-sans">
      <button
        className="hc-flex hc-items-center hc-p-3 hc-bg-popover hc-text-muted-foreground hc-border hc-border-border hc-rounded-full hc-cursor-pointer hc-shadow-lg hc-hover:scale-105 hc-active:scale-95 hc-transition-transform hc-select-none"
        aria-label="Workshop"
        onClick={() => setMenuOpen((o) => !o)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M5.433 2.304A4.494 4.494 0 0 0 3.5 6c0 1.598.832 3.002 2.09 3.802.518.328.929.923.902 1.64v.008l-.164 3.337a.75.75 0 1 1-1.498-.073l.163-3.34c.007-.14-.1-.313-.36-.465A5.986 5.986 0 0 1 2 6a5.994 5.994 0 0 1 2.567-4.92 1.482 1.482 0 0 1 1.673-.04c.462.296.76.827.76 1.423v2.076c0 .332.214.572.491.572.268 0 .492-.24.492-.572V2.463c0-.596.298-1.127.76-1.423a1.482 1.482 0 0 1 1.673.04A5.994 5.994 0 0 1 13 6a5.986 5.986 0 0 1-2.633 4.909c-.26.152-.367.325-.36.465l.164 3.34a.75.75 0 1 1-1.498.073l-.164-3.337v-.008c-.027-.717.384-1.312.902-1.64A4.494 4.494 0 0 0 11.5 6a4.494 4.494 0 0 0-1.933-3.696c-.024.017-.067.067-.067.159v2.076c0 1.074-.84 2.072-1.991 2.072-1.161 0-2.009-.998-2.009-2.072V2.463c0-.092-.043-.142-.067-.16Z" />
        </svg>
      </button>

      {menuOpen && (
        <div className="hc-absolute hc-bottom-14 hc-right-0 hc-min-w-[200px] hc-bg-popover hc-text-popover-foreground hc-border hc-border-border hc-rounded-xl hc-shadow-lg hc-overflow-hidden">
          <div className="hc-px-4 hc-pt-2 hc-pb-1 hc-text-[11px] hc-font-semibold hc-uppercase hc-tracking-wider hc-text-muted-foreground">Workshop</div>
          <div className="hc-h-px hc-bg-border" />
          {features.map((f) => (
            <button
              key={f.overlayId}
              className="hc-flex hc-items-center hc-gap-2 hc-w-full hc-px-4 hc-py-2 hc-text-sm hc-bg-transparent hc-border-none hc-cursor-pointer hc-text-left hc-hover:bg-accent hc-transition-colors"
              onClick={() => showOverlay(f.overlayId)}
            >
              <span className="hc-text-sm">{f.icon || ''}</span> {f.label}
            </button>
          ))}
          <div className="hc-h-px hc-bg-border" />
          <div className="hc-px-4 hc-py-1.5 hc-text-[11px] hc-text-muted-foreground">Dev-only tools</div>
        </div>
      )}

      {ActiveOverlay && (
        <div
          className="hc-fixed hc-inset-0 hc-z-[10000] hc-flex hc-items-center hc-justify-center hc-bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) closeOverlay() }}
        >
          <div className="hc-w-full hc-max-w-[480px]">
            <ActiveOverlay onClose={closeOverlay} />
          </div>
        </div>
      )}
    </div>
  )
}
