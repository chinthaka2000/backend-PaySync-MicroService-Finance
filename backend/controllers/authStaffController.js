const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Staff = require('../models/Staff');

exports.staffLogin = async (req, res) => {
  const { email, password } = req.body;

  const user = await Staff.findOne({ email, isActive: true });
  if (!user) return res.status(401).json({ message: 'Staff not found or inactive' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

  user.lastLogin = new Date();
  await user.save();

  const token = jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.status(200).json({
    message: 'Login successful',
    token,
    sessionId: user._id,
    user: { userId: user._id, email: user.email, role: user.role }
  });
};
