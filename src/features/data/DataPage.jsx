import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useMoney } from '../../hooks/useMoney';
import { formatDate } from '../../lib/utils';
import { exportCSV, exportXLSX } from '../../lib/fileIO';
import { generateReport } from '../../lib/pdfReport';
import { ENTITIES } from './entitySchemas';
import {
  Page, PageHeader, Card, CardHeader, Button, Tabs, Select,
} from '../../components/ui';
import ImportWizard from './ImportWizard';

/**
 * Export column sets.
 *
 * Explicitly listed rather than dumping the row, so an export can never leak
 * internal columns (gym_id, import_batch, password hashes).
 */
const EXPORTS = {
  members: {
    endpoint: '/members',
    columns: (money) => [
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
      { key: 'join_date', label: 'Join date', format: (r) => formatDate(r.join_date) },
      { key: 'expiry_date', label: 'Expiry', format: (r) => formatDate(r.expiry_date) },
      { key: 'emergency_contact', label: 'Emergency contact' },
      { key: 'notes', label: 'Notes' },
      { key: 'last_payment', label: 'Last payment', format: (r) => (r.last_payment_amount ? money(r.last_payment_amount) : '') },
    ],
  },
  payments: {
    endpoint: '/payments',
    columns: (money) => [
      { key: 'member_name', label: 'Member', format: (r) => r.members?.name || r.member_name || '' },
      { key: 'amount', label: 'Amount', format: (r) => money(r.amount), align: 'right' },
      { key: 'payment_date', label: 'Date', format: (r) => formatDate(r.payment_date) },
      { key: 'payment_method', label: 'Method' },
      { key: 'plan_duration_months', label: 'Months' },
      { key: 'received_by', label: 'Received by' },
      { key: 'notes', label: 'Notes' },
    ],
  },
  staff: {
    endpoint: '/staff',
    columns: (money) => [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'phone', label: 'Phone' },
      { key: 'monthly_salary', label: 'Monthly salary', format: (r) => money(r.monthly_salary), align: 'right' },
      { key: 'join_date', label: 'Join date', format: (r) => formatDate(r.join_date) },
    ],
  },
  expenses: {
    endpoint: '/expenses',
    columns: (money) => [
      { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' },
      { key: 'amount', label: 'Amount', format: (r) => money(r.amount), align: 'right' },
      { key: 'expense_date', label: 'Date', format: (r) => formatDate(r.expense_date) },
      { key: 'notes', label: 'Notes' },
    ],
  },
};

export default function DataPage() {
  const { user } = useAuth();
  const toast = useToast();
  const money = useMoney();

  const [tab, setTab] = useState('export');
  const [entity, setEntity] = useState('members');
  const [busy, setBusy] = useState(null);

  const fetchRows = async (key) => {
    const res = await api.get(EXPORTS[key].endpoint);
    return res.data.data || [];
  };

  const run = async (key, format) => {
    setBusy(`${key}-${format}`);
    try {
      const rows = await fetchRows(key);
      if (!rows.length) {
        toast.info(`No ${ENTITIES[key].label.toLowerCase()} to export yet.`);
        return;
      }
      const columns = EXPORTS[key].columns(money);
      const name = `${user?.gym_name || 'gym'}-${key}`.toLowerCase().replace(/\s+/g, '-');

      if (format === 'csv') exportCSV(rows, columns, name);
      else if (format === 'xlsx') exportXLSX(rows, columns, name, ENTITIES[key].label);
      else {
        const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
        generateReport({
          gymName: user?.gym_name,
          title: `${ENTITIES[key].label} report`,
          subtitle: `${rows.length} record${rows.length === 1 ? '' : 's'}`,
          stats: [
            { label: 'Records', value: rows.length },
            ...(total > 0 ? [{ label: 'Total', value: money(total) }] : []),
          ],
          columns,
          rows,
          filename: name,
          orientation: columns.length > 5 ? 'landscape' : 'portrait',
        });
      }
      toast.success(`${ENTITIES[key].label} exported.`);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'The export failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Import &amp; export"
        subtitle="Move your data in from another system, or take it out whenever you want."
      />

      <Tabs
        items={[
          { key: 'export', label: 'Export' },
          { key: 'import', label: 'Import' },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />

      {tab === 'export' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.keys(EXPORTS).map((key) => (
            <Card key={key}>
              <CardHeader title={ENTITIES[key].label} subtitle="Download everything on file" />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === `${key}-csv`}
                  onClick={() => run(key, 'csv')}
                >
                  <Download className="size-4" aria-hidden="true" />
                  CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === `${key}-xlsx`}
                  onClick={() => run(key, 'xlsx')}
                >
                  <FileSpreadsheet className="size-4" aria-hidden="true" />
                  Excel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={busy === `${key}-pdf`}
                  onClick={() => run(key, 'pdf')}
                >
                  <FileText className="size-4" aria-hidden="true" />
                  PDF
                </Button>
              </div>
            </Card>
          ))}

          <Card className="md:col-span-2">
            <CardHeader
              title="Everything"
              subtitle="One Excel workbook is not offered yet — export each set above."
            />
            <p className="text-sm text-muted">
              Your data is yours. Every export contains the full history, not a sample,
              and nothing is watermarked or limited.
            </p>
          </Card>
        </div>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader title="What are you importing?" />
            <Select
              aria-label="Entity to import"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
            >
              {Object.entries(ENTITIES).map(([key, def]) => (
                <option key={key} value={key}>{def.label}</option>
              ))}
            </Select>
            {entity === 'payments' && (
              <p className="text-xs text-muted mt-2">
                Payments are matched to existing members by phone number, so import your members first.
              </p>
            )}
          </Card>

          {/* Remounting on entity change resets the wizard, so a half-finished
              mapping for one entity cannot leak into another. */}
          <ImportWizard key={entity} entityKey={entity} />
        </>
      )}
    </Page>
  );
}
