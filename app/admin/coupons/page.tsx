'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type DiscountType = 'percentage' | 'fixed_amount' | 'free_shipping';

interface CouponRow {
  id: string;
  code: string;
  type: DiscountType;
  typeLabel: string;
  value: number;
  minPurchase: number;
  usageLimit: number | null;
  usedCount: number;
  startDate: string;
  endDate: string | null;
  status: string;
  description: string;
  isActive: boolean;
  rawStart: string | null;
  rawEnd: string | null;
}

const TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Percentage',
  fixed_amount: 'Fixed Amount',
  free_shipping: 'Free Shipping',
};

const EMPTY_FORM = {
  code: '',
  description: '',
  type: 'percentage' as DiscountType,
  value: '',
  minPurchase: '',
  usageLimit: '',
  startDate: '',
  endDate: '',
  isActive: true,
};

export default function AdminCouponsPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState('All Status');

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setCoupons((data || []).map(mapCoupon));
    } catch (err) {
      console.error('Error fetching coupons:', err);
    } finally {
      setLoading(false);
    }
  };

  function mapCoupon(c: any): CouponRow {
    const active = isCouponActive(c);
    return {
      id: c.id,
      code: c.code,
      type: c.type,
      typeLabel: TYPE_LABELS[c.type as DiscountType] || c.type,
      value: Number(c.value) || 0,
      minPurchase: Number(c.minimum_purchase) || 0,
      usageLimit: c.usage_limit ?? null,
      usedCount: c.usage_count || 0,
      startDate: c.start_date ? new Date(c.start_date).toLocaleDateString() : 'Immediate',
      endDate: c.end_date ? new Date(c.end_date).toLocaleDateString() : null,
      status: !c.is_active ? 'Disabled' : active ? 'Active' : 'Expired',
      description: c.description || '',
      isActive: c.is_active !== false,
      rawStart: c.start_date,
      rawEnd: c.end_date,
    };
  }

  function isCouponActive(c: any) {
    if (!c.is_active) return false;
    const now = new Date();
    if (c.start_date && new Date(c.start_date) > now) return false;
    if (c.end_date && new Date(c.end_date) < now) return false;
    if (c.usage_limit && (c.usage_count || 0) >= c.usage_limit) return false;
    return true;
  }

  function openCreate() {
    setEditingCoupon(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowModal(true);
  }

  function openEdit(coupon: CouponRow) {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      description: coupon.description,
      type: coupon.type,
      value: coupon.type === 'free_shipping' ? '' : String(coupon.value),
      minPurchase: coupon.minPurchase ? String(coupon.minPurchase) : '',
      usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : '',
      startDate: coupon.rawStart ? coupon.rawStart.slice(0, 10) : '',
      endDate: coupon.rawEnd ? coupon.rawEnd.slice(0, 10) : '',
      isActive: coupon.isActive,
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const code = form.code.trim().toUpperCase();
    if (!code) {
      setError('Coupon code is required');
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      code,
      description: form.description.trim() || null,
      type: form.type,
      value: form.type === 'free_shipping' ? 0 : Number(form.value) || 0,
      minimum_purchase: Number(form.minPurchase) || 0,
      usage_limit: form.usageLimit ? Number(form.usageLimit) : null,
      start_date: form.startDate ? new Date(form.startDate).toISOString() : null,
      end_date: form.endDate ? new Date(form.endDate).toISOString() : null,
      is_active: form.isActive,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingCoupon) {
        const { error: updateError } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', editingCoupon.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('coupons').insert(payload);
        if (insertError) throw insertError;
      }

      setShowModal(false);
      fetchCoupons();
    } catch (err: any) {
      setError(err.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Delete coupon ${code}? This cannot be undone.`)) return;
    const { error: deleteError } = await supabase.from('coupons').delete().eq('id', id);
    if (deleteError) {
      alert(deleteError.message);
      return;
    }
    fetchCoupons();
  }

  const statusColors: Record<string, string> = {
    Active: 'bg-gray-100 text-gray-900',
    Scheduled: 'bg-blue-100 text-blue-700',
    Expired: 'bg-gray-100 text-gray-700',
    Disabled: 'bg-red-100 text-red-700',
  };

  const filteredCoupons = coupons.filter((c) => {
    if (statusFilter === 'All Status') return true;
    return c.status === statusFilter;
  });

  const activeCoupons = coupons.filter((c) => c.status === 'Active');
  const totalUses = coupons.reduce((sum, c) => sum + c.usedCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coupons & Promotions</h1>
          <p className="text-gray-600 mt-1">Create and manage discount codes</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line mr-2"></i>
          Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Coupons</p>
          <p className="text-2xl font-bold text-gray-900">{coupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-gray-900">{activeCoupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Uses</p>
          <p className="text-2xl font-bold text-gray-900">{totalUses}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Discount</p>
          <p className="text-2xl font-bold text-purple-700">—</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">All Coupons</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 font-medium cursor-pointer"
            >
              <option>All Status</option>
              <option>Active</option>
              <option>Expired</option>
              <option>Disabled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Code</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Value</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Min Purchase</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Usage</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Valid Period</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading coupons...</td></tr>
              ) : filteredCoupons.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">No coupons found.</td></tr>
              ) : (
                filteredCoupons.map((coupon) => (
                  <tr key={coupon.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">{coupon.code}</span>
                    </td>
                    <td className="py-4 px-4 text-gray-700">{coupon.typeLabel}</td>
                    <td className="py-4 px-4 font-semibold text-gray-900">
                      {coupon.type === 'percentage' ? `${coupon.value}%` : coupon.type === 'fixed_amount' ? `₵ ${coupon.value}` : 'Free'}
                    </td>
                    <td className="py-4 px-4 text-gray-700 whitespace-nowrap">
                      {coupon.minPurchase > 0 ? `₵ ${coupon.minPurchase.toFixed(2)}` : 'No minimum'}
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-900 font-semibold">{coupon.usedCount}</span>
                      <span className="text-gray-500"> / {coupon.usageLimit || '∞'}</span>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-700">{coupon.startDate}</p>
                      <p className="text-sm text-gray-500">{coupon.endDate || 'No expiry'}</p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[coupon.status] || 'bg-gray-100'}`}>
                        {coupon.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openEdit(coupon)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                        >
                          <i className="ri-edit-line text-lg"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(coupon.id, coupon.code)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  required
                  placeholder="SUMMER20"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional note for your team"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Discount Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DiscountType }))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                >
                  <option value="percentage">Percentage off</option>
                  <option value="fixed_amount">Fixed amount off (₵)</option>
                  <option value="free_shipping">Free shipping</option>
                </select>
              </div>

              {form.type !== 'free_shipping' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Value *</label>
                  <input
                    type="number"
                    min="0"
                    step={form.type === 'percentage' ? '1' : '0.01'}
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Min Purchase (₵)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minPurchase}
                    onChange={(e) => setForm((f) => ({ ...f, minPurchase: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Usage Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={form.usageLimit}
                    onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                    placeholder="Unlimited"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Active (customers can use this code)</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingCoupon ? 'Save Changes' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
