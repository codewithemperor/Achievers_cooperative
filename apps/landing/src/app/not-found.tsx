import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background-50 flex items-center justify-center">
      <div className="text-center section-padding">
        <p className="font-display text-9xl font-semibold text-text-900/10 mb-4">404</p>
        <h1 className="font-display text-3xl font-semibold text-text-900 mb-3">
          Page not found
        </h1>
        <p className="text-text-400 mb-8 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-900 text-background-50 text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
