import { Suspense, lazy } from 'react';
import { Route, createRoutesFromElements, RouterProvider, createBrowserRouter } from 'react-router-dom';
import NetflixHome from './pages/Home/NetflixHome';
import NetflixShow from './pages/NetflixShow/NetflixShow';
import SignUpPage from './pages/SignUp/SignUpPage';
import SignInPage from './pages/SignIn/SignInPage';
import ForgotPasswordPage from './pages/ForgotPassword/ForgotPasswordPage';
import BrowsePage from './pages/Browse/BrowsePage';
import ProfilePage from './pages/Profile/ProfilePage';
import TVShowsPage from './pages/Browse/TVShowsPage';
import MoviesPage from './pages/Browse/MoviesPage';
import NewPopularPage from './pages/Browse/NewPopularPage';
import MyListPage from './pages/Browse/MyListPage';
import PlansPage from './pages/Plans/PlansPage';
import PaymentPage from './pages/Payment/PaymentPage';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { SupabaseProvider } from './context/SupabaseProvider';

const Loading = () => (
  <div className="flex justify-center items-center h-screen bg-black">
    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-red-600"></div>
  </div>
);

function App() {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/" element={<NetflixHome />} />
        <Route path="/netflix-show" element={<NetflixShow />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route path="/profile" element={
          <Suspense fallback={<Loading />}><ProtectedRoute><ProfilePage /></ProtectedRoute></Suspense>
        } />
        <Route path="/browse" element={
          <Suspense fallback={<Loading />}><ProtectedRoute><BrowsePage /></ProtectedRoute></Suspense>
        } />
        <Route path="/browse/tv-shows" element={
          <Suspense fallback={<Loading />}><ProtectedRoute><TVShowsPage /></ProtectedRoute></Suspense>
        } />
        <Route path="/browse/movies" element={
          <Suspense fallback={<Loading />}><ProtectedRoute><MoviesPage /></ProtectedRoute></Suspense>
        } />
        <Route path="/browse/new-popular" element={
          <Suspense fallback={<Loading />}><ProtectedRoute><NewPopularPage /></ProtectedRoute></Suspense>
        } />
        <Route path="/browse/my-list" element={
          <Suspense fallback={<Loading />}><ProtectedRoute><MyListPage /></ProtectedRoute></Suspense>
        } />

        {/* Payment Auth feature */}
        <Route path="/plans" element={
          <Suspense fallback={<Loading />}><ProtectedRoute><PlansPage /></ProtectedRoute></Suspense>
        } />
        <Route path="/payment/:transactionId" element={
          <Suspense fallback={<Loading />}><ProtectedRoute><PaymentPage /></ProtectedRoute></Suspense>
        } />
      </>
    ),
    {
      future: { v7_normalizeFormMethod: true }
    }
  );

  return (
    <SupabaseProvider>
      <AuthProvider>
        <Toaster position="top-center" />
        <RouterProvider router={router} />
      </AuthProvider>
    </SupabaseProvider>
  );
}

export default App;
