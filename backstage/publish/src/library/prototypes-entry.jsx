import { mountNotebook } from '@dfosco/hypercanvas/notebook/viewer'
import '@dfosco/hypercanvas/core.css'
import '@dfosco/hypercanvas/notebook/style.css'
const entryLocation = import.meta.url
globalThis.__HYPERCANVAS_NOTEBOOK_BASE__ = import.meta.env.PROD && import.meta.env.BASE_URL === './' ? new URL('../', entryLocation).pathname : new URL(import.meta.env.BASE_URL, document.baseURI).pathname
globalThis.__HYPERCANVAS_NOTEBOOK_PREVIEW__ = import.meta.env.DEV
globalThis.__HYPERCANVAS_NOTEBOOK_PRODUCTION__ = import.meta.env.PROD
mountNotebook(document.getElementById('root'), { isolated: true })
