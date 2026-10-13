import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from './ui/Spinner.jsx';

// Only logged-in users get through; others go to /login and come back afterwards.
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader label="Checking your session…" />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

// Login/register pages: logged-in users are sent to the dashboard instead.
export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader label="Checking your session…" />;
  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;
  return <Outlet />;
}
