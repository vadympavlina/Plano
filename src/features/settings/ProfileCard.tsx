import { useContext, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { Avatar } from '@/components/layout/Avatar';
import { useSyncSummary } from '@/components/layout/SyncIndicator';
import { useData } from '@/app/providers/DataProvider';
import { useAuth } from '@/app/providers/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { settleWrite } from '@/services/sync';
import { updateAuthProfile } from '@/services/auth';
import { cn } from '@/lib/utils/cn';
import { panel, SearchCtx, matches } from './shared';

export function ProfileCard() {
  const { data, repos, backendKind } = useData();
  const profile = useProfile();
  const sync = useSyncSummary();
  const { state } = useAuth();
  const q = useContext(SearchCtx);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(data.profile.displayName ?? profile.name);
  const [avatar, setAvatar] = useState(data.profile.avatarUrl ?? '');
  const [busy, setBusy] = useState(false);
  const avatarError = avatar && !/^https:\/\/\S+$/i.test(avatar) ? 'Вкажіть посилання на зображення, що починається з https://' : undefined;
  const user = state.status === 'signedIn' ? state.user : null;
  if (!matches(q, 'профіль', 'ім’я', 'аватар', 'акаунт', 'пошта')) return null;

  const save = async () => {
    if (avatarError) return;
    setBusy(true);
    try {
      await settleWrite(repos.profile.update({ displayName: name.trim() || undefined, avatarUrl: avatar.trim() || undefined }));
      if (backendKind === 'firebase') await updateAuthProfile({ displayName: name.trim() || null }).catch(() => undefined);
      toast.success('Профіль збережено');
      setEditing(false);
    } catch {
      /* toast from sync layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="settings-profile" data-section="profile" className={cn(panel, 'mb-7 scroll-mt-6 p-5')}>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name || profile.name} src={avatar && !avatarError ? avatar : profile.avatarUrl} className="h-14 w-14 text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold tracking-tight">{profile.name || 'Ім’я не вказано'}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
            <span className="truncate">{user?.email ?? (backendKind === 'local' ? 'Локальний перегляд (без входу)' : '')}</span>
            {backendKind === 'firebase' && (
              <span className="inline-flex items-center gap-1.5">
                ·{' '}
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    sync.tone === 'success' ? 'bg-success' : sync.tone === 'danger' ? 'bg-danger' : sync.tone === 'warning' ? 'bg-warning' : 'bg-subtle',
                  )}
                />
                {sync.label}
              </span>
            )}
          </p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" aria-label="Редагувати профіль" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Редагувати</span>
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-5 border-t border-line/70 pt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ім’я" hint="Використовується у привітаннях.">
              {(p) => <Input {...p} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="Посилання на аватар" error={avatarError} hint="Необов’язково. Порожнє — фото акаунта.">
              {(p) => <Input {...p} type="url" placeholder="https://…" value={avatar} onChange={(e) => setAvatar(e.target.value)} />}
            </Field>
          </div>
          {user && (
            <p className="mt-4 break-all text-xs text-subtle">
              ID користувача: <code className="font-mono">{user.uid}</code>
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setName(data.profile.displayName ?? profile.name);
                setAvatar(data.profile.avatarUrl ?? '');
                setEditing(false);
              }}
            >
              Скасувати
            </Button>
            <Button variant="dark" onClick={() => void save()} loading={busy} disabled={!!avatarError}>
              Зберегти
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Install the app: the browser's own prompt where it exists, otherwise how to do it by hand. */
