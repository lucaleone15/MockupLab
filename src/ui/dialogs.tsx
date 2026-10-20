import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { FileUp } from 'lucide-react';
import { useT } from '@/i18n';
import { useUi } from '@/store/ui';
import { Button, Sheet, cx } from './primitives';

/*
 * The app's own pop-ups, in place of the browser's (confirm, prompt, the bare
 * file chooser): ask*() open one and resolve with the answer. Mounted once by
 * <AppDialogs /> in App.
 */

interface ConfirmAsk {
  kind: 'confirm';
  title: string;
  body?: string;
  confirm: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}
interface TextAsk {
  kind: 'text';
  title: string;
  label: string;
  value: string;
  resolve: (value: string | null) => void;
}
interface FileAsk {
  kind: 'file';
  title: string;
  hint: string;
  accept: string;
  multiple: boolean;
  resolve: (files: File[]) => void;
}
type Ask = ConfirmAsk | TextAsk | FileAsk;

const useAsk = create<{ ask: Ask | null }>(() => ({ ask: null }));

/** Closes the current pop-up with its "no" answer (a new question replaces an open one). */
function settleOpen() {
  const a = useAsk.getState().ask;
  if (!a) return;
  if (a.kind === 'confirm') a.resolve(false);
  else if (a.kind === 'text') a.resolve(null);
  else a.resolve([]);
  useAsk.setState({ ask: null });
}

export function askConfirm(o: Omit<ConfirmAsk, 'kind' | 'resolve'>): Promise<boolean> {
  settleOpen();
  return new Promise((resolve) => useAsk.setState({ ask: { kind: 'confirm', ...o, resolve } }));
}

export function askText(o: Omit<TextAsk, 'kind' | 'resolve'>): Promise<string | null> {
  settleOpen();
  return new Promise((resolve) => useAsk.setState({ ask: { kind: 'text', ...o, resolve } }));
}

/** Files dropped, pasted or browsed in the app's dialog (empty when it is closed). */
export function askFiles(o: Omit<FileAsk, 'kind' | 'resolve'>): Promise<File[]> {
  settleOpen();
  return new Promise((resolve) => useAsk.setState({ ask: { kind: 'file', ...o, resolve } }));
}

const close = () => settleOpen();
const answer = (fn: (a: Ask) => void) => {
  const a = useAsk.getState().ask;
  if (!a) return;
  useAsk.setState({ ask: null });
  fn(a);
};

function matches(file: File, accept: string) {
  return accept.split(',').some((rule) => {
    const r = rule.trim().toLowerCase();
    if (!r) return false;
    if (r.startsWith('.')) return file.name.toLowerCase().endsWith(r);
    if (r.endsWith('/*')) return file.type.startsWith(r.slice(0, -1));
    return file.type === r;
  });
}

function FileDrop({ ask }: { ask: FileAsk }) {
  const { t } = useT();
  const [over, setOver] = useState(false);
  const pick = (list: Iterable<File>) => {
    const files = [...list].filter((f) => matches(f, ask.accept));
    if (!files.length) return;
    answer((a) => a.kind === 'file' && a.resolve(ask.multiple ? files : files.slice(0, 1)));
  };
  // a paste while the dialog is open answers it (and not the scene)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (!files.length) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      pick(files);
    };
    window.addEventListener('paste', onPaste, true);
    return () => window.removeEventListener('paste', onPaste, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);
  const browse = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ask.accept;
    input.multiple = ask.multiple;
    input.onchange = () => input.files && pick(input.files);
    input.click();
  };
  return (
    <div
      data-testid="file-drop"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        // the scene's own drop handler must not take the file too
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        useUi.getState().setDragging(false);
        pick(e.dataTransfer?.files ?? []);
      }}
      className={cx(
        'flex flex-col items-center gap-3 rounded-[14px] border-2 border-dashed px-6 py-10 text-center transition-colors',
        over ? 'border-accent bg-accent-soft' : 'border-line-strong',
      )}
    >
      <FileUp size={26} className="text-fg-subtle" />
      <div className="text-[13.5px] font-medium">{t('file.drop')}</div>
      <div className="text-[12px] leading-snug text-fg-muted">{ask.hint}</div>
      <Button variant="primary" onClick={browse}>
        {t('file.browse')}
      </Button>
    </div>
  );
}

function TextField({ ask }: { ask: TextAsk }) {
  const { t } = useT();
  const [value, setValue] = useState(ask.value);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);
  const ok = () => answer((a) => a.kind === 'text' && a.resolve(value.trim() || null));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        ok();
      }}
    >
      <input
        ref={input}
        aria-label={ask.label}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-10 rounded-[10px] bg-surface-2 px-3 text-[14px] text-fg shadow-[0_0_0_1px_var(--line)_inset] outline-none focus:shadow-[0_0_0_1.5px_var(--accent)_inset]"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={close}>
          {t('cancel')}
        </Button>
        <Button variant="primary" type="submit" disabled={!value.trim()}>
          OK
        </Button>
      </div>
    </form>
  );
}

export function AppDialogs() {
  const { t } = useT();
  const ask = useAsk((s) => s.ask);
  const open = !!ask;
  const onOpenChange = (v: boolean) => !v && close();
  if (!ask) return null;
  if (ask.kind === 'file')
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title={ask.title} testId="file-dialog">
        <FileDrop ask={ask} />
      </Sheet>
    );
  if (ask.kind === 'text')
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title={ask.title} testId="text-dialog">
        <TextField ask={ask} />
      </Sheet>
    );
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={ask.title}
      description={ask.body}
      testId="confirm-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            className={ask.danger ? 'bg-danger hover:bg-danger' : undefined}
            onClick={() => answer((a) => a.kind === 'confirm' && a.resolve(true))}
          >
            {ask.confirm}
          </Button>
        </>
      }
    >
      {null}
    </Sheet>
  );
}
