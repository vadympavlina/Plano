import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, FolderKanban, Plus } from 'lucide-react';
import { PageContainer } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge, Progress, Segmented } from '@/components/ui/misc';
import { EmptyState } from '@/components/common/States';
import { useCollections } from '@/hooks/useCollections';
import { useToday } from '@/hooks/useNow';
import { useOpenFromQuery } from '@/hooks/useOpenFromQuery';
import { colorOf } from '@/lib/utils/colors';
import { formatDateKey, relativeDayLabel } from '@/lib/date';
import type { ProjectStatus } from '@/types';
import { PROJECT_STATUS_LABEL, projectProgress } from './logic';
import { ProjectForm } from './ProjectForm';

type Filter = ProjectStatus | 'all';

export default function ProjectsPage() {
  const { projects, tasks } = useCollections();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>('active');
  const [creating, setCreating] = useState(false);
  useOpenFromQuery(() => setCreating(true));

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length };
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);
  const list = projects.filter((p) => filter === 'all' || p.status === filter);

  return (
    <PageContainer>
      <PageHeader
        title="Проєкти"
        subtitle="Великі напрями роботи з прогресом за їхніми задачами."
        actions={
          <Button variant="dark" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Новий проєкт
          </Button>
        }
      />
      <div className="no-scrollbar mb-4 overflow-x-auto">
        <Segmented
          ariaLabel="Фільтр проєктів"
          value={filter}
          onChange={setFilter}
          options={(['active', 'on_hold', 'completed', 'archived', 'all'] as Filter[]).map((v) => ({
            value: v,
            label: v === 'all' ? 'Усі' : PROJECT_STATUS_LABEL[v],
            count: counts[v] ?? 0,
          }))}
        />
      </div>
      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FolderKanban />}
            title={projects.length ? 'Немає проєктів із цим статусом' : 'Проєктів поки немає'}
            description="Проєкти об’єднують пов’язані задачі, нотатки й цілі — наприклад, Робота, Здоров’я чи власний проєкт."
            action={
              <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" /> Створити проєкт
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const prog = projectProgress(p, tasks, today);
            const color = colorOf(p.color);
            return (
              <Link key={p.id} to={`/projects/${p.id}`} className="card group flex flex-col p-5 transition-colors hover:border-subtle/40">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1f`, color }}>
                    <FolderKanban className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold tracking-tight">{p.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{p.description || 'Без опису'}</p>
                  </div>
                  {p.status !== 'active' && <Badge>{PROJECT_STATUS_LABEL[p.status]}</Badge>}
                </div>
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-xs text-muted">
                    <span>
                      {prog.done}/{prog.total} задач
                    </span>
                    <span className="font-medium tabular-nums text-ink">{prog.percent}%</span>
                  </div>
                  <Progress value={prog.percent} color={color} label={`Прогрес: ${p.name}`} />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {prog.nextDeadline && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" /> Далі: {relativeDayLabel(prog.nextDeadline, today)}
                    </span>
                  )}
                  {prog.overdue > 0 && <span className="text-danger">прострочено: {prog.overdue}</span>}
                  {p.targetDate && <span>Мета до {formatDateKey(p.targetDate, 'd MMM yyyy')}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </PageContainer>
  );
}
