'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface SaleRecord {
  total_amount: number;
  sold_at: string;
  shop_id: string;
}

interface ExpenseRecord {
  amount: number;
  date: string;
  shop_id: string;
}

interface Shop {
  id: string;
  name: string;
}

interface MonthlySummary {
  month: string;
  shop_name: string;
  sales: number;
  expenses: number;
  net: number;
  tithe: number;
}

// Define chart data point type
interface ChartDataPoint {
  period: string;
  sales: number;
  expenses: number;
  net: number;
}

export default function ReportPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [summaryData, setSummaryData] = useState<MonthlySummary[]>([]);
  const [totals, setTotals] = useState({ sales: 0, expenses: 0, net: 0, tithe: 0 });
  const router = useRouter();

  // Check admin role
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
      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setUserRole('admin');
      const { data: shopsData } = await supabase.from('shops').select('id, name');
      if (shopsData) setShops(shopsData);
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 12);
      setDateRange({
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      });
    };
    checkRole();
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let salesQuery = supabase
      .from('sales')
      .select('total_amount, sold_at, shop_id')
      .gte('sold_at', dateRange.start)
      .lte('sold_at', `${dateRange.end}T23:59:59`);
    if (selectedShopId) salesQuery = salesQuery.eq('shop_id', selectedShopId);
    const { data: salesData } = await salesQuery;

    let expensesQuery = supabase
      .from('expenses')
      .select('amount, date, shop_id')
      .gte('date', dateRange.start)
      .lte('date', dateRange.end);
    if (selectedShopId) expensesQuery = expensesQuery.eq('shop_id', selectedShopId);
    const { data: expensesData } = await expensesQuery;

    const sales = (salesData as SaleRecord[]) || [];
    const expenses = (expensesData as ExpenseRecord[]) || [];

    if (period === 'weekly') {
      const weekMap = new Map<string, number>();
      sales.forEach(sale => {
        const date = new Date(sale.sold_at);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
        const weekKey = weekStart.toISOString().split('T')[0];
        weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + sale.total_amount);
      });
      const expenseWeekMap = new Map<string, number>();
      expenses.forEach(exp => {
        const date = new Date(exp.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
        const weekKey = weekStart.toISOString().split('T')[0];
        expenseWeekMap.set(weekKey, (expenseWeekMap.get(weekKey) || 0) + exp.amount);
      });
      const weeks = [...new Set([...weekMap.keys(), ...expenseWeekMap.keys()])].sort();
      const data: ChartDataPoint[] = weeks.map(week => ({
        period: week,
        sales: weekMap.get(week) || 0,
        expenses: expenseWeekMap.get(week) || 0,
        net: (weekMap.get(week) || 0) - (expenseWeekMap.get(week) || 0),
      }));
      setChartData(data);
    } else if (period === 'monthly') {
      const monthMap = new Map<string, number>();
      sales.forEach(sale => {
        const monthKey = sale.sold_at.substring(0, 7);
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + sale.total_amount);
      });
      const expenseMonthMap = new Map<string, number>();
      expenses.forEach(exp => {
        const monthKey = exp.date.substring(0, 7);
        expenseMonthMap.set(monthKey, (expenseMonthMap.get(monthKey) || 0) + exp.amount);
      });
      const months = [...new Set([...monthMap.keys(), ...expenseMonthMap.keys()])].sort();
      const data: ChartDataPoint[] = months.map(month => ({
        period: month,
        sales: monthMap.get(month) || 0,
        expenses: expenseMonthMap.get(month) || 0,
        net: (monthMap.get(month) || 0) - (expenseMonthMap.get(month) || 0),
      }));
      setChartData(data);
    } else {
      const yearMap = new Map<string, number>();
      sales.forEach(sale => {
        const yearKey = sale.sold_at.substring(0, 4);
        yearMap.set(yearKey, (yearMap.get(yearKey) || 0) + sale.total_amount);
      });
      const expenseYearMap = new Map<string, number>();
      expenses.forEach(exp => {
        const yearKey = exp.date.substring(0, 4);
        expenseYearMap.set(yearKey, (expenseYearMap.get(yearKey) || 0) + exp.amount);
      });
      const years = [...new Set([...yearMap.keys(), ...expenseYearMap.keys()])].sort();
      const data: ChartDataPoint[] = years.map(year => ({
        period: year,
        sales: yearMap.get(year) || 0,
        expenses: expenseYearMap.get(year) || 0,
        net: (yearMap.get(year) || 0) - (expenseYearMap.get(year) || 0),
      }));
      setChartData(data);
    }

    // Prepare per‑shop monthly summary
    const shopSalesMap = new Map<string, Map<string, number>>();
    const shopExpensesMap = new Map<string, Map<string, number>>();

    sales.forEach(sale => {
      const month = sale.sold_at.substring(0, 7);
      if (!shopSalesMap.has(sale.shop_id)) shopSalesMap.set(sale.shop_id, new Map());
      const monthMap = shopSalesMap.get(sale.shop_id)!;
      monthMap.set(month, (monthMap.get(month) || 0) + sale.total_amount);
    });
    expenses.forEach(exp => {
      const month = exp.date.substring(0, 7);
      if (!shopExpensesMap.has(exp.shop_id)) shopExpensesMap.set(exp.shop_id, new Map());
      const monthMap = shopExpensesMap.get(exp.shop_id)!;
      monthMap.set(month, (monthMap.get(month) || 0) + exp.amount);
    });

    const allShops = selectedShopId ? shops.filter(s => s.id === selectedShopId) : shops;
    const allMonths = [...new Set([...Array.from(shopSalesMap.values()).flatMap(m => Array.from(m.keys())), ...Array.from(shopExpensesMap.values()).flatMap(m => Array.from(m.keys()))])].sort();

    const summary: MonthlySummary[] = [];
    let totalSales = 0, totalExpenses = 0, totalNet = 0, totalTithe = 0;
    for (const shop of allShops) {
      for (const month of allMonths) {
        const salesAmount = shopSalesMap.get(shop.id)?.get(month) || 0;
        const expensesAmount = shopExpensesMap.get(shop.id)?.get(month) || 0;
        const net = salesAmount - expensesAmount;
        const tithe = net * 0.1;
        totalSales += salesAmount;
        totalExpenses += expensesAmount;
        totalNet += net;
        totalTithe += tithe;
        summary.push({
          month,
          shop_name: shop.name,
          sales: salesAmount,
          expenses: expensesAmount,
          net,
          tithe,
        });
      }
    }
    setSummaryData(summary);
    setTotals({ sales: totalSales, expenses: totalExpenses, net: totalNet, tithe: totalTithe });
    setLoading(false);
  }, [selectedShopId, dateRange, period, shops]);

  useEffect(() => {
    if (userRole === 'admin' && dateRange.start && dateRange.end) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchData();
    }
  }, [userRole, dateRange, selectedShopId, period, fetchData]);

  if (loading) return <div className="p-6">Loading report...</div>;

  // Tooltip formatter with correct Recharts signature
  const formatTooltipValue = (
    value: number | string | readonly (number | string)[] | undefined,
  ) => {
    if (value === undefined) return 'KES 0';
    if (Array.isArray(value)) return `KES ${value[0] ?? 0}`;
    return `KES ${value.toLocaleString()}`;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Financial Report</h1>

      <div className="mb-6 flex flex-wrap gap-4 items-end bg-white dark:bg-gray-800 p-4 rounded shadow">
        <div>
          <label className="block text-sm font-medium mb-1">Shop</label>
          <select
            value={selectedShopId}
            onChange={(e) => setSelectedShopId(e.target.value)}
            className="border p-2 rounded dark:bg-gray-700"
          >
            <option value="">All Shops</option>
            {shops.map(shop => (
              <option key={shop.id} value={shop.id}>{shop.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="border p-2 rounded dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="border p-2 rounded dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'weekly' | 'monthly' | 'yearly')}
            className="border p-2 rounded dark:bg-gray-700"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg shadow border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-medium">Total Sales</h3>
          <p className="text-2xl font-bold">KES {totals.sales.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg shadow border border-red-200 dark:border-red-800">
          <h3 className="text-sm font-medium">Total Expenses</h3>
          <p className="text-2xl font-bold">KES {totals.expenses.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg shadow border border-green-200 dark:border-green-800">
          <h3 className="text-sm font-medium">Net Income</h3>
          <p className="text-2xl font-bold">KES {totals.net.toLocaleString()}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg shadow border border-purple-200 dark:border-purple-800">
          <h3 className="text-sm font-medium">Tithe (10%)</h3>
          <p className="text-2xl font-bold">KES {totals.tithe.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Sales vs Expenses ({period.charAt(0).toUpperCase() + period.slice(1)})</h2>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip formatter={formatTooltipValue} />
            <Legend />
            <Line type="monotone" dataKey="sales" stroke="#3b82f6" name="Sales" />
            <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" />
            <Line type="monotone" dataKey="net" stroke="#10b981" name="Net Income" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
        <table className="min-w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Month</th>
              <th className="px-4 py-2 text-left">Shop</th>
              <th className="px-4 py-2 text-right">Sales (KES)</th>
              <th className="px-4 py-2 text-right">Expenses (KES)</th>
              <th className="px-4 py-2 text-right">Net (KES)</th>
              <th className="px-4 py-2 text-right">Tithe (KES)</th>
            </tr>
          </thead>
          <tbody>
            {summaryData.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-4">No data</td></tr>
            ) : (
              summaryData.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-4 py-2">{row.month}</td>
                  <td className="px-4 py-2">{row.shop_name}</td>
                  <td className="px-4 py-2 text-right">{row.sales.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{row.expenses.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-medium">{row.net.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{row.tithe.toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}