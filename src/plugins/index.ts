// Plugin system entry point -- currently reserved for future use
//
// To register a plugin:
//   import { registerPlugin } from '@/plugins'
//   registerPlugin({ id: 'my-plugin', name: 'My Plugin', ... })
//
// See PERSISTENT_NOTES.md for the plugin development guide.

export interface GraphitePlugin {
  id: string
  name: string
  // Optional lifecycle hooks (planned for future releases):
  // onEditorReady?: (editor: any) => void
  // onFileOpen?: (path: string) => void
  // onSave?: (content: string) => string
}

const plugins: GraphitePlugin[] = []

export function registerPlugin(plugin: GraphitePlugin): void {
  plugins.push(plugin)
}

export function getPlugins(): GraphitePlugin[] {
  return [...plugins]
}
