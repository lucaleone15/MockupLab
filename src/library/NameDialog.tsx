import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useT } from '@/i18n';
import { useProject } from '@/store/project';
import { Button, Sheet } from '@/ui/primitives';
import { useLibrary } from './store';

/*
 * A project gets its name when it starts (so it is not one more "Untitled"
 * in the library): the Studio asks when it opens on a project never named,
 * and asks again at its first export if the user chose "Later".
 */

interface NameAsk {
  why: 'new' | 'export';
  resolve: () => void;
}

const useNameAsk = create<{ ask: NameAsk | null; laterFor: number }>(() => ({ ask: null, laterFor: -1 }));

/** Automated browsers (the check scripts) are not asked, unless a test wants the question. */
function asking() {
  try {
    return !navigator.webdriver || localStorage.getItem('mockuplab:askName') === '1';
  } catch {
    return !navigator.webdriver;
  }
}

const untitled = () => {
  const name = useProject.getState().name;
  return !name || name === 'Untitled';
};

/** Asks for the name of a never-named project (the Studio opening on it, or "New project"). */
export function askNameIfNew() {
  if (!asking() || !untitled() || useNameAsk.getState().ask) return;
  // "Later" holds for the project being edited
  if (useNameAsk.getState().laterFor === useLibrary.getState().loads) return;
  useNameAsk.setState({ ask: { why: 'new', resolve: () => undefined } });
}

/** Before the first export of an untitled project: asks for its name (resolves once answered either way). */
export function ensureNamed(): Promise<void> {
  if (!asking() || !untitled()) return Promise.resolve();
  return new Promise((resolve) => useNameAsk.setState({ ask: { why: 'export', resolve } }));
}

export const useNameDialogOpen = () => useNameAsk((s) => !!s.ask);

export function NameDialog() {
  const { t } = useT();
  const ask = useNameAsk((s) => s.ask);
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ask) setName('');
  }, [ask]);
  const finish = (value: string | null) => {
    const a = useNameAsk.getState().ask;
    if (!a) return;
    if (value) useProject.setState({ name: value });
    useNameAsk.setState({ ask: null, laterFor: value ? -1 : useLibrary.getState().loads });
    a.resolve();
  };
  if (!ask) return null;
  return (
    <Sheet
      open
      onOpenChange={(v) => !v && finish(null)}
      title={t(ask.why === 'new' ? 'name.newTitle' : 'name.exportTitle')}
      description={t(ask.why === 'new' ? 'name.newHint' : 'name.exportHint')}
      testId="name-dialog"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) finish(name.trim());
        }}
      >
        <input
          ref={input}
          autoFocus
          aria-label={t('project.name')}
          placeholder={t('name.placeholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-[10px] bg-surface-2 px-3 text-[14px] text-fg shadow-[0_0_0_1px_var(--line)_inset] outline-none focus:shadow-[0_0_0_1.5px_var(--accent)_inset]"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => finish(null)}>
            {t('name.later')}
          </Button>
          <Button variant="primary" type="submit" disabled={!name.trim()}>
            {t('name.create')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
