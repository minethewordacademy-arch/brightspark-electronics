'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  shop_id: string;
  shop: { name: string }[] | null;
}

interface RawExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  shop_id: string;
  shop: { name: string }[] | null;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userShopId, setUserShopId] = useState<string | null>(null);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [filterShopId, setFilterShopId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    shop_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Fetch user role and shop
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role, shop_id')
        .eq('id', user.id)
        .single();
      const role = profile?.role || 'employee';
      setUserRole(role);
      if (profile?.shop_id) setUserShopId(profile.shop_id);
      if (role === 'admin') {
        const { data: shopsData } = await supabase.from('shops').select('id, name');
        if (shopsData) setShops(shopsData);
      }
    };
    fetchUser();
  }, [router]);

  // Fetch expenses based on filters
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('expenses').select(`
      id,
      description,
      amount,
      category,
      date,
      shop_id,
      shop:shop_id ( name )
    `);

    if (userRole === 'admin') {
      if (filterShopId && filterShopId !== '') {
        query = query.eq('shop_id', filterShopId);
      }
    } else {
      if (userShopId) {
        query = query.eq('shop_id', userShopId);
      }
    }
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    if (categoryFilter && categoryFilter !== '') query = query.eq('category', categoryFilter);

    const { data, error } = await query.order('date', { ascending: false });
    if (error) {
      console.error('Expenses fetch error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    } else {
      const typedData = (data as unknown as RawExpense[]) || [];
      setExpenses(typedData);
      const uniqueCategories = [...new Set(typedData.map(e => e.category).filter(Boolean))];
      setCategories(uniqueCategories as string[]);
    }
    setLoading(false);
  }, [userRole, filterShopId, userShopId, startDate, endDate, categoryFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExpenses();
  }, [fetchExpenses]);

  const handleAdd = () => {
    // For employees, ensure they have a shop_id; otherwise show error.
    if (userRole !== 'admin' && !userShopId) {
      setError('Your account is not linked to any shop. Please contact admin.');
      return;
    }
    setEditingExpense(null);
    setFormData({
      description: '',
      amount: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
      shop_id: userRole === 'admin' ? '' : (userShopId || ''),
    });
    setIsModalOpen(true);
    setError(''); // clear any previous error
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category || '',
      date: expense.date,
      shop_id: expense.shop_id,
    });
    setIsModalOpen(true);
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchExpenses();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const expenseData = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      category: formData.category || null,
      date: formData.date,
      shop_id: formData.shop_id,
    };

    let result;
    if (editingExpense) {
      result = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', editingExpense.id);
    } else {
      result = await supabase.from('expenses').insert([expenseData]);
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      setIsModalOpen(false);
      fetchExpenses();
    }
    setSubmitting(false);
  };

  const shopTotals = () => {
    if (userRole !== 'admin') return null;
    const totals: Record<string, number> = {};
    expenses.forEach(exp => {
      const shopName = exp.shop?.[0]?.name || exp.shop_id;
      totals[shopName] = (totals[shopName] || 0) + exp.amount;
    });
    return totals;
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <button
          onClick={handleAdd}
          className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
        >
          + Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-end bg-white dark:bg-gray-800 p-4 rounded shadow">
        {userRole === 'admin' && shops.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Shop</label>
            <select
              value={filterShopId}
              onChange={(e) => setFilterShopId(e.target.value)}
              className="border p-2 rounded dark:bg-gray-700"
            >
              <option value="">All Shops</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border p-2 rounded dark:bg-gray-700"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border p-2 rounded dark:bg-gray-700"
          />
        </div>
        {categories.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border p-2 rounded dark:bg-gray-700"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Shop Summary Cards (Admin only) */}
      {userRole === 'admin' && shopTotals() && Object.keys(shopTotals()!).length > 0 && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(shopTotals()!).map(([shop, total], idx) => {
            const bgColors = ['bg-blue-50 dark:bg-blue-900/20', 'bg-green-50 dark:bg-green-900/20', 'bg-purple-50 dark:bg-purple-900/20'];
            const borderColors = ['border-blue-200 dark:border-blue-800', 'border-green-200 dark:border-green-800', 'border-purple-200 dark:border-purple-800'];
            const colorIndex = idx % bgColors.length;
            return (
              <div key={shop} className={`p-4 rounded-lg shadow border ${bgColors[colorIndex]} ${borderColors[colorIndex]}`}>
                <h3 className="font-semibold text-lg">{shop}</h3>
                <p className="text-2xl font-bold">KES {total.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Expenses Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
        <table className="min-w-full">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Amount (KES)</th>
              {userRole === 'admin' && <th className="px-4 py-2 text-left">Shop</th>}
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={userRole === 'admin' ? 6 : 5} className="px-4 py-4 text-center text-gray-500">
                  No expenses found
                </td>
              </tr>
            ) : (
              expenses.map(exp => {
                const shopName = exp.shop?.[0]?.name || exp.shop_id;
                return (
                  <tr key={exp.id} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2">{new Date(exp.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2">{exp.description}</td>
                    <td className="px-4 py-2">{exp.category || '-'}</td>
                    <td className="px-4 py-2">KES {exp.amount.toLocaleString()}</td>
                    {userRole === 'admin' && <td className="px-4 py-2">{shopName}</td>}
                    <td className="px-4 py-2">
                      <button
                        onClick={() => handleEdit(exp)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="p-4 text-right font-bold text-lg border-t">
          Total Expenses: KES {totalExpenses.toLocaleString()}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border p-2 rounded dark:bg-gray-700"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Amount (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full border p-2 rounded dark:bg-gray-700"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Rent, Salary, Utilities"
                  className="w-full border p-2 rounded dark:bg-gray-700"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full border p-2 rounded dark:bg-gray-700"
                  required
                />
              </div>
              {userRole === 'admin' && (
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Shop</label>
                  <select
                    value={formData.shop_id}
                    onChange={(e) => setFormData({ ...formData, shop_id: e.target.value })}
                    className="w-full border p-2 rounded dark:bg-gray-700"
                    required
                  >
                    <option value="">Select shop</option>
                    {shops.map(shop => (
                      <option key={shop.id} value={shop.id}>{shop.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}