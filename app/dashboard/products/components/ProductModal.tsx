'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Product {
  id?: string;
  name: string;
  sku: string;
  buying_price: number;
  selling_price: number;
  current_stock: number;
  low_stock_threshold: number;
  shop_id: string;
}

interface ProductModalProps {
  product: Product | null;
  onClose: (refetch?: boolean) => void;
  userRole: string | null;
}

export default function ProductModal({ product, onClose, userRole }: ProductModalProps) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [buyingPrice, setBuyingPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [shopId, setShopId] = useState('');
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shopsLoading, setShopsLoading] = useState(true);

  // Pre-fill form when editing
  useEffect(() => {
    if (product) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(product.name || '');
       
      setSku(product.sku || '');
       
      setBuyingPrice(product.buying_price?.toString() || '');
       
      setSellingPrice(product.selling_price?.toString() || '');
       
      setCurrentStock(product.current_stock?.toString() || '');
       
      setLowStockThreshold(product.low_stock_threshold?.toString() || '');
       
      setShopId(product.shop_id || '');
    }
  }, [product]);

  // For admin: fetch all shops; for employee: get assigned shop
  useEffect(() => {
    if (userRole === 'admin') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShopsLoading(true);
      supabase
        .from('shops')
        .select('id, name')
        .then(({ data }) => {
          if (data) setShops(data);
          setShopsLoading(false);
        });
    } else {
      // employee: get their shop_id
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          const { data } = await supabase
            .from('user_profiles')
            .select('shop_id')
            .eq('id', user.id)
            .single();
          if (data?.shop_id) setShopId(data.shop_id);
        }
      });
      setShopsLoading(false);
    }
  }, [userRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const productData = {
      name,
      sku,
      buying_price: parseFloat(buyingPrice),
      selling_price: parseFloat(sellingPrice),
      current_stock: parseInt(currentStock, 10),
      low_stock_threshold: parseInt(lowStockThreshold, 10),
      shop_id: shopId,
    };

    let result;
    if (product?.id) {
      result = await supabase
        .from('products')
        .update(productData)
        .eq('id', product.id);
    } else {
      result = await supabase.from('products').insert([productData]);
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      onClose(true);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{product?.id ? 'Edit Product' : 'Add Product'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border p-2 rounded dark:bg-gray-700"
              required
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">SKU</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full border p-2 rounded dark:bg-gray-700"
              required
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Buying Price (KES)</label>
            <input
              type="number"
              step="0.01"
              value={buyingPrice}
              onChange={(e) => setBuyingPrice(e.target.value)}
              className="w-full border p-2 rounded dark:bg-gray-700"
              required
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Selling Price (KES)</label>
            <input
              type="number"
              step="0.01"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="w-full border p-2 rounded dark:bg-gray-700"
              required
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Current Stock</label>
            <input
              type="number"
              value={currentStock}
              onChange={(e) => setCurrentStock(e.target.value)}
              className="w-full border p-2 rounded dark:bg-gray-700"
              required
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
            <input
              type="number"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              className="w-full border p-2 rounded dark:bg-gray-700"
              required
            />
          </div>
          {userRole === 'admin' && (
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Shop</label>
              {shopsLoading ? (
                <div className="text-sm text-gray-500">Loading shops...</div>
              ) : (
                <select
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  className="w-full border p-2 rounded dark:bg-gray-700"
                  required
                >
                  <option value="">Select shop</option>
                  {shops.map(shop => (
                    <option key={shop.id} value={shop.id}>{shop.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}