import fs from 'node:fs'
import path from 'node:path'

/**
 * Fresh Notebooks scaffold config into backstage/config. Tests that model the
 * long-standing root layout move it back before exercising root behaviour.
 */
export function moveNotebookConfigToRoot(root) {
  const directory = path.join(root, 'backstage', 'config')
  if (!fs.existsSync(directory)) return
  for (const name of fs.readdirSync(directory)) {
    if (name.endsWith('.config.json')) fs.renameSync(path.join(directory, name), path.join(root, name))
  }
}
