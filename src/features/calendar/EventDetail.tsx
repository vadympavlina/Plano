import { CalendarDays, Clock, ExternalLink, FolderKanban, MapPin, Pencil, Repeat, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { EmptyState } from '@/components/common/States';
import { useData } from '@/app/providers/DataProvider';
import { useCollections, useSettings } from '@/hooks/useCollections';
import { useActions } from '@/hooks/useActions';
import { useUI } from '@/app/providers/UIProvider';
import { eventColor } from './items';
import { describeRecurrence } from '@/lib/date/recurrence';
import { formatDateKey, formatTimeRange } from '@/lib/date';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import type { DateKey } from '@/types';

export default function EventDetailDialog({ eventId, date, onClose }: { eventId: string; date?: DateKey; onClose: () => void }) {
  const { data } = useData();
  const event = data.events[eventId];
  const { categoryById, projectById } = useCollections();
  const settings = useSettings();
  const actions = useActions();
  const { openEventForm } = useUI();

  if (!event) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent title="Подія" size="sm">
          <EmptyState title="Подію не знайдено" description="Можливо, її видалили." compact />
        </DialogContent>
      </Dialog>
    );
  }

  const category = categoryById(event.categoryId);
  const project = projectById(event.projectId);
  const color = eventColor(event, categoryById);
  const gcal = data.integrations.google_calendar;
  const googleCalendar = event.external ? gcal?.calendars?.find((c) => c.id === event.external!.calendarId) : undefined;
  const occurrence = date ?? event.date;

  const removeOccurrence = async () => {
    await actions.events.removeOccurrence(event, occurrence).then(() => toast.success('Повторення видалено'), () => undefined);
    onClose();
  };

  const removeAll = async () => {
    const ok = await confirm({
      title: event.recurrence ? 'Видалити всю серію?' : 'Видалити подію?',
      description: event.recurrence
        ? `Усі повторення «${event.title}» буде видалено.`
        : `«${event.title}» буде видалено назавжди.`,
      confirmLabel: 'Видалити',
      danger: true,
    });
    if (!ok) return;
    await actions.events.remove(event.id).then(() => toast.success('Подію видалено'), () => undefined);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={event.title} size="sm">
        <div className="-mt-1 mb-4 h-1 w-12 rounded-full" style={{ backgroundColor: color }} />
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-muted" />
            {formatDateKey(occurrence, 'EEEE, d MMMM yyyy')}
            {event.endDate && event.endDate > event.date && ` – ${formatDateKey(event.endDate, 'd MMM')}`}
          </p>
          <p className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted" />
            {event.allDay ? 'Весь день' : formatTimeRange(event.startTime, event.endTime, settings.timeFormat)}
          </p>
          {event.recurrence && (
            <p className="flex items-center gap-3">
              <Repeat className="h-4 w-4 text-muted" />
              {describeRecurrence(event.recurrence)}
            </p>
          )}
          {event.location && (
            <p className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted" />
              {event.location}
            </p>
          )}
          {event.url && (
            <a href={event.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-primary hover:underline">
              <ExternalLink className="h-4 w-4" />
              <span className="truncate">{event.url}</span>
            </a>
          )}
          {project && (
            <p className="flex items-center gap-3">
              <FolderKanban className="h-4 w-4 text-muted" />
              {project.name}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {category && <Badge color={color}>{category.name}</Badge>}
            {event.external && <Badge color={googleCalendar?.color}>Google Calendar{googleCalendar ? ` · ${googleCalendar.name}` : ''}</Badge>}
            {event.syncPending && gcal?.status === 'connected' && <Badge>Очікує синхронізації</Badge>}
          </div>
          {event.description && <p className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 leading-relaxed text-muted">{event.description}</p>}
        </div>
        <DialogFooter>
          {event.recurrence ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Trash2 className="h-4 w-4" /> Видалити…
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => void removeOccurrence()}>
                  Лише {formatDateKey(occurrence, 'd MMM')}
                </DropdownMenuItem>
                <DropdownMenuItem danger onSelect={() => void removeAll()}>
                  Усю серію
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="outline" onClick={() => void removeAll()}>
              <Trash2 className="h-4 w-4" /> Видалити
            </Button>
          )}
          <Button
            variant="dark"
            onClick={() => {
              onClose();
              openEventForm({ event });
            }}
          >
            <Pencil className="h-4 w-4" /> Редагувати
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
