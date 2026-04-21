'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  shop_id: string;
  shops: { name: string } | null;
}

interface RawExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  shop_id: string;
  shops: { name: string } | null;
}

interface CartExpense {
  description: string;
  amount: number;
  category: string;
  date: string;
  shop_id: string;
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

  // Cart state
  const [expenseCart, setExpenseCart] = useState<CartExpense[]>([]);
  const [cartFormData, setCartFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    shop_id: '',
  });
  const [cartError, setCartError] = useState('');

  // Modal for editing existing expense
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

  // Confirmation modal for submitting cart
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
        setCartFormData(prev => ({ ...prev, shop_id: '' }));
      } else {
        setCartFormData(prev => ({ ...prev, shop_id: userShopId || '' }));
      }
    };
    fetchUser();
  }, [router, userShopId]);

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
      shops:shop_id ( name )
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

  const addToCart = () => {
    if (!cartFormData.description || !cartFormData.amount) {
      setCartError('Description and amount are required');
      return;
    }
    const amountNum = parseFloat(cartFormData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setCartError('Amount must be a positive number');
      return;
    }
    let shopIdToUse = cartFormData.shop_id;
    if (userRole === 'admin') {
      if (!shopIdToUse || shopIdToUse === '') {
        setCartError('Please select a shop');
        return;
      }
    } else {
      if (!userShopId) {
        setCartError('Your account is not linked to a shop. Contact admin.');
        return;
      }
      shopIdToUse = userShopId;
    }
    setCartError('');
    setExpenseCart([
      ...expenseCart,
      {
        description: cartFormData.description,
        amount: amountNum,
        category: cartFormData.category || '',
        date: cartFormData.date,
        shop_id: shopIdToUse,
      },
    ]);
    // Reset form
    setCartFormData({
      description: '',
      amount: '',
      category: '',
      date: cartFormData.date,
      shop_id: userRole === 'admin' ? '' : (userShopId || ''),
    });
  };

  const removeFromCart = (index: number) => {
    const newCart = [...expenseCart];
    newCart.splice(index, 1);
    setExpenseCart(newCart);
  };

  const submitAllExpenses = async () => {
    if (expenseCart.length === 0) return;
    const invalidItems = expenseCart.filter(item => !item.shop_id);
    if (invalidItems.length > 0) {
      alert(`Please ensure all items have a shop selected. Invalid items: ${invalidItems.map(i => i.description).join(', ')}`);
      return;
    }
    setSubmitting(true);
    const errors: string[] = [];
    for (const item of expenseCart) {
      const { error } = await supabase.from('expenses').insert({
        description: item.description,
        amount: item.amount,
        category: item.category || null,
        date: item.date,
        shop_id: item.shop_id,
      });
      if (error) errors.push(`${item.description}: ${error.message}`);
    }
    if (errors.length > 0) {
      alert(`Some expenses failed:\n${errors.join('\n')}`);
    } else {
      alert(`${expenseCart.length} expense(s) added successfully!`);
      setExpenseCart([]);
      fetchExpenses();
    }
    setSubmitting(false);
    setShowConfirmModal(false);
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

  const handleUpdate = async (e: React.FormEvent) => {
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

    const { error } = await supabase
      .from('expenses')
      .update(expenseData)
      .eq('id', editingExpense!.id);

    if (error) {
      setError(error.message);
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
      const shopName = exp.shops?.name || exp.shop_id;
      totals[shopName] = (totals[shopName] || 0) + exp.amount;
    });
    return totals;
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      {/* Sticky header container */}
      <div className="sticky top-0 z-10 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm -mx-6 px-6 pt-2 pb-4 mb-4 rounded-b-lg shadow-sm">
        <Link href="/dashboard" className="text-blue-600 hover:underline text-sm inline-block mb-2">
          ← Back to Dashboard
        </Link>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Expenses</h1>
        </div>

        {/* Cart Section */}
        <div className="mb-8 bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-4">📋 Add Multiple Expenses (Cart)</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                type="text"
                value={cartFormData.description}
                onChange={(e) => setCartFormData({ ...cartFormData, description: e.target.value })}
                className="w-full border p-2 rounded dark:bg-gray-700"
                placeholder="e.g., Rent, Electricity"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Amount (KES)</label>
              <input
                type="number"
                step="0.01"
                value={cartFormData.amount}
                onChange={(e) => setCartFormData({ ...cartFormData, amount: e.target.value })}
                className="w-full border p-2 rounded dark:bg-gray-700"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <input
                type="text"
                value={cartFormData.category}
                onChange={(e) => setCartFormData({ ...cartFormData, category: e.target.value })}
                className="w-full border p-2 rounded dark:bg-gray-700"
                placeholder="e.g., Utilities"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={cartFormData.date}
                onChange={(e) => setCartFormData({ ...cartFormData, date: e.target.value })}
                className="w-full border p-2 rounded dark:bg-gray-700"
              />
            </div>
            {userRole === 'admin' && shops.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-1">Shop</label>
                <select
                  value={cartFormData.shop_id}
                  onChange={(e) => setCartFormData({ ...cartFormData, shop_id: e.target.value })}
                  className="w-full border p-2 rounded dark:bg-gray-700"
                >
                  <option value="">Select shop</option>
                  {shops.map(shop => (
                    <option key={shop.id} value={shop.id}>{shop.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <button
                onClick={addToCart}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
              >
                + Add to Cart
              </button>
            </div>
          </div>
          {cartError && <p className="text-red-500 text-sm mt-2">{cartError}</p>}

          {expenseCart.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Cart Items ({expenseCart.length})</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-2 py-1 text-left">Description</th>
                      <th className="px-2 py-1 text-left">Amount</th>
                      <th className="px-2 py-1 text-left">Category</th>
                      <th className="px-2 py-1 text-left">Date</th>
                      {userRole === 'admin' && <th className="px-2 py-1 text-left">Shop</th>}
                      <th className="px-2 py-1 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseCart.map((item, idx) => {
                      const shopName = userRole === 'admin' ? shops.find(s => s.id === item.shop_id)?.name || item.shop_id : '';
                      return (
                        <tr key={idx} className="border-b">
                          <td className="px-2 py-1">{item.description}</td>
                          <td className="px-2 py-1">KES {item.amount}</td>
                          <td className="px-2 py-1">{item.category || '-'}</td>
                          <td className="px-2 py-1">{item.date}</td>
                          {userRole === 'admin' && <td className="px-2 py-1">{shopName}</td>}
                          <td className="px-2 py-1">
                            <button
                              onClick={() => removeFromCart(idx)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-right">
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Submit All ({expenseCart.length} expenses)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end bg-white dark:bg-gray-800 p-4 rounded shadow">
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

      {/* Expenses Table (existing expenses) */}
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
                const shopName = exp.shops?.name || exp.shop_id;
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

      {/* Edit Existing Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Expense</h2>
            <form onSubmit={handleUpdate}>
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

      {/* Confirmation Modal for submitting cart */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Confirm Submit</h2>
            <p className="mb-4">
              Are you sure you want to submit {expenseCart.length} expense(s)? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={submitAllExpenses}
                disabled={submitting}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                {submitting ? 'Submitting...' : 'Yes, Submit All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}