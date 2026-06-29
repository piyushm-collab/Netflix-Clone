import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import BrowseNavbar from '../../components/Navbar/BrowseNavbar';

const PLANS = [
  {
    name: 'Basic',
    amountPaise: 19900,
    display: '₹199/mo',
    quality: 'Good (480p)',
    screens: 1,
    downloads: 0,
    features: ['Watch on 1 device', 'Standard definition', 'No downloads'],
    borderColor: 'border-zinc-600',
    badgeColor: '',
  },
  {
    name: 'Standard',
    amountPaise: 49900,
    display: '₹499/mo',
    quality: 'Better (1080p)',
    screens: 2,
    downloads: 2,
    features: ['Watch on 2 devices', 'Full HD quality', '2 downloads/month'],
    borderColor: 'border-blue-500',
    popular: true,
    badgeColor: 'bg-blue-600',
  },
  {
    name: 'Premium',
    amountPaise: 79900,
    display: '₹799/mo',
    quality: 'Best (4K + HDR)',
    screens: 4,
    downloads: 6,
    features: ['Watch on 4 devices', '4K Ultra HD + HDR', '6 downloads/month'],
    borderColor: 'border-red-500',
    badgeColor: 'bg-red-600',
  },
];

const PlansPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: (typeof PLANS)[0]) => {
    setLoading(plan.name);
    try {
      const { data } = await apiClient.post('/subscriptions', {
        planName: plan.name,
        amountPaise: plan.amountPaise,
      });
      toast.success(`${plan.name} plan selected! Complete payment to activate.`);
      navigate(`/payment/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to initiate subscription');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <BrowseNavbar />
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-14"
        >
          <h1 className="text-4xl font-bold mb-4">Choose your plan</h1>
          <p className="text-zinc-400 text-lg">Watch on any device. Cancel anytime. No hidden fees.</p>
          {user?.subscription && (
            <div className="mt-4 inline-block bg-green-900/40 border border-green-700 text-green-400 px-5 py-2 rounded-full text-sm font-semibold">
              Current plan: {user.subscription.planName}
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan, i) => {
            const isCurrent = user?.subscription?.planName === plan.name;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative bg-zinc-900 rounded-2xl border-2 ${plan.borderColor} p-8 flex flex-col`}
              >
                {plan.popular && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${plan.badgeColor} text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap`}>
                    MOST POPULAR
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    ACTIVE
                  </div>
                )}

                <h2 className="text-2xl font-bold mb-1">{plan.name}</h2>
                <p className="text-3xl font-bold text-red-500 mb-2">{plan.display}</p>
                <p className="text-zinc-400 text-sm mb-6">{plan.quality}</p>

                <ul className="space-y-2 mb-8 flex-1 text-zinc-300 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="text-green-500">✓</span> {f}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span> Cancel anytime
                  </li>
                </ul>

                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={loading === plan.name || isCurrent}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                    isCurrent
                      ? 'bg-green-700 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700 hover:scale-105'
                  } disabled:opacity-60`}
                >
                  {loading === plan.name ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : isCurrent ? (
                    'Active Plan ✓'
                  ) : (
                    `Get ${plan.name} →`
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-zinc-500 text-sm mt-10">
          Payment is OTP-verified. Check your server console for the demo OTP.
        </p>
      </div>
    </div>
  );
};

export default PlansPage;
