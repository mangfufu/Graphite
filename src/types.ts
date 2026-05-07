export interface FileEntry {
  path: string
  name: string
  is_dir: boolean
  size: number
  modified_at: string
  children: FileEntry[] | null
}

export interface DirectoryResult {
  path: string
  name: string
  children: FileEntry[]
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type Theme = 'default' | 'warm' | 'forest' | 'ocean' | 'sepia'
