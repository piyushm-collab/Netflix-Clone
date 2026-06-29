import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import apiClient from '../../lib/apiClient';
import BrowseNavbar from '../../components/Navbar/BrowseNavbar';

interface Transaction {
  id: string;
  planName: string;
  amountPaise: number;
  status: string;
  phase: string;
  otpResendCount: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  CREATED: { label: 'Payment initiated', color: 'text-yellow-400' },
  OTP_SENT: { label: 'OTP sent — verify below', color: 'text-blue-400' },
  OTP_VERIFIED: { label: 'OTP verified', color: 'text-green-400' },
  PAYMENT_COMPLETE: { label: 'Payment complete! 🎉', color: 'text-green-400' },
  FAILED: { label: 'Payment failed', color: 'text-red-400' },
};

const PaymentPage: React.FC = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!transactionId) return;
    apiClient
      .get(`/subscriptions/${transactionId}`)
      .then((r) => setTxn(r.data))
      .catch(() => toast.error('Transaction not found'));
  }, [transactionId]);

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const { data } = await apiClient.post(`/subscriptions/${transactionId}/otp/send`);
      toast.success(data.message, { duration: 5000 });
      setTxn((t) => t ? { ...t, status: 'OTP_SENT', otpResendCount: data.resendCount } : t);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return; }
    setVerifying(true);
    try {
      const { data } = await apiClient.post(`/subscriptions/${transactionId}/otp/verify`, { otp });
      setTxn(data);
      toast.success(`🎉 ${data.planName} plan activated! Redirecting to profile...`, { duration: 3000 });
      setTimeout(() => navigate('/profile'), 2500);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'OTP verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setOtp('');
    await handleSendOtp();
  };

  if (!txn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isComplete = txn.status === 'PAYMENT_COMPLETE';
  const statusInfo = STATUS_LABELS[txn.status] || { label: txn.status, color: 'text-zinc-400' };

  return (
    <div className="min-h-screen bg-black text-white">
      <BrowseNavbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-zinc-900 rounded-2xl p-10 w-full max-w-md border border-zinc-700 shadow-2xl"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">{isComplete ? '🎉' : '🔐'}</span>
            </div>
            <h1 className="text-2xl font-bold">
              {isComplete ? 'Subscription Activated!' : 'Complete Your Subscription'}
            </h1>
            <p className="text-zinc-400 mt-2">
              {isComplete
                ? `You're now on the ${txn.planName} plan. Enjoy Netflix!`
                : 'Verify your identity with a one-time password'}
            </p>
          </div>

          {/* Transaction Details */}
          <div className="bg-zinc-800 rounded-xl p-5 mb-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Plan</span>
              <span className="font-semibold">{txn.planName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Amount</span>
              <span className="font-semibold text-red-400">₹{(txn.amountPaise / 100).toFixed(0)}/month</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Status</span>
              <span className={`font-semibold text-sm ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Phase</span>
              <span className="text-zinc-300 text-sm font-mono bg-zinc-700 px-2 py-0.5 rounded">{txn.phase}</span>
            </div>
          </div>

          {/* OTP Flow */}
          {!isComplete && (
            <div className="space-y-4">
              {txn.status === 'CREATED' && (
                <button
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 rounded-xl font-semibold transition-colors disabled:opacity-50"
                >
                  {sendingOtp ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending OTP...
                    </div>
                  ) : (
                    'Send OTP to verify →'
                  )}
                </button>
              )}

              {txn.status === 'OTP_SENT' && (
                <>
                  <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-sm text-blue-300 text-center">
                    📋 OTP printed in server console (demo mode)
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="— — — — — —"
                    className="w-full bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-4 text-center text-2xl tracking-[0.8rem] font-mono focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                  <button
                    onClick={handleVerify}
                    disabled={verifying || otp.length !== 6}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {verifying ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verifying...
                      </div>
                    ) : (
                      'Verify & Activate Subscription →'
                    )}
                  </button>
                  {txn.otpResendCount < 3 && (
                    <button onClick={handleResendOtp} disabled={sendingOtp} className="w-full text-sm text-zinc-400 hover:text-white transition-colors">
                      Resend OTP ({3 - txn.otpResendCount} attempts left)
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {isComplete && (
            <button onClick={() => navigate('/browse')} className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold transition-all hover:scale-105">
              Start Watching →
            </button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PaymentPage;
