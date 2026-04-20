//
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-orange-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        {/* Hero Section */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative h-20 w-20 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center shadow-sm">
              <Image
                src="/logo.jpeg"
                alt="BrightSpark Electronics Logo" 
                fill
                sizes="(max-width: 768px) 48px, 64px"
                className="object-contain p-2"
              />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            BrightSpark{" "}
            <span className="text-orange-600 dark:text-orange-400">
              Electronics
            </span>
          </h1>
          <p className="mt-4 text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Smart inventory & sales management for your electronic shops. Track
            stock, manage sales, and grow your business.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-orange-600 hover:bg-orange-700 transition"
            >
              Get Started
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-full shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Learn More
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div
          id="features"
          className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 text-center">
            <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📦</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Real‑time Stock
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Track inventory across multiple shops. Low stock alerts keep you
              ahead.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 text-center">
            <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">💰</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Sales & Expenses
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Record daily sales, track expenses, and see your net profit
              instantly.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 text-center">
            <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Monthly Reports
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Generate reports, calculate tithe, and export data for accounting.
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-24 text-center bg-orange-50 dark:bg-gray-800/50 rounded-3xl py-12 px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Ready to power up your electronics business now?
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
            Join BrightSpark Electronics and manage your shops smarter.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-orange-600 hover:bg-orange-700 transition"
            >
              Sign In / Create Account
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 pt-8">
          <p>
            © {new Date().getFullYear()} BrightSpark Electronics. All rights
            reserved.
          </p>
          <p className="mt-1">
            Powered by{" "}
            <a
              href="mailto:maogastdevhub@gmail.com"
              className="font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition"
            >
              Maogast Softworks Limited
            </a>
            <span className="mx-1">—</span>
            <span className="text-xs">📞 0768564533</span>
          </p>
        </footer>
      </div>
    </div>
  );
}