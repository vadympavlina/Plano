import { Bot, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { TOKEN_SERVER_URL, usesTokenServer } from '@/services/integrations/google/server';

const DOCS = 'https://github.com/vadympavlina/Plano/blob/main/docs/mcp.md';

/** The address to give an AI assistant (ChatGPT, Claude) so that it can work with the planner. */
export function AssistantSettings() {
  if (!usesTokenServer) return null;
  const url = `${TOKEN_SERVER_URL}/mcp`;
  const copy = () => {
    navigator.clipboard?.writeText(url).then(
      () => toast.success('Адресу скопійовано'),
      () => toast.error('Не вдалося скопіювати'),
    );
  };
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
          <Bot className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold">ШІ-помічники (MCP)</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            ChatGPT чи Claude можуть читати планер і додавати в нього задачі, події та нотатки зі звичайних фраз: «постав на завтра о 15 зустріч». Працює, коли
            в налаштуваннях сервера задано пароль доступу.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12px]">{url}</code>
            <Button type="button" variant="outline" size="sm" onClick={copy} aria-label="Скопіювати адресу MCP-сервера">
              <Copy className="h-4 w-4" /> Копіювати
            </Button>
          </div>
          <a className="mt-2 inline-block text-[12.5px] font-medium underline underline-offset-2" href={DOCS} target="_blank" rel="noopener noreferrer">
            Як підключити
          </a>
        </div>
      </div>
    </div>
  );
}
