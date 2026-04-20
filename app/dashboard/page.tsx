"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserAndRole = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error("User fetch error:", userError);
          router.push("/login");
          return;
        }
        setUser(user);

        const { data, error: profileError } = await supabase
          .from("user_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error("Profile fetch error:", profileError);
          setError("Could not fetch your user role. Please contact admin.");
        } else if (!data) {
          setError("User profile not found. Please contact admin.");
        } else {
          setRole(data.role);
        }
      } catch (err) {
        console.error("Unexpected error in dashboard:", err);
        setError("An unexpected error occurred. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndRole();
  }, [router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
      setError("Logout failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md w-full mb-4">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.jpeg"
            alt="BrightSpark Electronics Logo"
            width={40}
            height={40}
            className="rounded"
          />
          <h1 className="text-2xl font-bold">BrightSpark Electronics Dashboard</h1>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      <p className="mb-4">
        Welcome, <strong>{user?.email}</strong>! You are logged in as a{" "}
        <strong>{role || "unknown"}</strong>.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Link
          href="/dashboard/products"
          className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold">📦 Products & Stock</h2>
          <p className="text-gray-600 dark:text-gray-400">
            View all products, check stock levels, and manage inventory.
          </p>
        </Link>

        <Link
          href="/dashboard/sales"
          className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold">💰 Record Sales</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Record new sales (employees only).
          </p>
        </Link>

        <Link
          href="/dashboard/sales-report"
          className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold">📊 Sales Report</h2>
          <p className="text-gray-600 dark:text-gray-400">
            View all sales across shops (admin only).
          </p>
        </Link>

        <Link
          href="/dashboard/expenses"
          className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold">📝 Expenses</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Track daily expenses.
          </p>
        </Link>

        <Link
          href="/dashboard/report"
          className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition"
        >
          <h2 className="text-xl font-semibold">📊 Monthly Report</h2>
          <p className="text-gray-600 dark:text-gray-400">
            View net income, tithe, and charts.
          </p>
        </Link>
      </div>
    </div>
  );
}