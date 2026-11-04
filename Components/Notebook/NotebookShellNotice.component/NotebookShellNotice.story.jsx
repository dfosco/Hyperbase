import { Button } from '../../../../../hypercanvas/packages/storyboard/src/internals/chrome/ui/button.jsx'
import { NotebookShellNotice, NotebookShellNoticeActions } from '../../../../../hypercanvas/packages/storyboard/src/internals/NotebookShellPresentation/NotebookShellPresentation.jsx'

const meta = { title: 'Notebook/Runtime notice', parameters: { layout: 'padded' } }
export default meta

export const PendingReload = {
  render: () => <NotebookShellNotice role="status">
    A Notebook update is ready. Reload to apply the latest content.
    <NotebookShellNoticeActions><Button variant="outline" size="sm">Reload now</Button><Button variant="ghost" size="sm">Dismiss</Button></NotebookShellNoticeActions>
  </NotebookShellNotice>,
}

export const RuntimeRecovery = {
  render: () => <NotebookShellNotice tone="warning" role="status">
    <strong>Runtime recovery is waiting.</strong>
    <span>Reload this document to retry the recovery.</span>
    <NotebookShellNoticeActions><Button variant="secondary" size="sm">Reload</Button><Button variant="ghost" size="sm">Dismiss</Button></NotebookShellNoticeActions>
  </NotebookShellNotice>,
}

export const LostConnection = {
  render: () => <NotebookShellNotice tone="error" role="alert">
    The runtime could not recover. Reload the document to continue.
    <NotebookShellNoticeActions><Button variant="secondary" size="sm">Reload</Button><Button variant="ghost" size="sm">Dismiss</Button></NotebookShellNoticeActions>
  </NotebookShellNotice>,
}
