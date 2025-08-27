const ClientUser = require('../models/clientUsers');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

// LOGIN
exports.clientLogin = async (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt for email:", email);
  console.log("Login attempt for email:", password);


  const user = await ClientUser.findOne({ email, status: 'Active' });
  if (!user) return res.status(401).json({ message: 'User not found or inactive' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

  user.lastLogin = new Date();
  await user.save();

  const token = jwt.sign({ userId: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  res.status(200).json({
    message: 'Login successful',
    token,
    user: { userId: user._id, email: user.email, role: user.role }
  });
};

// FORGOT PASSWORD
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await ClientUser.findOne({ email });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

  user.resetToken = resetToken;
  user.resetTokenExpiry = expiry;
  await user.save();

  const resetUrl = `${req.protocol}://${req.get('host')}/api/client-users/reset-password/${resetToken}`;
  const message = `
    <p>You requested a password reset.</p>
    <p><a href="${resetUrl}">Click here to reset your password</a></p>
    <p>This link expires in 15 minutes.</p>
  `;
  await sendEmail(email, 'Password Reset', message);

  res.status(200).json({ message: 'Reset link sent to email' });
};

// RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const user = await ClientUser.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: Date.now() }
  });

  if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

  user.password = newPassword;
  user.resetToken = null;
  user.resetTokenExpiry = null;
  await user.save();

  res.status(200).json({ message: 'Password reset successfully' });
};
