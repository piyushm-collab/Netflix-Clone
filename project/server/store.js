const { v4: uuidv4 } = require('uuid');

const users = new Map();
const transactions = new Map();
const otps = new Map();

function createUser({ email, passwordHash, fullName, phone }) {
  const user = { id: uuidv4(), email, passwordHash, fullName, phone: phone || '', createdAt: new Date().toISOString(), subscription: null };
  users.set(email, user);
  return user;
}
function getUser(email) { return users.get(email) || null; }
function updateUser(email, patch) {
  const user = users.get(email);
  if (!user) return null;
  Object.assign(user, patch);
  return user;
}
function createTransaction({ userId, email, planName, amountPaise }) {
  const txn = { id: uuidv4(), userId, email, planName, amountPaise, phase: 'INITIATED', status: 'CREATED', otpResendCount: 0, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  transactions.set(txn.id, txn);
  return txn;
}
function getTransaction(id) { return transactions.get(id) || null; }
function updateTransaction(id, patch) {
  const txn = transactions.get(id);
  if (!txn) return null;
  Object.assign(txn, patch, { updatedAt: new Date().toISOString() });
  return txn;
}
function setOtp(transactionId, otp, resendCount) {
  otps.set(transactionId, { otp, expiresAt: Date.now() + 5 * 60 * 1000, resendCount });
}
function getOtp(transactionId) { return otps.get(transactionId) || null; }
function deleteOtp(transactionId) { otps.delete(transactionId); }

module.exports = { createUser, getUser, updateUser, createTransaction, getTransaction, updateTransaction, setOtp, getOtp, deleteOtp };
