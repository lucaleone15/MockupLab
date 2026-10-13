import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { t } from '@/i18n';

/** Keeps the rest of the app usable when a view crashes (WebGL error, broken model…). */
export class ErrorBoundary extends Component<{ children: ReactNode; label: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center p-8" role="alert">
        <div className="flex max-w-[420px] flex-col items-center gap-3 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-surface-3 text-accent">
            <AlertTriangle size={20} />
          </span>
          <div className="text-[15px] font-semibold">{t('error.title', { what: this.props.label })}</div>
          <p className="text-[12.5px] leading-relaxed text-fg-muted">{t('error.body')}</p>
          <code className="max-w-full truncate rounded-md bg-surface-2 px-2 py-1 text-[11px] text-fg-subtle">{this.state.error.message}</code>
          <div className="flex gap-2">
            <button type="button" onClick={() => this.setState({ error: null })} className="h-8 rounded-lg bg-surface-3 px-3 text-[12.5px] font-medium hover:bg-surface-4">
              {t('error.retry')}
            </button>
            <button type="button" onClick={() => location.reload()} className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-fg">
              <RotateCw size={13} />
              {t('error.reload')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

/** WebGL 2 is required by the 3D view and the photo compositor. */
export function hasWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}
