'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  sku: string;
  selling_price: number;
  current_stock: number;
}

interface CartItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
}

interface SaleRecord {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  sold_at: string;
  payment_method: string;
}

interface RawSale {
  id: string;
  quantity: number;
  selling_price_at_time: number;
  total_amount: number;
  sold_at: string;
  payment_method: string;
  products: { name: string } | null;
}

export default function SalesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'till'>('cash');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [todaysSales, setTodaysSales] = useState<SaleRecord[]>([]);
  const [todaysTotal, setTodaysTotal] = useState(0);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const router = useRouter();

  const fetchTodaysSales = async (userId: string) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        quantity,
        selling_price_at_time,
        total_amount,
        sold_at,
        payment_method,
        products ( name )
      `)
      .eq('sold_by', userId)
      .gte('sold_at', startOfDay.toISOString());
    if (!error && data) {
      const formatted = (data as unknown as RawSale[]).map((sale) => ({
        id: sale.id,
        product_name: sale.products?.name || 'Unknown',
        quantity: sale.quantity,
        price: sale.selling_price_at_time,
        total: sale.total_amount,
        sold_at: sale.sold_at,
        payment_method: sale.payment_method || 'cash',
      }));
      setTodaysSales(formatted);
      const total = formatted.reduce((sum, s) => sum + s.total, 0);
      setTodaysTotal(total);
    }
  };

  useEffect(() => {
    const fetchRole = async () => {
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
      if (role === 'admin') {
        setMessage({ type: 'error', text: 'Admin accounts cannot record sales. Use the Sales Report page to view sales.' });
      } else {
        fetchTodaysSales(user.id);
      }
    };
    fetchRole();
  }, [router]);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, selling_price, current_stock');
      if (error) {
        console.error(error);
        setMessage({ type: 'error', text: 'Failed to load products' });
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const addToCart = () => {
    if (!selectedProductId || quantity < 1) {
      setMessage({ type: 'error', text: 'Select a product and enter quantity' });
      return;
    }
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    if (quantity > product.current_stock) {
      setMessage({ type: 'error', text: `Only ${product.current_stock} in stock` });
      return;
    }
    const price = customPrice !== null ? customPrice : product.selling_price;
    const existingIndex = cart.findIndex(item => item.product_id === selectedProductId && item.price === price);
    if (existingIndex !== -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += quantity;
      setCart(newCart);
    } else {
      setCart([...cart, {
        product_id: selectedProductId,
        name: product.name,
        quantity,
        price,
      }]);
    }
    setSelectedProductId('');
    setQuantity(1);
    setCustomPrice(null);
    setMessage(null);
  };

  const updateCartItem = (index: number, newQuantity: number) => {
    const newCart = [...cart];
    if (newQuantity <= 0) {
      newCart.splice(index, 1);
    } else {
      newCart[index].quantity = newQuantity;
    }
    setCart(newCart);
  };

  const completeSale = async () => {
    if (cart.length === 0) {
      setMessage({ type: 'error', text: 'Cart is empty' });
      return;
    }
    setSubmitting(true);
    setMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage({ type: 'error', text: 'User not authenticated' });
      setSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('shop_id')
      .eq('id', user.id)
      .single();
    if (profileError || !profile?.shop_id) {
      setMessage({ type: 'error', text: 'Could not determine your shop. Please contact admin.' });
      setSubmitting(false);
      return;
    }
    const shopId = profile.shop_id;

    const errors: string[] = [];
    for (const item of cart) {
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', item.product_id)
        .single();
      if (fetchError || !product) {
        errors.push(`Failed to fetch stock for ${item.name}`);
        continue;
      }
      if (product.current_stock < item.quantity) {
        errors.push(`Insufficient stock for ${item.name}. Available: ${product.current_stock}`);
        continue;
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({ current_stock: product.current_stock - item.quantity })
        .eq('id', item.product_id);
      if (updateError) {
        errors.push(`Failed to update stock for ${item.name}`);
        continue;
      }

      const { error: insertError } = await supabase
        .from('sales')
        .insert({
          product_id: item.product_id,
          quantity: item.quantity,
          selling_price_at_time: item.price,
          total_amount: item.price * item.quantity,
          shop_id: shopId,
          sold_by: user.id,
          sold_at: new Date(),
          payment_method: paymentMethod,
        });
      if (insertError) {
        errors.push(`Failed to record sale for ${item.name}`);
      }
    }

    if (errors.length > 0) {
      setMessage({ type: 'error', text: errors.join('. ') });
    } else {
      setMessage({ type: 'success', text: 'Sale completed successfully!' });
      setCart([]);
      const { data } = await supabase.from('products').select('id, name, sku, selling_price, current_stock');
      if (data) setProducts(data);
      await fetchTodaysSales(user.id);
    }
    setSubmitting(false);
  };

  const selectProduct = (product: Product) => {
    setSelectedProductId(product.id);
    setProductSearchTerm('');
  };

  if (loading) return <div className="p-6">Loading...</div>;

  if (userRole === 'admin') {
    return (
      <div className="p-6">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          ⚠️ Admin accounts cannot record sales. Please go to <strong>Sales Report</strong> to view all sales.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Sticky top section */}
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 py-2">
        <Link href="/dashboard" className="text-blue-600 hover:underline text-sm inline-block mb-2">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold mb-4">Record Sales</h1>

        {message && (
          <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Add item section with searchable product list */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
            <h2 className="text-xl font-semibold mb-4">Add Item</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Search Product</label>
                <input
                  type="text"
                  placeholder="🔍 Type name or SKU..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="w-full border p-2 rounded dark:bg-gray-700"
                />
              </div>

              {productSearchTerm && (
                <div className="max-h-60 overflow-y-auto border rounded p-2 space-y-2">
                  {filteredProducts.length === 0 ? (
                    <p className="text-gray-500 text-sm">No products found.</p>
                  ) : (
                    filteredProducts.map(product => (
                      <div
                        key={product.id}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer border"
                        onClick={() => selectProduct(product)}
                      >
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          SKU: {product.sku} | Stock: {product.current_stock} | Price: KES {product.selling_price}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {selectedProduct && (
                <div className="mt-4 p-3 border rounded bg-gray-50 dark:bg-gray-700">
                  <p className="font-medium">Selected: {selectedProduct.name}</p>
                  <p className="text-sm">SKU: {selectedProduct.sku} | Stock: {selectedProduct.current_stock}</p>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedProduct.current_stock}
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                      className="w-full border p-2 rounded dark:bg-gray-700"
                    />
                  </div>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">Selling Price (KES)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={customPrice !== null ? customPrice : selectedProduct.selling_price}
                      onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                      className="w-full border p-2 rounded dark:bg-gray-700"
                    />
                    <p className="text-xs text-gray-500 mt-1">Default: KES {selectedProduct.selling_price}</p>
                  </div>
                  <button
                    onClick={addToCart}
                    className="w-full mt-3 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  >
                    Add to Cart
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cart and payment method */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
            <h2 className="text-xl font-semibold mb-4">Cart</h2>
            {cart.length === 0 ? (
              <p className="text-gray-500">No items added</p>
            ) : (
              <>
                <ul className="divide-y divide-gray-200 dark:divide-gray-700 mb-4">
                  {cart.map((item, idx) => (
                    <li key={idx} className="py-2 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.quantity} × KES {item.price} = KES {item.quantity * item.price}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateCartItem(idx, parseInt(e.target.value) || 0)}
                          className="w-20 border p-1 rounded dark:bg-gray-700"
                        />
                        <button
                          onClick={() => updateCartItem(idx, 0)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t pt-3">
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-2">Payment Method</label>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="cash"
                          checked={paymentMethod === 'cash'}
                          onChange={() => setPaymentMethod('cash')}
                          className="mr-2"
                        />
                        💵 Cash
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          value="till"
                          checked={paymentMethod === 'till'}
                          onChange={() => setPaymentMethod('till')}
                          className="mr-2"
                        />
                        📱 Till (M-PESA)
                      </label>
                    </div>
                  </div>
                  <p className="text-right font-bold text-lg">
                    Total: KES {cart.reduce((sum, item) => sum + item.quantity * item.price, 0)}
                  </p>
                  <button
                    onClick={completeSale}
                    disabled={submitting}
                    className="w-full mt-3 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? 'Processing...' : 'Complete Sale'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Today's Sales Summary */}
      <div className="mt-8 bg-white dark:bg-gray-800 p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Today&apos;s Sales (Your Records)</h2>
        {todaysSales.length === 0 ? (
          <p className="text-gray-500">No sales recorded today.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Product</th>
                    <th className="text-left">Qty</th>
                    <th className="text-left">Unit Price</th>
                    <th className="text-left">Total</th>
                    <th className="text-left">Payment</th>
                    <th className="text-left">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {todaysSales.map(sale => (
                    <tr key={sale.id} className="border-b">
                      <td className="py-1">{sale.product_name}</td>
                      <td className="py-1">{sale.quantity}</td>
                      <td className="py-1">KES {sale.price}</td>
                      <td className="py-1">KES {sale.total}</td>
                      <td className="py-1">{sale.payment_method === 'cash' ? '💵 Cash' : '📱 Till'}</td>
                      <td className="py-1">{new Date(sale.sold_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-right font-bold mt-3">
              Total Today: KES {todaysTotal}
            </div>
          </>
        )}
      </div>
    </div>
  );
}