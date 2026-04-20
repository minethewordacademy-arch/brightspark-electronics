"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProductModal from "./components/ProductModal";
import AddStockModal from "./components/AddStockModal";

interface Product {
  id: string;
  name: string;
  sku: string;
  buying_price: number;
  selling_price: number;
  current_stock: number;
  low_stock_threshold: number;
  shop_id: string;
  shop: { name: string }[] | null;
  sold_qty?: number;
}

interface SoldRecord {
  product_id: string;
  quantity: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [addStockProduct, setAddStockProduct] = useState<Product | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const router = useRouter();

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setUserRole(data?.role || "employee");
    };
    fetchUserRole();
  }, [router]);

  const fetchProductsAndSold = async () => {
    setLoading(true);
    const { data: productsData, error: productsError } = await supabase.from(
      "products",
    ).select(`
        id,
        name,
        sku,
        buying_price,
        selling_price,
        current_stock,
        low_stock_threshold,
        shop_id,
        shop:shop_id ( name )
      `);
    if (productsError) {
      console.error(productsError);
      setLoading(false);
      return;
    }

    const { data: soldData, error: soldError } = await supabase
      .from("sales")
      .select("product_id, quantity")
      .in(
        "product_id",
        (productsData || []).map((p) => p.id),
      );
    if (soldError) {
      console.error(soldError);
    }

    const soldMap: Record<string, number> = {};
    if (soldData) {
      (soldData as SoldRecord[]).forEach((sale) => {
        const pid = sale.product_id;
        soldMap[pid] = (soldMap[pid] || 0) + sale.quantity;
      });
    }

    const combined = (productsData || []).map((p) => ({
      ...p,
      sold_qty: soldMap[p.id] || 0,
    }));
    setProducts(combined);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProductsAndSold();
  }, []);

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleAddStock = (product: Product) => {
    setAddStockProduct(product);
  };

  const handleDeleteClick = (productId: string) => {
    setDeleteProductId(productId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteProductId) return;

    // Check if product has any sales
    const { count, error: countError } = await supabase
      .from("sales")
      .select("*", { count: "exact", head: true })
      .eq("product_id", deleteProductId);

    if (countError) {
      alert("Error checking sales: " + countError.message);
      setShowDeleteConfirm(false);
      setDeleteProductId(null);
      return;
    }

    if (count && count > 0) {
      alert(
        `Cannot delete this product because it has ${count} sales record(s). Consider archiving it instead.`,
      );
      setShowDeleteConfirm(false);
      setDeleteProductId(null);
      return;
    }

    // No sales, safe to delete
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", deleteProductId);

    if (error) {
      alert("Failed to delete product: " + error.message);
    } else {
      fetchProductsAndSold(); // refresh list
    }
    setShowDeleteConfirm(false);
    setDeleteProductId(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteProductId(null);
  };

  const handleModalClose = (refetch = false) => {
    setIsModalOpen(false);
    setEditingProduct(null);
    if (refetch) fetchProductsAndSold();
  };

  const handleAddStockClose = (refetch = false) => {
    setAddStockProduct(null);
    if (refetch) fetchProductsAndSold();
  };

  if (loading) return <div className="p-6">Loading products...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link
            href="/dashboard"
            className="text-blue-600 hover:underline text-sm mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Products & Stock</h1>
        </div>
        {userRole === "admin" && (
          <button
            onClick={handleAddProduct}
            className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
          >
            + Add Product
          </button>
        )}
      </div>

      {products.some((p) => p.current_stock <= p.low_stock_threshold) && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h2 className="font-semibold text-red-800 dark:text-red-300">
            ⚠️ Low Stock Alerts
          </h2>
          <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400">
            {products
              .filter((p) => p.current_stock <= p.low_stock_threshold)
              .map((p) => (
                <li key={p.id}>
                  {p.name} – only {p.current_stock} left (threshold:{" "}
                  {p.low_stock_threshold})
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">SKU</th>
              <th className="px-4 py-2 text-left">Buying Price</th>
              <th className="px-4 py-2 text-left">Selling Price</th>
              <th className="px-4 py-2 text-left">Original Stock</th>
              <th className="px-4 py-2 text-left">Sold</th>
              <th className="px-4 py-2 text-left">Current Stock</th>
              <th className="px-4 py-2 text-left">Threshold</th>
              {userRole === "admin" && (
                <th className="px-4 py-2 text-left">Shop</th>
              )}
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const isLowStock =
                product.current_stock <= product.low_stock_threshold;
              const shopName = product.shop?.[0]?.name || product.shop_id;
              const originalStock =
                (product.sold_qty || 0) + product.current_stock;
              return (
                <tr
                  key={product.id}
                  className={`border-b border-gray-200 dark:border-gray-700 ${
                    isLowStock ? "bg-red-50 dark:bg-red-900/20" : ""
                  }`}
                >
                  <td className="px-4 py-2">{product.name}</td>
                  <td className="px-4 py-2">{product.sku}</td>
                  <td className="px-4 py-2">KES {product.buying_price}</td>
                  <td className="px-4 py-2">KES {product.selling_price}</td>
                  <td className="px-4 py-2">{originalStock}</td>
                  <td className="px-4 py-2">{product.sold_qty || 0}</td>
                  <td className="px-4 py-2">{product.current_stock}</td>
                  <td className="px-4 py-2">{product.low_stock_threshold}</td>
                  {userRole === "admin" && (
                    <td className="px-4 py-2">{shopName}</td>
                  )}
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 mr-2"
                    >
                      Edit
                    </button>
                    {userRole === "admin" && (
                      <>
                        <button
                          onClick={() => handleAddStock(product)}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 mr-2"
                        >
                          Add Stock
                        </button>
                        <button
                          onClick={() => handleDeleteClick(product.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={handleModalClose}
          userRole={userRole}
        />
      )}

      {addStockProduct && (
        <AddStockModal
          product={addStockProduct}
          onClose={handleAddStockClose}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
            <p className="mb-4">
              Are you sure you want to delete this product? This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
