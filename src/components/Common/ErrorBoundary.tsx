import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="text-center space-y-3">
            <p className="text-sm font-medium">应用出错了</p>
            <p className="text-xs text-[var(--text-muted)] max-w-md">{this.state.error?.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
              className="px-3 py-1.5 text-xs rounded bg-[var(--accent)] text-white hover:opacity-90"
            >
              重新加载
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
