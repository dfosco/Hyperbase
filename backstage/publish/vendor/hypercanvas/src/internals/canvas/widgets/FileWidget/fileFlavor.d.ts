export interface FileFlavor {
  flavor: 'markdown' | 'mdx' | 'code' | 'unsupported'
  language: string | null
  mime: string | null
  isText: boolean
  extension: string
}

export function detectFlavor(pathOrFilename: string | null | undefined): FileFlavor
export function isTextFile(pathOrFilename: string | null | undefined): boolean
export function getLanguageId(pathOrFilename: string | null | undefined): string | null
