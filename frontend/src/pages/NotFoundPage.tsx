import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-4xl font-extrabold text-brand-700">404</p>
      <p className="mt-2 text-slate-500">Page not found</p>
      <Link to="/" className="btn-primary mt-4">Go to Dashboard</Link>
    </div>
  );
}
