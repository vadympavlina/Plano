import { GoogleCalendarSettings } from '@/features/integrations/GoogleCalendarSettings';
import { AssistantSettings } from '@/features/integrations/AssistantSettings';
import { Group } from './shared';

export function IntegrationsSection() {
  return (
    <Group id="integrations" title="Інтеграції" keywords="google calendar календар гугл синхронізація">
      <div className="p-4 sm:p-5">
        <GoogleCalendarSettings />
      </div>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <AssistantSettings />
      </div>
    </Group>
  );
}
