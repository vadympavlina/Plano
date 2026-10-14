import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, CheckSquare, FolderPlus, Heart, NotebookPen, Target } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { useUI } from '@/app/providers/UIProvider';
import { useActions } from '@/hooks/useActions';
import { toast } from '@/components/ui/toast';

export function useCreateNote() {
  const actions = useActions();
  const navigate = useNavigate();
  return (init?: { title?: string; content?: string; projectId?: string }) => {
    const { id, write } = actions.notes.create({
      title: init?.title ?? '',
      content: init?.content ?? '',
      tags: [],
      isPinned: false,
      projectId: init?.projectId,
    });
    write.catch(() => toast.error('Не вдалося створити нотатку'));
    navigate(`/notes/${id}`);
  };
}

export function CreateMenu({ trigger, align = 'end' }: { trigger: ReactNode; align?: 'start' | 'end' | 'center' }) {
  const { openTaskForm, openEventForm } = useUI();
  const navigate = useNavigate();
  const createNote = useCreateNote();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuItem icon={<CheckSquare />} onSelect={() => openTaskForm()}>
          Нова задача
        </DropdownMenuItem>
        <DropdownMenuItem icon={<CalendarPlus />} onSelect={() => openEventForm()}>
          Нова подія
        </DropdownMenuItem>
        <DropdownMenuItem icon={<NotebookPen />} onSelect={() => createNote()}>
          Нова нотатка
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<FolderPlus />} onSelect={() => navigate('/projects?new=1')}>
          Новий проєкт
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Heart />} onSelect={() => navigate('/habits?new=1')}>
          Нова звичка
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Target />} onSelect={() => navigate('/goals?new=1')}>
          Нова ціль
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
