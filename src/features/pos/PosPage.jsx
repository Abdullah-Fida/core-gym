import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingCart, Plus, Minus, Trash2, Package, AlertTriangle, Pencil,
  Search, Receipt, TrendingUp, Undo2, PackagePlus,
} from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useMoney } from '../../hooks/useMoney';
import { formatDateTime } from '../../lib/utils';
import { cn } from '../../lib/cn';
import {
  Page, PageHeader, Card, CardHeader, Button, Badge, Tabs, Modal, StatCard,
  Input, Select, Toggle, EmptyState, ListSkeleton, GridSkeleton, ErrorState,
} from '../../components/ui';

const CATEGORIES = [
  { key: 'supplement', label: 'Supplements' },
  { key: 'drink', label: 'Drinks' },
  { key: 'apparel', label: 'Apparel' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'service', label: 'Services' },
  { key: 'other', label: 'Other' },
];

const emptyProduct = () => ({
  name: '', sku: '', category: 'supplement',
  price: '', cost: '', stock: '0', low_stock_at: '5',
  track_stock: true, is_active: true,
});

export default function PosPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const money = useMoney();

  const [tab, setTab] = useState('sell');
  const [products, setProducts] = useState(null);
  const [productStats, setProductStats] = useState(null);
  const [sales, setSales] = useState(null);
  const [saleStats, setSaleStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(0);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [checkout, setCheckout] = useState({ member_id: '', discount: '', payment_method: 'cash', note: '' });
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [productModal, setProductModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [restocking, setRestocking] = useState(null);
  const [restockDelta, setRestockDelta] = useState('');

  const reload = useCallback(() => setToken((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, s] = await Promise.all([
          api.get('/pos/products'),
          api.get('/pos/sales'),
        ]);
        if (!alive) return;
        setError(null);
        setProducts(p.data.data || []);
        setProductStats(p.data.stats);
        setSales(s.data.data || []);
        setSaleStats(s.data.stats);
      } catch (err) {
        if (!alive) return;
        setError(err.response?.data?.message || 'Could not load the shop.');
        setProducts([]);
        setSales([]);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    api.get('/members')
      .then((r) => setMembers((r.data.data || []).filter((m) => m.status !== 'deleted')))
      .catch(() => setMembers([]));
  }, []);

  const sellable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products || []).filter((p) => {
      if (!p.is_active) return false;
      if (category && p.category !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || String(p.sku || '').toLowerCase().includes(q);
    });
  }, [products, search, category]);

  const cartTotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const discount = Math.min(Number(checkout.discount) || 0, cartTotal);
  const grandTotal = Math.max(0, cartTotal - discount);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.id === product.id);
      const inCart = existing?.quantity ?? 0;

      // Block going past available stock here as well as server-side, so the
      // cashier is told immediately rather than at checkout.
      if (product.track_stock && inCart + 1 > product.stock) {
        toast.error(`Only ${product.stock} × ${product.name} in stock.`);
        return prev;
      }

      if (existing) {
        return prev.map((l) => (l.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, {
        id: product.id, name: product.name, price: Number(product.price),
        quantity: 1, stock: product.stock, track_stock: product.track_stock,
      }];
    });
  };

  const changeQty = (id, delta) => {
    setCart((prev) => prev.flatMap((l) => {
      if (l.id !== id) return [l];
      const next = l.quantity + delta;
      if (next <= 0) return [];
      if (l.track_stock && next > l.stock) {
        toast.error(`Only ${l.stock} in stock.`);
        return [l];
      }
      return [{ ...l, quantity: next }];
    }));
  };

  const completeSale = async () => {
    setBusy(true);
    try {
      const res = await api.post('/pos/sales', {
        member_id: checkout.member_id || null,
        items: cart.map((l) => ({ product_id: l.id, quantity: l.quantity })),
        discount,
        payment_method: checkout.payment_method,
        note: checkout.note || undefined,
      });
      toast.success(`${money(res.data.data.total)} — sale recorded.`);
      setCart([]);
      setCheckout({ member_id: '', discount: '', payment_method: 'cash', note: '' });
      setCheckoutOpen(false);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'The sale could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        const { stock: _stock, ...rest } = form;
        await api.patch(`/pos/products/${editing.id}`, rest);
      } else {
        await api.post('/pos/products', form);
      }
      toast.success('Product saved.');
      setProductModal(false);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save this product.');
    } finally {
      setBusy(false);
    }
  };

  const restock = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/pos/products/${restocking.id}/restock`, {
        delta: Number(restockDelta),
        reason: Number(restockDelta) > 0 ? 'restock' : 'adjustment',
      });
      toast.success(res.data.message);
      setRestocking(null);
      setRestockDelta('');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update stock.');
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (p) => {
    const ok = await confirm({ title: `Delete "${p.name}"?`, confirmText: 'Delete' });
    if (!ok) return;
    const res = await api.delete(`/pos/products/${p.id}`);
    toast.success(res.data.message);
    reload();
  };

  const refund = async (sale) => {
    const ok = await confirm({
      title: 'Refund this sale?',
      message: 'The items go back into stock and the sale is marked refunded.',
      confirmText: 'Refund',
    });
    if (!ok) return;
    try {
      await api.post(`/pos/sales/${sale.id}/refund`);
      toast.success('Refunded.');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not refund that sale.');
    }
  };

  const lowStock = (products || []).filter((p) => p.is_low && p.is_active);

  return (
    <Page>
      <PageHeader title="Shop" subtitle="Sell supplements and merchandise." />

      <Tabs
        items={[
          { key: 'sell', label: 'Sell', count: cart.length || undefined },
          { key: 'stock', label: 'Stock', count: products?.length },
          { key: 'sales', label: 'Sales', count: sales?.length },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />

      {/* ── Sell ── */}
      {tab === 'sell' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4 items-start">
          <div>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative grow">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted"
                  aria-hidden="true"
                />
                <Input
                  type="search" className="pl-9" placeholder="Search products…"
                  aria-label="Search products"
                  value={search} onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select
                aria-label="Category" className="sm:w-44"
                value={category} onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
            </div>

            {products === null ? <GridSkeleton items={6} />
              : error ? <ErrorState description={error} onRetry={reload} />
                : sellable.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title={search || category ? 'Nothing matches' : 'No products yet'}
                    description={search || category ? 'Try a different search.' : 'Add something to sell.'}
                    action={
                      !search && !category
                        ? <Button onClick={() => { setEditing(null); setForm(emptyProduct()); setProductModal(true); }}>Add a product</Button>
                        : undefined
                    }
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {sellable.map((p) => {
                      const out = p.track_stock && p.stock <= 0;
                      return (
                        <Card
                          key={p.id}
                          as="button"
                          interactive={!out}
                          disabled={out}
                          onClick={() => !out && addToCart(p)}
                          className={cn('text-left', out && 'opacity-50 cursor-not-allowed')}
                        >
                          <p className="font-semibold text-heading text-sm truncate">{p.name}</p>
                          <p className="text-lg font-bold text-heading font-display tabular-nums mt-1">
                            {money(p.price)}
                          </p>
                          <p className={cn('text-xs mt-1', p.is_low ? 'text-warning font-semibold' : 'text-muted')}>
                            {!p.track_stock ? 'Service' : out ? 'Out of stock' : `${p.stock} in stock`}
                          </p>
                        </Card>
                      );
                    })}
                  </div>
                )}
          </div>

          {/* Cart */}
          <Card className="lg:sticky lg:top-4">
            <CardHeader title="Cart" subtitle={cart.length ? `${cart.length} line${cart.length === 1 ? '' : 's'}` : 'Empty'} />

            {cart.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center">Tap a product to add it.</p>
            ) : (
              <>
                <ul className="flex flex-col gap-2 mb-4 max-h-80 overflow-y-auto">
                  {cart.map((l) => (
                    <li key={l.id} className="flex items-center gap-2">
                      <span className="grow min-w-0">
                        <span className="block text-sm font-medium text-heading truncate">{l.name}</span>
                        <span className="block text-xs text-muted tabular-nums">
                          {money(l.price)} × {l.quantity}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost" size="icon-sm" aria-label={`Remove one ${l.name}`}
                          onClick={() => changeQty(l.id, -1)}
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </Button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums">{l.quantity}</span>
                        <Button
                          variant="ghost" size="icon-sm" aria-label={`Add one ${l.name}`}
                          onClick={() => changeQty(l.id, 1)}
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </Button>
                      </span>
                      <span className="w-16 text-right text-sm font-bold text-heading tabular-nums shrink-0">
                        {money(l.price * l.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-between items-baseline pt-3 border-t border-line mb-3">
                  <span className="text-sm text-muted">Total</span>
                  <span className="text-xl font-bold text-heading font-display tabular-nums">
                    {money(cartTotal)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setCart([])}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                  <Button className="grow" onClick={() => setCheckoutOpen(true)}>
                    <ShoppingCart className="size-4" aria-hidden="true" />
                    Checkout
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Stock ── */}
      {tab === 'stock' && (
        <>
          {productStats && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              <StatCard label="Products" value={productStats.total} tone="accent" icon={Package} />
              <StatCard
                label="Low stock"
                value={productStats.low_stock}
                tone={productStats.low_stock > 0 ? 'warning' : 'success'}
                icon={AlertTriangle}
              />
              <StatCard label="Stock value" value={money(productStats.stock_value)} tone="info" icon={TrendingUp} />
            </div>
          )}

          {lowStock.length > 0 && (
            <Card className="mb-4 border-warning/40">
              <CardHeader title="Running low" subtitle="Reorder these soon." />
              <div className="flex flex-wrap gap-2">
                {lowStock.map((p) => (
                  <Badge key={p.id} variant="warning">{p.name} · {p.stock} left</Badge>
                ))}
              </div>
            </Card>
          )}

          <div className="flex justify-end mb-3">
            <Button onClick={() => { setEditing(null); setForm(emptyProduct()); setProductModal(true); }}>
              <Plus className="size-4" aria-hidden="true" />
              Add product
            </Button>
          </div>

          {products === null ? <ListSkeleton rows={4} />
            : products.length === 0 ? (
              <EmptyState icon={Package} title="No products" description="Add what you sell at the front desk." />
            ) : (
              <div className="flex flex-col gap-2">
                {products.map((p) => (
                  <Card key={p.id} className={cn('flex items-center gap-3', !p.is_active && 'opacity-60')}>
                    <span className="grow min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-heading truncate">{p.name}</span>
                        {!p.is_active && <Badge variant="neutral">Inactive</Badge>}
                        {p.is_low && <Badge variant="warning">Low</Badge>}
                      </span>
                      <span className="block text-xs text-muted">
                        {CATEGORIES.find((c) => c.key === p.category)?.label}
                        {p.sku && ` · ${p.sku}`}
                        {' · cost '}{money(p.cost)}
                      </span>
                    </span>

                    <span className="text-right shrink-0">
                      <span className="block font-bold text-heading tabular-nums">{money(p.price)}</span>
                      <span className="block text-xs text-muted tabular-nums">
                        {p.track_stock ? `${p.stock} in stock` : 'Service'}
                      </span>
                    </span>

                    <span className="flex gap-1 shrink-0">
                      {p.track_stock && (
                        <Button
                          variant="ghost" size="icon-sm" aria-label={`Adjust stock for ${p.name}`}
                          onClick={() => { setRestocking(p); setRestockDelta(''); }}
                        >
                          <PackagePlus className="size-4" aria-hidden="true" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon-sm" aria-label={`Edit ${p.name}`}
                        onClick={() => {
                          setEditing(p);
                          setForm({
                            ...emptyProduct(), ...p,
                            price: String(p.price), cost: String(p.cost),
                            low_stock_at: String(p.low_stock_at), sku: p.sku || '',
                          });
                          setProductModal(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost" size="icon-sm" aria-label={`Delete ${p.name}`}
                        className="text-muted hover:text-danger hover:bg-danger-soft"
                        onClick={() => removeProduct(p)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </span>
                  </Card>
                ))}
              </div>
            )}
        </>
      )}

      {/* ── Sales ── */}
      {tab === 'sales' && (
        <>
          {saleStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <StatCard label="Sales" value={saleStats.count} tone="accent" icon={Receipt} />
              <StatCard label="Revenue" value={money(saleStats.revenue)} tone="success" icon={TrendingUp} />
              <StatCard label="Cost" value={money(saleStats.cost)} tone="warning" icon={Package} />
              <StatCard label="Profit" value={money(saleStats.profit)} tone="info" icon={TrendingUp} />
            </div>
          )}

          {sales === null ? <ListSkeleton rows={5} />
            : sales.length === 0 ? (
              <EmptyState icon={Receipt} title="No sales yet" />
            ) : (
              <div className="flex flex-col gap-2">
                {sales.map((s) => (
                  <Card key={s.id} className={cn(s.status === 'refunded' && 'opacity-60')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-heading truncate">
                            {s.member?.name || 'Walk-in'}
                          </span>
                          {s.status === 'refunded' && <Badge variant="danger">Refunded</Badge>}
                        </div>
                        <p className="text-xs text-muted">{formatDateTime(s.sold_at)} · {s.payment_method}</p>
                        <p className="text-xs text-muted mt-1 truncate">
                          {(s.items || []).map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-success tabular-nums">{money(s.total)}</p>
                        {s.discount > 0 && (
                          <p className="text-xs text-muted">−{money(s.discount)} off</p>
                        )}
                        {s.status === 'completed' && (
                          <Button variant="ghost" size="sm" className="mt-1" onClick={() => refund(s)}>
                            <Undo2 className="size-3.5" aria-hidden="true" />
                            Refund
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
        </>
      )}

      {/* ── Checkout ── */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Complete sale">
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-1 p-3 rounded-lg bg-surface-3 text-sm">
            {cart.map((l) => (
              <li key={l.id} className="flex justify-between gap-2">
                <span className="text-body truncate">{l.quantity} × {l.name}</span>
                <span className="text-heading tabular-nums shrink-0">{money(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>

          <Select
            label="Member" hint="Leave blank for a walk-in customer."
            value={checkout.member_id}
            onChange={(e) => setCheckout({ ...checkout, member_id: e.target.value })}
          >
            <option value="">Walk-in</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Discount" type="number" min="0" placeholder="0"
              value={checkout.discount}
              onChange={(e) => setCheckout({ ...checkout, discount: e.target.value })}
            />
            <Select
              label="Payment"
              value={checkout.payment_method}
              onChange={(e) => setCheckout({ ...checkout, payment_method: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="other">Other</option>
            </Select>
          </div>

          <div className="flex justify-between items-baseline p-3 rounded-lg bg-accent-soft">
            <span className="text-sm font-semibold text-accent">To pay</span>
            <span className="text-2xl font-bold text-accent font-display tabular-nums">
              {money(grandTotal)}
            </span>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button block loading={busy} onClick={completeSale}>Take payment</Button>
          </div>
        </div>
      </Modal>

      {/* ── Product modal ── */}
      <Modal
        open={productModal}
        onClose={() => setProductModal(false)}
        title={editing ? `Edit ${editing.name}` : 'New product'}
      >
        <form className="flex flex-col gap-4" onSubmit={saveProduct}>
          <Input
            label="Name" required autoFocus
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <Select
              label="Category" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Sell price" required type="number" min="0"
              value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <Input
              label="Cost price" hint="Used to report margin."
              type="number" min="0"
              value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })}
            />
          </div>

          <Toggle
            label="Track stock"
            description="Turn off for services like a day pass, which have no stock."
            checked={form.track_stock}
            onChange={(v) => setForm({ ...form, track_stock: v })}
          />

          {form.track_stock && (
            <div className="grid grid-cols-2 gap-4">
              {!editing && (
                <Input
                  label="Opening stock" type="number" min="0"
                  value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              )}
              <Input
                label="Low stock alert at" type="number" min="0"
                value={form.low_stock_at}
                onChange={(e) => setForm({ ...form, low_stock_at: e.target.value })}
              />
            </div>
          )}

          {editing && (
            <p className="text-xs text-muted">
              Stock is changed from the stock list, so every movement is recorded.
            </p>
          )}

          <Toggle
            label="Available to sell"
            checked={form.is_active}
            onChange={(v) => setForm({ ...form, is_active: v })}
          />

          <div className="flex gap-2 mt-2">
            <Button type="button" variant="secondary" block onClick={() => setProductModal(false)}>Cancel</Button>
            <Button type="submit" block loading={busy}>{editing ? 'Save' : 'Add product'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Restock ── */}
      <Modal
        open={Boolean(restocking)}
        onClose={() => setRestocking(null)}
        title={`Adjust stock — ${restocking?.name ?? ''}`}
        description={restocking ? `Currently ${restocking.stock} in stock.` : undefined}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Change by"
            hint="Positive to add stock, negative to remove it."
            type="number"
            autoFocus
            placeholder="e.g. 24 or -2"
            value={restockDelta}
            onChange={(e) => setRestockDelta(e.target.value)}
          />
          {restockDelta !== '' && restocking && (
            <p className="text-sm text-muted">
              New level: <strong className="text-heading">{restocking.stock + Number(restockDelta)}</strong>
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setRestocking(null)}>Cancel</Button>
            <Button
              block loading={busy}
              disabled={!restockDelta || Number(restockDelta) === 0}
              onClick={restock}
            >
              Update stock
            </Button>
          </div>
        </div>
      </Modal>
    </Page>
  );
}
