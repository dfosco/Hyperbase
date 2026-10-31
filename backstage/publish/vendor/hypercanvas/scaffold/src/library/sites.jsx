import { useParams, useSearchParams } from 'react-router-dom'
import SitePage from '@dfosco/hypercanvas/site-page'
import { PORTABLE_SITE_ROUTES } from 'virtual:hypercanvas-notebook-routes'

export default function Sites() {
  const { siteId } = useParams()
  const [searchParams] = useSearchParams()
  const portableSite = (PORTABLE_SITE_ROUTES || []).find(site => site.id === siteId)
  return <SitePage
    basePath={import.meta.env.BASE_URL}
    portableSite={portableSite}
    viewId={searchParams.get('view') || undefined}
  />
}
