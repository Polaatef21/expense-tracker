import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export function NotFoundPage() {
  return (
    <div className="page page--center">
      <EmptyState
        title="Page not found"
        action={
          <Link to="/" className="btn btn--primary btn--md">
            Go to the dashboard
          </Link>
        }
      >
        The page you are looking for doesn&apos;t exist or was moved.
      </EmptyState>
    </div>
  );
}
