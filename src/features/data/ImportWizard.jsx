import { useState, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, Check, AlertTriangle, ChevronLeft, ChevronRight,
  Download, Undo2,
} from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { parseSpreadsheet, downloadTemplate } from '../../lib/fileIO';
import { ENTITIES, autoMapColumns, validateRows, templateHeaders } from './entitySchemas';
import { cn } from '../../lib/cn';
import {
  Card, Button, Badge, Select, Table, EmptyState, Spinner,
} from '../../components/ui';

const STEPS = ['Upload', 'Map columns', 'Review', 'Done'];

export default function ImportWizard({ entityKey }) {
  const toast = useToast();
  const entity = ENTITIES[entityKey];

  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [dryRun, setDryRun] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setStep(0);
    setFile(null);
    setParsed(null);
    setMapping({});
    setDryRun(null);
    setResult(null);
  };

  const handleFile = useCallback(async (chosen) => {
    if (!chosen) return;
    setBusy(true);
    try {
      const data = await parseSpreadsheet(chosen);
      if (!data.rows.length) throw new Error('That file has no data rows.');
      setFile(chosen);
      setParsed(data);
      setMapping(autoMapColumns(entityKey, data.headers));
      setStep(1);
    } catch (err) {
      toast.error(err.message || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }, [entityKey, toast]);

  // Validation runs entirely client-side, so the user sees row-level problems
  // before anything is sent anywhere.
  const validation = parsed ? validateRows(entityKey, parsed.rows, mapping) : null;

  const missingRequired = entity.fields
    .filter((f) => f.required && !mapping[f.key])
    .map((f) => f.label);

  const runDryRun = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/import/${entity.endpoint}`, {
        rows: validation.valid,
        dry_run: true,
      });
      setDryRun(res.data.data);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not check the file.');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/import/${entity.endpoint}`, {
        rows: validation.valid,
        dry_run: false,
      });
      setResult(res.data.data);
      setStep(3);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'The import failed.');
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    setBusy(true);
    try {
      const res = await api.delete(`/import/${entity.endpoint}/${result.batch_id}`);
      toast.success(res.data.message);
      reset();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not undo the import.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Step rail */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center justify-center size-6 rounded-full text-xs font-bold shrink-0',
                step > i && 'bg-success text-white',
                step === i && 'bg-accent text-accent-contrast',
                step < i && 'bg-surface-3 text-muted'
              )}
              aria-current={step === i ? 'step' : undefined}
            >
              {step > i ? <Check className="size-3" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn('text-xs font-semibold hidden sm:inline', step === i ? 'text-heading' : 'text-muted')}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className={cn('w-5 h-px', step > i ? 'bg-success' : 'bg-line')} aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {/* ── 1. Upload ── */}
      {step === 0 && (
        <Card padding="lg">
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              'flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl cursor-pointer',
              'border-2 border-dashed transition-colors',
              dragging ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-hover'
            )}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {busy ? (
              <Spinner label="Reading file" />
            ) : (
              <>
                <span className="flex items-center justify-center size-14 rounded-2xl bg-surface-3 text-muted mb-4">
                  <Upload className="size-6" aria-hidden="true" />
                </span>
                <span className="text-base font-bold text-heading">
                  Drop your {entity.label.toLowerCase()} file here
                </span>
                <span className="text-sm text-muted mt-1">CSV, XLSX or XLS · up to 10 MB</span>
                <span className="text-xs text-accent font-semibold mt-3">or click to browse</span>
              </>
            )}
          </label>

          <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-line">
            <p className="text-xs text-muted">
              Not sure about the format? Start from our template.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadTemplate(templateHeaders(entityKey), entityKey)}
            >
              <Download className="size-4" aria-hidden="true" />
              Template
            </Button>
          </div>
        </Card>
      )}

      {/* ── 2. Map columns ── */}
      {step === 1 && parsed && (
        <>
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="size-5 text-accent shrink-0" aria-hidden="true" />
              <div className="min-w-0 grow">
                <p className="text-sm font-semibold text-heading truncate">{file.name}</p>
                <p className="text-xs text-muted">
                  {parsed.rows.length} rows · {parsed.headers.length} columns
                </p>
              </div>
            </div>

            <p className="text-sm text-muted mb-4">
              We matched your columns automatically. Check them and adjust anything wrong.
            </p>

            <div className="flex flex-col gap-3">
              {entity.fields.map((field) => (
                <div key={field.key} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                  <span className="text-sm font-medium text-body">
                    {field.label}
                    {field.required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
                  </span>
                  <Select
                    aria-label={`Column for ${field.label}`}
                    value={mapping[field.key] || ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  >
                    <option value="">— Not imported —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>

            {missingRequired.length > 0 && (
              <p className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-danger-soft text-danger text-sm" role="alert">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Map these before continuing: {missingRequired.join(', ')}.</span>
              </p>
            )}
          </Card>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Start over
            </Button>
            <div className="grow" />
            <Button
              onClick={runDryRun}
              loading={busy}
              disabled={missingRequired.length > 0 || validation.valid.length === 0}
            >
              Check {validation.valid.length} row{validation.valid.length === 1 ? '' : 's'}
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </>
      )}

      {/* ── 3. Review ── */}
      {step === 2 && dryRun && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center">
              <p className="text-2xl font-bold text-success font-display tabular-nums">{dryRun.will_import}</p>
              <p className="text-xs text-muted mt-1">Will import</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-warning font-display tabular-nums">
                {dryRun.duplicates_skipped}
              </p>
              <p className="text-xs text-muted mt-1">Already on file</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-bold text-danger font-display tabular-nums">
                {validation.errors.length + (dryRun.errors?.length || 0)}
              </p>
              <p className="text-xs text-muted mt-1">Skipped</p>
            </Card>
          </div>

          {(validation.errors.length > 0 || dryRun.errors?.length > 0) && (
            <Card>
              <p className="text-sm font-bold text-heading mb-1">Rows that will be skipped</p>
              <p className="text-xs text-muted mb-3">
                Everything else still imports. Fix these in your file and run a second import if you need them.
              </p>
              <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5">
                {[...validation.errors, ...(dryRun.errors || [])].slice(0, 50).map((e) => (
                  <div key={e.row} className="flex gap-3 p-2 rounded-md bg-danger-soft text-sm">
                    <span className="font-mono text-xs text-danger shrink-0 pt-0.5">Row {e.row}</span>
                    <span className="text-body">{e.errors.join(' ')}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {dryRun.sample?.length > 0 && (
            <Card>
              <p className="text-sm font-bold text-heading mb-3">Preview of what will be created</p>
              <Table
                columns={entity.fields
                  .filter((f) => mapping[f.key])
                  .map((f) => ({ key: f.key, header: f.label }))}
                rows={dryRun.sample.map((r, i) => ({ ...r, id: i }))}
                renderCard={(r) => (
                  <div key={r.id} className="p-3 bg-surface-2 border border-line rounded-xl text-sm">
                    {entity.fields.filter((f) => mapping[f.key]).map((f) => (
                      <div key={f.key} className="flex justify-between gap-2">
                        <span className="text-muted">{f.label}</span>
                        <span className="text-heading truncate">{String(r[f.key] ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                )}
              />
            </Card>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
            <div className="grow" />
            <Button onClick={commit} loading={busy} disabled={dryRun.will_import === 0}>
              <Check className="size-4" aria-hidden="true" />
              Import {dryRun.will_import} row{dryRun.will_import === 1 ? '' : 's'}
            </Button>
          </div>
        </>
      )}

      {/* ── 4. Done ── */}
      {step === 3 && result && (
        <Card padding="lg">
          <EmptyState
            icon={Check}
            title={`${result.imported} ${entity.label.toLowerCase()} imported`}
            description={
              result.duplicates_skipped > 0
                ? `${result.duplicates_skipped} were already on file and were skipped.`
                : 'Everything in the file was imported.'
            }
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={reset}>
                  Import another file
                </Button>
                <Button variant="danger-soft" onClick={undo} loading={busy}>
                  <Undo2 className="size-4" aria-hidden="true" />
                  Undo this import
                </Button>
              </div>
            }
          />
          <p className="text-center text-xs text-muted mt-2">
            <Badge variant="neutral">Batch {String(result.batch_id).slice(0, 8)}</Badge>
          </p>
        </Card>
      )}
    </div>
  );
}
