import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import notebook from '@dfosco/hypercanvas/notebook/vite'
const root = path.dirname(fileURLToPath(import.meta.url))
export default defineConfig({ plugins: [notebook({ notebookRoot: path.join(root, 'notebook-content'), base: process.env.VITE_BASE_PATH || "/hyperbase/" })], resolve: { alias: { '@': path.join(root, 'notebook-content') } } })
