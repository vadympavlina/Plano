import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, UserRound } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { useAuth } from '@/app/providers/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { confirm } from '@/components/common/ConfirmDialog';
import { getSyncState } from '@/services/sync';

export function useSignOut() {
  const { signOut } = useAuth();
  return async () => {
    const pending = getSyncState().pending;
    if (pending > 0) {
      const ok = await confirm({
        title: 'Some changes are not synced yet',
        description: `${pending} change(s) have not reached the server. Signing out now will lose them.`,
        confirmLabel: 'Sign out anyway',
        danger: true,
      });
      if (!ok) return;
    }
    await signOut();
  };
}

export function UserMenu({ trigger, side = 'bottom' }: { trigger: ReactNode; side?: 'top' | 'bottom' }) {
  const profile = useProfile();
  const navigate = useNavigate();
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" className="w-60">
        <DropdownMenuLabel className="pb-2">
          <span className="block truncate text-sm font-semibold text-ink">{profile.name || 'Your profile'}</span>
          <span className="block truncate font-normal">{profile.email ?? (profile.mode === 'preview' ? 'Local preview' : '')}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<UserRound />} onSelect={() => navigate('/settings/profile')}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Settings />} onSelect={() => navigate('/settings')}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut />} onSelect={() => void signOut()}>
          {profile.mode === 'preview' ? 'Exit preview' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
