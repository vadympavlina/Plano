import { useEffect, useRef, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { confirm } from '@/components/common/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { useData } from '@/app/providers/DataProvider';
import { settleWrite } from '@/services/sync';
import { backupNow, fetchBackup, listBackups, type BackupMeta } from '@/services/backup';
import { clearErrors, listErrors } from '@/services/errors';
import { usesTokenServer } from '@/services/integrations/google/server';
import { todayKey } from '@/lib/date';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import { buildExport, validateImport, type ImportResult } from './dataTransfer';
import { SUMMARY_LABEL, Row, Group } from './shared';

export function DataSection() {
  const { data, repos, backendKind } = useData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(buildExport(data), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plano-export-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Експорт завантажено');
  };

  // Server backups (weekly, automatic) and error reports.
  const cloud = backendKind === 'firebase' && usesTokenServer;
  const [backups, setBackups] = useState<BackupMeta[] | null>(null);
  const [errorCount, setErrorCount] = useState<number | null>(null);
  const [pick, setPick] = useState('');
  useEffect(() => {
    if (!cloud) return;
    void listBackups().then(setBackups, () => setBackups([]));
    void listErrors().then(
      (r) => setErrorCount(r.errors.length),
      () => undefined,
    );
  }, [cloud]);
  const when = (iso: string) => new Date(iso).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не вдалося');
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(validateImport(await file.text()));
    if (fileRef.current) fileRef.current.value = '';
  };

  const applyImport = async () => {
    if (!result?.ok) return;
    const ok = await confirm({
      title: 'Замінити всі дані цим файлом?',
      description: 'Усе, що зараз є в Plano, буде замінено імпортованими даними. Якщо сумніваєтеся, спершу зробіть експорт.',
      confirmLabel: 'Замінити дані',
      danger: true,
      typeToConfirm: 'ІМПОРТ',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await settleWrite(repos.replaceAll({ ...result.file.data, settings: { ...DEFAULT_SETTINGS, ...result.file.data.settings } }));
      toast.success('Дані імпортовано');
      setResult(null);
    } catch {
      /* toast from sync layer */
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    const ok = await confirm({
      title: 'Видалити всі ваші дані?',
      description: 'Задачі, події, проєкти, звички, цілі, нотатки, категорії та налаштування буде видалено назавжди. Це не можна скасувати.',
      confirmLabel: 'Видалити все',
      danger: true,
      typeToConfirm: 'ВИДАЛИТИ',
    });
    if (!ok) return;
    try {
      await settleWrite(repos.removeAll());
      toast.success('Усі дані видалено');
    } catch {
      /* toast from sync layer */
    }
  };

  return (
    <Group id="data" title="Дані" keywords="експорт імпорт json резервна копія видалити">
      <Row label="Експорт" hint="Усі дані Plano одним файлом JSON." keywords="резервна копія json">
        <Button variant="outline" size="sm" onClick={exportData}>
          <Download className="h-4 w-4" /> Завантажити
        </Button>
      </Row>
      <Row label="Імпорт" hint="Відновлення з експорту. Файл перевіряється до того, як щось буде записано." keywords="json відновити">
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Обрати файл…
        </Button>
      </Row>
      {cloud && (
        <Row
          label="Резервні копії"
          hint={`Автоматично раз на тиждень, зберігаються 8 останніх (зашифровано). ${backups?.length ? `Остання: ${when(backups[0].at)}.` : 'Поки немає.'}`}
          keywords="резервна копія backup відновити"
        >
          <div className="flex flex-wrap items-center gap-2">
            {!!backups?.length && (
              <Select
                aria-label="Копія для відновлення"
                className="w-[190px]"
                placeholder="Відновити з копії…"
                value={pick}
                onChange={(at) => {
                  setPick(at);
                  void run(async () => setResult(validateImport(await fetchBackup(at))));
                }}
                options={backups.map((b) => ({ value: b.at, label: when(b.at) }))}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              loading={busy}
              onClick={() =>
                void run(async () => {
                  await backupNow(data);
                  setBackups(await listBackups());
                  toast.success('Копію збережено');
                })
              }
            >
              Зробити зараз
            </Button>
          </div>
        </Row>
      )}
      {cloud && (
        <Row
          label="Звіти про помилки"
          hint={errorCount ? `Збережено помилок: ${errorCount}. Скопіюйте й надішліть розробнику.` : 'Помилок не було.'}
          keywords="помилки журнал errors"
        >
          {!!errorCount && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(JSON.stringify((await listErrors()).errors, null, 2));
                    toast.success('Скопійовано');
                  })
                }
              >
                Копіювати
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void run(async () => (await clearErrors(), setErrorCount(0)))}>
                Очистити
              </Button>
            </div>
          )}
        </Row>
      )}
      {result && !result.ok && (
        <div role="alert" className="m-4 rounded-xl bg-danger/10 p-3 text-sm text-danger">
          <p className="font-medium">Цей файл не можна імпортувати:</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {result?.ok && (
        <div className="p-4">
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-medium">Коректний експорт від {new Date(result.file.exportedAt).toLocaleString('uk-UA')}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(result.summary).map(([k, v]) => (
                <Badge key={k}>
                  {SUMMARY_LABEL[k] ?? k}: {v}
                </Badge>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                Скасувати
              </Button>
              <Button variant="dark" size="sm" loading={busy} onClick={() => void applyImport()}>
                Замінити мої дані
              </Button>
            </div>
          </div>
        </div>
      )}
      <Row
        label={<span className="text-danger">Видалити всі дані</span>}
        hint={backendKind === 'local' ? 'Видаляє всі дані перегляду з цього браузера.' : 'Назавжди видаляє всі ваші дані з Firebase. Це не можна скасувати.'}
        keywords="видалити всі дані"
      >
        <Button variant="danger" size="sm" onClick={() => void deleteAll()}>
          <Trash2 className="h-4 w-4" /> Видалити
        </Button>
      </Row>
    </Group>
  );
}
