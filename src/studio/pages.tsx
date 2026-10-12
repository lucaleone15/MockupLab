import type { StudioPage } from '@/store/ui';

export function StudioPageBody({ page }: { page: StudioPage }) {
  return <p className="px-5 text-fg-muted">{page}</p>;
}
