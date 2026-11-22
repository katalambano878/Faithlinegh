'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { adminRequest } from '@/lib/admin-request';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState<'7days' | '30days'>('7days');
  const [loading, setLoading] = useState(true);

  type Stat = { title: string; value: string; hint: string; icon: string; color: string; href?: string };
  const [stats, setStats] = useState<Stat[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);

  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  // Revenue per day from confirmed (paid, not cancelled) orders, for the chosen range
  const chartData = useMemo(() => {
    const days = dateRange === '30days' ? 30 : 7;
    const keys = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return d.toISOString().split('T')[0];
    });
    const totals: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
    for (const o of allOrders) {
      if (o.payment_status !== 'paid' || o.status === 'cancelled' || o.status === 'refunded') continue;
      const k = new Date(o.created_at).toISOString().split('T')[0];
      if (k in totals) totals[k] += Number(o.total) || 0;
    }
    return keys.map(k => ({
      date: new Date(k).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
      revenue: totals[k],
    }));
  }, [allOrders, dateRange]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // 1. All orders, split into confirmed (paid) and abandoned (never paid)
        const { data: allOrdersData, error: ordersError } = await supabase
          .from('orders')
          .select('total, status, payment_status, created_at, email, phone, metadata');

        if (ordersError) throw ordersError;
        const orders = allOrdersData || [];
        setAllOrders(orders);

        const closed = (o: any) => o.status === 'cancelled' || o.status === 'refunded';
        const isPos = (o: any) => o.metadata?.pos_sale === true || o.metadata?.pos_sale === 'true';
        // Confirmed: paid and not cancelled or refunded afterwards. Only these count as money made.
        const confirmed = orders.filter(o => o.payment_status === 'paid' && !closed(o));
        // Abandoned: placed but never paid (cancelled ones are left out of both)
        const abandoned = orders.filter(o => o.payment_status !== 'paid' && !closed(o));

        const revenue = confirmed.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const unpaidValue = abandoned.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        const posCount = confirmed.filter(isPos).length;
        const avgOrderValue = confirmed.length > 0 ? revenue / confirmed.length : 0;
        const payingCustomers = new Set(confirmed.map(o => (o.email || o.phone || '').toLowerCase()).filter(Boolean)).size;
        const cedi = (n: number) => `₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        setStats([
          { title: 'Revenue (paid orders)', value: cedi(revenue), hint: 'Money from confirmed orders only', icon: 'ri-money-dollar-circle-line', color: 'gray', href: '/admin/sold' },
          { title: 'Confirmed orders', value: String(confirmed.length), hint: `${confirmed.length - posCount} website · ${posCount} in store`, icon: 'ri-shopping-bag-line', color: 'blue', href: '/admin/orders' },
          { title: 'Abandoned (not paid)', value: String(abandoned.length), hint: `${cedi(unpaidValue)} not collected, not counted above`, icon: 'ri-shopping-cart-2-line', color: 'amber', href: '/admin/orders' },
          { title: 'Paying customers', value: String(payingCustomers), hint: 'People with at least one paid order', icon: 'ri-group-line', color: 'purple', href: '/admin/customers' },
          { title: 'Avg order value', value: cedi(avgOrderValue), hint: 'Paid orders only', icon: 'ri-line-chart-line', color: 'amber' },
        ]);

        // 3. Fetch Recent Orders (only paid orders)
        const { data: recentOrdersData } = await supabase
          .from('orders')
          .select('id, order_number, user_id, email, created_at, total, status, shipping_address')
          .eq('payment_status', 'paid')
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentOrdersData) {
          const formattedRecent = recentOrdersData.map((o: any) => {
            const addr = o.shipping_address || {};
            const customerName = (addr.firstName && addr.lastName)
              ? `${addr.firstName.trim()} ${addr.lastName.trim()}`
              : addr.full_name || addr.firstName || o.email.split('@')[0];
            return {
              id: o.id,
              displayId: o.order_number,
              customer: customerName,
              email: o.email,
              date: new Date(o.created_at).toLocaleDateString(),
              total: o.total,
              status: o.status,
              items: 1
            };
          });
          setRecentOrders(formattedRecent);
        }

        // 4. Fetch Low Stock Products
        const { data: lowStockData } = await supabase
          .from('products')
          .select('name, quantity')
          .lt('quantity', 10)
          .limit(5);

        if (lowStockData) {
          setLowStockProducts(lowStockData.map((p: any) => ({
            name: p.name,
            stock: p.quantity,
            status: p.quantity === 0 ? 'critical' : 'low'
          })));
        }

        // 5. Best sellers from paid orders
        try {
          const sold = await adminRequest<{ products: any[] }>('/api/admin/sold?period=all');
          const top = (sold.products || []).filter((p: any) => p.productId).slice(0, 4);
          const { data: productData } = top.length
            ? await supabase.from('products').select('id, name, quantity, product_images(url, position)').in('id', top.map((p: any) => p.productId))
            : { data: [] as any[] };
          setTopProducts(top.map((t: any) => {
            const p: any = (productData || []).find((x: any) => x.id === t.productId) || {};
            const imgs = [...(p.product_images || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
            return { id: t.productId, name: t.name, image: imgs[0]?.url || '', sales: t.unitsSold, revenue: t.revenue, stock: p.quantity ?? 0 };
          }));
        } catch (err) {
          console.error('Best sellers failed:', err);
        }

      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const statusColors: any = {
    'pending': 'bg-brand-cream text-brand-brown',
    'processing': 'bg-brand-cream text-brand-brown',
    'shipped': 'bg-brand-cream text-brand-brown',
    'dispatched_to_rider': 'bg-brand-cream text-brand-brown',
    'delivered': 'bg-gray-100 text-gray-900',
    'cancelled': 'bg-red-100 text-brand-brown'
  };

  const quickActions = [
    {
      title: 'Feature Modules',
      description: 'Manage 40+ store features',
      icon: 'ri-puzzle-line',
      color: 'purple',
      link: '/admin/modules',
      badge: '40 Features'
    },
    {
      title: 'Inventory Management',
      description: 'Track stock & manage reorders',
      icon: 'ri-stack-line',
      color: 'amber',
      link: '/admin/inventory'
    },
    // ... reduced list for brevity or keep all if desired
  ];

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your store.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          {stats.map((stat) => {
            const body = (
              <>
                <div className={`w-11 h-11 mb-4 flex items-center justify-center bg-${stat.color}-100 text-${stat.color}-700 rounded-lg`}>
                  <i className={`${stat.icon} text-2xl`} aria-hidden="true"></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1 tabular-nums">{stat.value}</h3>
                <p className="text-gray-900 text-sm font-medium">{stat.title}</p>
                <p className="text-gray-500 text-xs mt-1">{stat.hint}</p>
              </>
            );
            const cls = 'block bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow';
            return stat.href
              ? <Link key={stat.title} href={stat.href} className={cls}>{body}</Link>
              : <div key={stat.title} className={cls}>{body}</div>;
          })}
        </div>

        {/* Revenue Chart & Quick Actions */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Revenue Trend</h2>
              <select
                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-gray-600 focus:border-gray-600 block p-2"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as '7days' | '30days')}
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#171717" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#171717" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `₵${value}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`₵${(value as number)?.toFixed(2) ?? '0.00'}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#171717" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/admin/products/new" className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-50 text-gray-700 hover:text-gray-900 rounded-lg transition-colors group">
                <div className="flex items-center font-medium">
                  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-3 group-hover:bg-gray-100 transition-colors shadow-sm">
                    <i className="ri-add-line"></i>
                  </span>
                  Add Product
                </div>
                <i className="ri-arrow-right-line"></i>
              </Link>
              <Link href="/admin/pos" className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-50 text-gray-700 hover:text-gray-900 rounded-lg transition-colors group">
                <div className="flex items-center font-medium">
                  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-3 group-hover:bg-gray-100 transition-colors shadow-sm">
                    <i className="ri-computer-line"></i>
                  </span>
                  Open POS
                </div>
                <i className="ri-arrow-right-line"></i>
              </Link>
              <Link href="/admin/orders" className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-50 text-gray-700 hover:text-gray-900 rounded-lg transition-colors group">
                <div className="flex items-center font-medium">
                  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-3 group-hover:bg-gray-100 transition-colors shadow-sm">
                    <i className="ri-file-list-line"></i>
                  </span>
                  Manage Orders
                </div>
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Orders</h2>
              <Link href="/admin/orders" className="text-gray-900 hover:text-gray-800 font-medium text-sm whitespace-nowrap cursor-pointer">
                View All <i className="ri-arrow-right-line ml-1"></i>
              </Link>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              {recentOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent orders.</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4">
                          <Link href={`/admin/orders/${order.id}`} className="text-gray-900 hover:text-gray-800 font-medium whitespace-nowrap cursor-pointer">
                            {order.displayId}
                          </Link>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-medium text-gray-900 whitespace-nowrap">{order.customer}</p>
                          <p className="text-sm text-gray-500">{order.email}</p>
                        </td>
                        <td className="py-4 px-4 text-gray-700 whitespace-nowrap">{order.date}</td>
                        <td className="py-4 px-4 font-semibold text-gray-900 whitespace-nowrap">₵ {order.total.toFixed(2)}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[order.status] || 'bg-gray-100'}`}>
                            {order.status === 'shipped' ? 'Packaged' : order.status === 'dispatched_to_rider' ? 'Dispatched To Rider' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Low Stock Alert</h2>
              {lowStockProducts.length === 0 ? (
                <p className="text-gray-500">Inventory looks good!</p>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate pr-2">{product.name}</p>
                        <p className="text-xs text-gray-600 mt-1">Stock: {product.stock} units</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${product.status === 'critical' ? 'bg-red-100 text-brand-brown' : 'bg-brand-cream text-brand-brown'
                        }`}>
                        {product.status === 'critical' ? 'Critical' : 'Low'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/admin/products?filter=low-stock" className="block text-center mt-4 text-gray-900 hover:text-gray-800 font-medium text-sm whitespace-nowrap cursor-pointer">
                View All Products <i className="ri-arrow-right-line ml-1"></i>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Best sellers</h2>
            <Link href="/admin/products" className="text-gray-900 hover:text-gray-800 font-medium text-sm whitespace-nowrap cursor-pointer">
              View All <i className="ri-arrow-right-line ml-1"></i>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {topProducts.map((product) => (
              <div key={product.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                <p className="text-sm text-gray-600">{product.sales} sold · ₵ {Number(product.revenue || 0).toFixed(2)}</p>
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Stock: {product.stock}</span>
                  <Link href={`/admin/products/${product.id}`} className="text-gray-900 hover:text-gray-800 text-sm font-medium whitespace-nowrap cursor-pointer">
                    Edit <i className="ri-arrow-right-line ml-1"></i>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
