import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import BrowseNavbar from '../../components/Navbar/BrowseNavbar';

const ProfilePage: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen bg-black">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const sub = user.subscription;
  const planColors: Record<string, string> = {
    Basic: 'text-zinc-300',
    Standard: 'text-blue-400',
    Premium: 'text-red-400',
  };
  const planColor = sub ? (planColors[sub.planName] || 'text-green-400') : '';

  return (
    <div className="min-h-screen bg-black text-white">
      <BrowseNavbar />
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-2xl mx-auto bg-zinc-900 rounded-2xl shadow-lg p-8 border border-zinc-800">
          <h1 className="text-3xl font-bold mb-8 text-red-500">My Profile</h1>

          {/* Avatar + basic info */}
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-3xl font-bold flex-shrink-0">
              {(user.fullName || user.email)?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{user.fullName || 'Netflix User'}</h2>
              <p className="text-zinc-400">{user.email}</p>
              {user.createdAt && (
                <p className="text-zinc-500 text-sm mt-1">
                  Member since {new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          {/* Subscription section */}
          <div className="border-t border-zinc-700 pt-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">Subscription</h3>
            {sub ? (
              <div className="bg-zinc-800 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Plan</span>
                  <span className={`font-bold text-lg ${planColor}`}>{sub.planName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Amount</span>
                  <span className="font-semibold">₹{(sub.amountPaise / 100).toFixed(0)}/month</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Status</span>
                  <span className="text-green-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span> Active
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Activated</span>
                  <span className="text-zinc-300 text-sm">{new Date(sub.activatedAt).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="pt-2">
                  <Link to="/plans" className="text-sm text-red-400 hover:text-red-300 transition-colors">
                    Change plan →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-800 rounded-xl p-5 text-center">
                <p className="text-zinc-400 mb-4">You don't have an active subscription.</p>
                <Link
                  to="/plans"
                  className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                >
                  Choose a Plan
                </Link>
              </div>
            )}
          </div>

          {/* Sign out */}
          <div className="pt-2">
            <button
              onClick={handleSignOut}
              className="w-full py-3 border border-zinc-600 text-zinc-300 hover:bg-zinc-800 rounded-xl font-semibold transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
