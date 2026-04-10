import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-coop-cream flex items-center justify-center">
      <div className="text-center section-padding">
        <p className="font-display text-9xl font-semibold text-coop-dark/10 mb-4">404</p>
        <h1 className="font-display text-3xl font-semibold text-coop-dark mb-3">
          Page not found
        </h1>
        <p className="text-coop-muted mb-8 max-w-sm mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-coop-dark text-coop-cream text-sm font-medium hover:bg-coop-green transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
