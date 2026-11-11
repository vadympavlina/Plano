import { GoogleCalendarSettings } from '@/features/integrations/GoogleCalendarSettings';
import { Group } from './shared';

export function IntegrationsSection() {
  return (
    <Group id="integrations" title="Інтеграції" keywords="google calendar календар гугл синхронізація">
      <div className="p-4 sm:p-5">
        <GoogleCalendarSettings />
      </div>
    </Group>
  );
}
