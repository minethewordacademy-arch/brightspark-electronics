'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SaleReport {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  sold_at: string;
  shop_name: string;
  payment_method: string;
}

interface RawSaleData {
  id: string;
  quantity: number;
  selling_price_at_time: number;
  total_amount: number;
  sold_at: string;
  payment_method: string;
  products: { name: string } | null;
  shops: { name: string } | null;
}

export default function SalesReportPage() {
  const [sales, setSales] = useState<SaleReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredSales, setFilteredSales] = useState<SaleReport[]>([]);
  const router = useRouter();

  // Set the earliest allowed date (system start date)
  const minDate = '2026-03-04';

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const role = profile?.role || 'employee';
      setUserRole(role);
      if (role !== 'admin') {
        setSales([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          quantity,
          selling_price_at_time,
          total_amount,
          sold_at,
          payment_method,
          products:product_id ( name ),
          shops:shop_id ( name )
        `)
        .order('sold_at', { ascending: false });

      if (error) {
        console.error('Sales fetch error:', error);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const rawData = data as unknown as RawSaleData[];
        const formatted: SaleReport[] = rawData.map((sale) => ({
          id: sale.id,
          product_name: sale.products?.name || 'Unknown Product',
          quantity: sale.quantity,
          price: sale.selling_price_at_time,
          total: sale.total_amount,
          sold_at: sale.sold_at,
          shop_name: sale.shops?.name || 'Unknown Shop',
          payment_method: sale.payment_method || 'cash',
        }));
        setSales(formatted);
        setFilteredSales(formatted);
      }
      setLoading(false);
    };
    checkRole();
  }, [router]);

  const handleFilter = () => {
    if (!startDate && !endDate) {
      setFilteredSales(sales);
      return;
    }
    let filtered = [...sales];
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(s => new Date(s.sold_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(s => new Date(s.sold_at) <= end);
    }
    setFilteredSales(filtered);
  };

  // Global totals by payment method
  const cashTotal = filteredSales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + s.total, 0);
  const tillTotal = filteredSales.filter(s => s.payment_method === 'till').reduce((sum, s) => sum + s.total, 0);
  const totalSales = cashTotal + tillTotal;

  // Per‑shop totals by payment method
  const shopPaymentTotals = filteredSales.reduce((acc, sale) => {
    const shop = sale.shop_name;
    if (!acc[shop]) acc[shop] = { cash: 0, till: 0 };
    if (sale.payment_method === 'cash') acc[shop].cash += sale.total;
    else acc[shop].till += sale.total;
    return acc;
  }, {} as Record<string, { cash: number; till: number }>);

  if (loading) return <div className="p-6">Loading...</div>;

  if (userRole !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Access denied. Only administrators can view this page.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link href="/dashboard" className="text-blue-600 hover:underline text-sm inline-block mb-2">
        ← Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-6">Sales Report (All Shops)</h1>

      {/* Filter Bar */}
      <div className="mb-6 flex flex-wrap gap-4 items-end bg-white dark:bg-gray-800 p-4 rounded shadow">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={minDate}
            className="border p-2 rounded dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={minDate}
            className="border p-2 rounded dark:bg-gray-700"
          />
        </div>
        <div>
          <button
            onClick={handleFilter}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Global Payment Method Summary Cards */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg shadow border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <h3 className="font-semibold text-lg">💵 Cash Sales (All Shops)</h3>
          <p className="text-2xl font-bold">KES {cashTotal.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg shadow border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <h3 className="font-semibold text-lg">📱 Till (M-PESA) (All Shops)</h3>
          <p className="text-2xl font-bold">KES {tillTotal.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg shadow border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
          <h3 className="font-semibold text-lg">💰 Combined Total</h3>
          <p className="text-2xl font-bold">KES {totalSales.toLocaleString()}</p>
        </div>
      </div>

      {/* Per‑Shop Detailed Cards (Cash + Till) */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(shopPaymentTotals).map(([shop, totals], idx) => {
          const bgColors = ['bg-blue-50 dark:bg-blue-900/20', 'bg-green-50 dark:bg-green-900/20', 'bg-purple-50 dark:bg-purple-900/20'];
          const borderColors = ['border-blue-200 dark:border-blue-800', 'border-green-200 dark:border-green-800', 'border-purple-200 dark:border-purple-800'];
          const colorIndex = idx % bgColors.length;
          return (
            <div key={shop} className={`p-4 rounded-lg shadow border ${bgColors[colorIndex]} ${borderColors[colorIndex]}`}>
              <h3 className="font-semibold text-lg">{shop}</h3>
              <div className="mt-2 space-y-1">
                <p className="text-sm">💵 Cash: <span className="font-bold">KES {totals.cash.toLocaleString()}</span></p>
                <p className="text-sm">📱 Till: <span className="font-bold">KES {totals.till.toLocaleString()}</span></p>
                <p className="text-sm border-t pt-1 mt-1">💰 Total: <span className="font-bold">KES {(totals.cash + totals.till).toLocaleString()}</span></p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sales Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
        <table className="min-w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Product</th>
              <th className="px-4 py-2 text-left">Quantity</th>
              <th className="px-4 py-2 text-left">Unit Price (KES)</th>
              <th className="px-4 py-2 text-left">Total (KES)</th>
              <th className="px-4 py-2 text-left">Payment</th>
              <th className="px-4 py-2 text-left">Shop</th>
              <th className="px-4 py-2 text-left">Date/Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-gray-500">
                  No sales found
                </td>
              </tr>
            ) : (
              filteredSales.map(sale => (
                <tr key={sale.id} className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2">{sale.product_name}</td>
                  <td className="px-4 py-2">{sale.quantity}</td>
                  <td className="px-4 py-2">{sale.price}</td>
                  <td className="px-4 py-2">{sale.total}</td>
                  <td className="px-4 py-2">{sale.payment_method === 'cash' ? '💵 Cash' : '📱 Till'}</td>
                  <td className="px-4 py-2">{sale.shop_name}</td>
                  <td className="px-4 py-2">{new Date(sale.sold_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="p-4 text-right font-bold text-lg border-t">
          Combined Total: KES {totalSales.toLocaleString()}
        </div>
      </div>
    </div>
  );
}