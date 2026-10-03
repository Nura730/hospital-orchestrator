import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * 404 Not Found page.
 */
export default function NotFoundPage() {
  return (
    <div className="page-enter min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        {/* Large 404 number */}
        <h1 className="text-8xl font-extrabold text-primary-500 tabular-nums">404</h1>

        <h2 className="mt-4 text-2xl font-semibold text-foreground">Page not found</h2>

        <p className="mt-3 text-muted-foreground leading-relaxed">
          The page you're looking for doesn't exist or you don't have permission to view it.
        </p>

        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-600 text-white font-medium
                     hover:bg-primary-700 transition-colors duration-200 focus:outline-none focus:ring-2
                     focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-background"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to home
        </Link>
      </div>
    </div>
  );
}
