import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChromeSidebar } from './components/ChromeSidebar/ChromeSidebar.jsx'
import { ChromeTopbar } from './components/ChromeTopbar/ChromeTopbar.jsx'
import { ChromeDialogs } from './components/ChromeDialogs/ChromeDialogs.jsx'
import { ChromePanels } from './components/ChromePanels/ChromePanels.jsx'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './components/ui/card.jsx'
import './styles/shadcn.css'

export default function ChromeOverview() {
  const [page, setPage] = useState('chrome')
  const location = useLocation()
  return <div className="flex min-h-screen">
    <div className="hidden w-72 shrink-0 md:block"><ChromeSidebar initialActive={page} onNavigate={setPage} /></div>
    <main className="flex min-w-0 flex-1 flex-col">
      <ChromeTopbar title={page === 'chrome' ? 'Chrome Components' : page} onBack={() => history.back()} onForward={() => history.forward()} />
      <div className="flex flex-col gap-6 p-6">
        <Card><CardHeader><CardTitle>Make room for the work.</CardTitle><CardDescription>One notebook. Familiar controls. A quieter application frame.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3"><p>This composition brings the proposed navigation and page controls together. The canvas remains the place to review each pattern and its states.</p><Link to={`${location.pathname}?view=details#overview`}>Explore page details</Link></CardContent></Card>
        <div className="flex flex-wrap gap-4"><ChromeDialogs defaultOpen={false} /><ChromePanels defaultOpen={false} /></div>
      </div>
    </main>
  </div>
}
