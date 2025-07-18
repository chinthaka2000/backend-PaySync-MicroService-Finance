const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text) => {
  // Check if we're in development mode or missing credentials
  const isDev = process.env.NODE_ENV === 'development';
  const hasCredentials = process.env.EMAIL_USER && process.env.EMAIL_PASS;

  // Log email details for debugging
  console.log(`📧 Email would be sent to: ${to}`);
  console.log(`📧 Subject: ${subject}`);
  console.log(`📧 Email credentials configured: ${hasCredentials ? 'Yes' : 'No'}`);

  // If we're missing credentials, mock the email sending
  if (!hasCredentials) {
    console.log(`📧 MOCK EMAIL (no credentials provided):`);
    console.log(`📧 To: ${to}`);
    console.log(`📧 Subject: ${subject}`);
    console.log(`📧 Message: ${text.substring(0, 100)}...`);
    console.log(`📧 Mock email delivery successful!`);
    return; // Skip actual sending
  }

  try {
    // Create transporter with credentials
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Send the email
    const result = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });

    console.log(`📧 Email sent successfully: ${result.messageId}`);
  } catch (error) {
    console.error(`📧 Error sending email: ${error.message}`);
    // Don't throw the error - just log it and continue
    // This prevents email errors from breaking the approval flow
  }
};

module.exports = sendEmail;