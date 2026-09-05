import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, LogOut, Palette, CheckCircle2, Printer, Lock } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useFormDraft } from '../../hooks/useFormDraft';
import { THEME_PRESETS, applyTheme, getActiveThemeId } from '../../lib/theme';
import { getPrinterSettings, savePrinterSettings, printTestPage } from '../../lib/thermalPrinter';
import { STORAGE_KEYS } from '../../lib/storageKeys';
import { APP_NAME } from '../../lib/constants';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Card, CardHeader, Button,
  Input, Select, Textarea, Toggle, Skeleton,
} from '../../components/ui';
import { SUPPORTED_CURRENCIES, COMMON_TIMEZONES, formatMoney } from '../../lib/money';

const EMPTY_FORM = {
  gym_name: '', owner_name: '', phone: '', city: '', address: '',
  default_monthly_fee: '0', wa_msg_active: '', wa_msg_due_soon: '',
  currency: 'PKR', timezone: 'Asia/Karachi', locale: 'en-PK',
  wa_msg_expired: '', attendance_active: false,
};

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(getActiveThemeId);
  const [isApplyingTheme, setIsApplyingTheme] = useState(false);
  const [printerPaperWidth, setPrinterPaperWidth] = useState(() => getPrinterSettings().paperWidth);
  const [passForm, setPassForm] = useState({ current: '', newPass: '', confirm: '' });

  const { saveDraft, clearDraft } = useFormDraft('settings', {}, (draft) => {
    if (draft.form) setForm((prev) => ({ ...prev, ...draft.form }));
  });

  useEffect(() => {
    if (form) saveDraft({ form });
  }, [form, saveDraft]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const cachedRaw = localStorage.getItem(STORAGE_KEYS.gymSettings);
        const cached = cachedRaw ? JSON.parse(cachedRaw) : null;

        let g = null;
        try {
          const res = await api.get('/gym');
          g = { ...(cached || {}), ...(res.data.data || {}) };
          localStorage.setItem(STORAGE_KEYS.gymSettings, JSON.stringify(g));
        } catch {
          if (!cached) throw new Error('No cached settings');
          g = cached;
        }

        setForm((prev) => {
          if (prev?.gym_name) return prev; // a restored draft wins
          return {
            gym_name: g.gym_name || '',
            owner_name: g.owner_name || '',
            phone: g.phone || '',
            city: g.city || '',
            address: g.address || '',
            default_monthly_fee: String(g.default_monthly_fee ?? 0),
            currency: g.currency || 'PKR',
            timezone: g.timezone || 'Asia/Karachi',
            locale: g.locale || 'en-PK',
            wa_msg_active: g.wa_msg_active || '',
            wa_msg_due_soon: g.wa_msg_due_soon || '',
            wa_msg_expired: g.wa_msg_expired || '',
            attendance_active: g.attendance_active ?? false,
          };
        });
      } catch (err) {
        console.error('Failed to fetch gym settings', err);
        setForm(EMPTY_FORM);
        toast.error('Offline, and no settings are cached on this device.');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...form, default_monthly_fee: Number(form.default_monthly_fee) };
      localStorage.setItem(STORAGE_KEYS.gymSettings, JSON.stringify(payload));

      try {
        await api.put('/gym', payload);
        toast.success('Settings saved.');
      } catch {
        toast.warning('Saved on this device only — could not reach the server.');
      }
      clearDraft();
    } catch (err) {
      console.error(err);
      toast.error('Could not save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passForm.newPass !== passForm.confirm) {
      toast.error('The two passwords do not match.');
      return;
    }

    setIsChangingPass(true);
    try {
      // gym_id is no longer sent: the endpoint now takes it from the JWT.
      await api.post('/auth/change-password', {
        current_password: passForm.current,
        new_password: passForm.newPass,
      });
      toast.success('Password changed.');
      setPassForm({ current: '', newPass: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change the password.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleApplyTheme = () => {
    setIsApplyingTheme(true);
    try {
      setSelectedTheme(applyTheme(selectedTheme));
      toast.success('Theme applied.');
    } catch (err) {
      console.error(err);
      toast.error('Could not apply this theme.');
    } finally {
      setIsApplyingTheme(false);
    }
  };

  if (loading || !form) {
    return (
      <Page width="narrow">
        <Skeleton className="h-9 w-40 mb-6" />
        <Skeleton className="h-72 mb-4" />
        <Skeleton className="h-56" />
      </Page>
    );
  }

  return (
    <Page width="narrow">
      <PageHeader title="Settings" subtitle={user?.gym_name} />

      <div className="flex flex-col gap-4">
        <Card padding="lg">
          <CardHeader title="Gym information" subtitle="Appears on receipts and member messages" />
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <Input label="Gym name" value={form.gym_name} onChange={(e) => set('gym_name', e.target.value)} />
            <Input label="Owner name" value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              <Input label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <Input label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
            <Input
              label="Default monthly fee"
              hint="Pre-fills the amount when logging a member payment."
              type="text"
              inputMode="numeric"
              value={form.default_monthly_fee}
              onChange={(e) => set('default_monthly_fee', e.target.value)}
            />
            {/*
              attendance_active was already in the form state and sent to the
              API, but had no control — there was no way to turn the gate on or
              off from the UI.
            */}
            <Toggle
              label="Attendance gate"
              description="Require a check-in scan at the entrance."
              checked={form.attendance_active}
              onChange={(v) => set('attendance_active', v)}
            />
            <Button type="submit" block loading={isSaving} className="mt-1">
              <Save className="size-4" aria-hidden="true" />
              Save changes
            </Button>
          </form>
        </Card>

        <Card padding="lg">
          <CardHeader
            title="Region and currency"
            subtitle="Set when your gym was created. Changing the timezone affects how attendance days and expiry dates are calculated."
          />
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <Select label="Currency" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.symbol})
                </option>
              ))}
            </Select>

            <Select label="Timezone" value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </Select>

            <Input
              label="Locale"
              hint="Controls number and date formatting, e.g. en-US or de-DE."
              value={form.locale}
              onChange={(e) => set('locale', e.target.value)}
            />

            <p className="text-sm text-muted">
              A fee of {form.default_monthly_fee || 0} displays as{' '}
              <strong className="text-heading">
                {formatMoney(form.default_monthly_fee || 0, { currency: form.currency, locale: form.locale })}
              </strong>
            </p>

            <Button type="submit" block loading={isSaving}>
              <Save className="size-4" aria-hidden="true" />
              Save region settings
            </Button>
          </form>
        </Card>

        <Card padding="lg">
          <CardHeader title="Colour theme" subtitle="Applies across the whole app" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {THEME_PRESETS.map((theme) => {
              const isSelected = selectedTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    isSelected
                      ? 'border-accent bg-accent-soft'
                      : 'border-line hover:border-line-hover hover:bg-surface-3'
                  )}
                >
                  <span
                    className="size-8 rounded-lg shrink-0 border border-black/10"
                    style={{ background: theme.preview }}
                    aria-hidden="true"
                  />
                  <span className="grow min-w-0">
                    <span className="block text-sm font-semibold text-heading truncate">{theme.label}</span>
                    <span className="block text-xs text-muted truncate">{theme.description}</span>
                  </span>
                  {isSelected && <CheckCircle2 className="size-4 text-accent shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <Button block loading={isApplyingTheme} onClick={handleApplyTheme}>
            <Palette className="size-4" aria-hidden="true" />
            Apply theme
          </Button>
        </Card>

        <Card padding="lg">
          <CardHeader title="Thermal printer" subtitle="Receipt paper width and connection test" />
          <fieldset className="mb-4">
            <legend className="text-xs font-semibold text-body mb-1.5">Paper width</legend>
            <div className="flex gap-2">
              {['58mm', '80mm'].map((w) => (
                <Button
                  key={w}
                  type="button"
                  size="sm"
                  variant={printerPaperWidth === w ? 'primary' : 'secondary'}
                  aria-pressed={printerPaperWidth === w}
                  onClick={() => {
                    setPrinterPaperWidth(w);
                    savePrinterSettings({ paperWidth: w });
                    toast.success(`Paper width set to ${w}.`);
                  }}
                >
                  {w}
                </Button>
              ))}
            </div>
          </fieldset>
          <Button
            variant="secondary"
            block
            onClick={() => {
              printTestPage();
              toast.info('Test page sent to the printer.');
            }}
          >
            <Printer className="size-4" aria-hidden="true" />
            Print test page
          </Button>
        </Card>

        <Card padding="lg">
          <CardHeader
            title="WhatsApp templates"
            subtitle="Placeholders: [Name] [GymName] [Days] [Amount] [Phone]"
          />
          <form className="flex flex-col gap-4" onSubmit={handleSave}>
            <Textarea
              label="Active members"
              rows={3}
              placeholder="Message for members in good standing…"
              value={form.wa_msg_active}
              onChange={(e) => set('wa_msg_active', e.target.value)}
            />
            <Textarea
              label="Due soon (0–3 days left)"
              rows={3}
              placeholder="Message for members whose fee is about to expire…"
              value={form.wa_msg_due_soon}
              onChange={(e) => set('wa_msg_due_soon', e.target.value)}
            />
            <Textarea
              label="Expired members"
              rows={3}
              placeholder="Message for members whose fee has expired…"
              value={form.wa_msg_expired}
              onChange={(e) => set('wa_msg_expired', e.target.value)}
            />
            <Button type="submit" block loading={isSaving}>
              <Save className="size-4" aria-hidden="true" />
              Save templates
            </Button>
          </form>
        </Card>

        <Card padding="lg">
          <CardHeader title="Change password" />
          <form className="flex flex-col gap-4" onSubmit={handlePasswordChange}>
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              value={passForm.current}
              onChange={(e) => setPassForm((p) => ({ ...p, current: e.target.value }))}
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              value={passForm.newPass}
              onChange={(e) => setPassForm((p) => ({ ...p, newPass: e.target.value }))}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              error={passForm.confirm && passForm.newPass !== passForm.confirm ? 'Passwords do not match' : undefined}
              value={passForm.confirm}
              onChange={(e) => setPassForm((p) => ({ ...p, confirm: e.target.value }))}
            />
            <Button type="submit" variant="secondary" block loading={isChangingPass}>
              <Lock className="size-4" aria-hidden="true" />
              Change password
            </Button>
          </form>
        </Card>

        <Button
          variant="danger-soft"
          block
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Log out
        </Button>

        <p className="text-center text-xs text-muted">{APP_NAME} v1.0</p>
      </div>
    </Page>
  );
}
