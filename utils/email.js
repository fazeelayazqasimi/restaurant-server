const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

// ─── SEND OTP ─────────────────────────────────────────────
const sendOTP = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: `"Restaurant Reservation" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your OTP Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #e74c3c; text-align: center;">Email Verification</h2>
          <p>Your OTP verification code is:</p>
          <div style="background: #f8f8f8; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #e74c3c; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>
      `
    })
    return true
  } catch (error) {
    console.error('Send OTP email error:', error)
    return false
  }
}

// ─── BOOKING CONFIRMATION ─────────────────────────────────
const sendBookingConfirmation = async (email, userName, restaurantName, date, time, guests, reservationId) => {
  try {
    await transporter.sendMail({
      from: `"Restaurant Reservation" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Booking Confirmed – ${restaurantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #27ae60; text-align: center;">Booking Confirmed ✓</h2>
          <p>Hi <strong>${userName}</strong>,</p>
          <p>Your reservation has been received. Here are your details:</p>
          <div style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #666;">Restaurant</td><td style="padding: 6px 0; font-weight: bold;">${restaurantName}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Date</td><td style="padding: 6px 0; font-weight: bold;">${date}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Time</td><td style="padding: 6px 0; font-weight: bold;">${time}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Guests</td><td style="padding: 6px 0; font-weight: bold;">${guests}</td></tr>
              ${reservationId ? `<tr><td style="padding: 6px 0; color: #666;">Booking ID</td><td style="padding: 6px 0; font-weight: bold;">#${reservationId}</td></tr>` : ''}
            </table>
          </div>
          <p style="color: #666;">Status: <span style="color: #f39c12; font-weight: bold;">Pending Confirmation</span></p>
          <p style="color: #999; font-size: 12px;">You will receive another email once the restaurant confirms your booking.</p>
        </div>
      `
    })
    return true
  } catch (error) {
    console.error('Send confirmation email error:', error)
    return false
  }
}

// ─── BOOKING STATUS UPDATE ────────────────────────────────
const sendStatusUpdateEmail = async (email, userName, restaurantName, date, time, status) => {
  try {
    const statusConfig = {
      confirmed: { color: '#27ae60', label: 'Confirmed ✓', message: 'Your booking has been confirmed by the restaurant. We look forward to seeing you!' },
      cancelled: { color: '#e74c3c', label: 'Cancelled', message: 'Your booking has been cancelled. We hope to see you again soon.' },
      completed: { color: '#3498db', label: 'Completed', message: 'Thank you for dining with us! We hope you had a great experience.' },
      no_show:   { color: '#95a5a6', label: 'No Show', message: 'We missed you today. Please contact us if you need to reschedule.' }
    }

    const config = statusConfig[status] || { color: '#666', label: status, message: '' }

    await transporter.sendMail({
      from: `"Restaurant Reservation" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Booking ${config.label} – ${restaurantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: ${config.color}; text-align: center;">Booking ${config.label}</h2>
          <p>Hi <strong>${userName}</strong>,</p>
          <p>${config.message}</p>
          <div style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #666;">Restaurant</td><td style="padding: 6px 0; font-weight: bold;">${restaurantName}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Date</td><td style="padding: 6px 0; font-weight: bold;">${date}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Time</td><td style="padding: 6px 0; font-weight: bold;">${time}</td></tr>
            </table>
          </div>
        </div>
      `
    })
    return true
  } catch (error) {
    console.error('Send status update email error:', error)
    return false
  }
}

// ─── REMINDER EMAIL ───────────────────────────────────────
const sendReminderEmail = async (email, userName, restaurantName, date, time, guests) => {
  try {
    await transporter.sendMail({
      from: `"Restaurant Reservation" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Reminder: Your booking tomorrow at ${restaurantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #3498db; text-align: center;">Booking Reminder 🔔</h2>
          <p>Hi <strong>${userName}</strong>,</p>
          <p>This is a friendly reminder about your upcoming reservation:</p>
          <div style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #666;">Restaurant</td><td style="padding: 6px 0; font-weight: bold;">${restaurantName}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Date</td><td style="padding: 6px 0; font-weight: bold;">${date}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Time</td><td style="padding: 6px 0; font-weight: bold;">${time}</td></tr>
              <tr><td style="padding: 6px 0; color: #666;">Guests</td><td style="padding: 6px 0; font-weight: bold;">${guests}</td></tr>
            </table>
          </div>
          <p style="color: #666;">See you soon!</p>
        </div>
      `
    })
    return true
  } catch (error) {
    console.error('Send reminder email error:', error)
    return false
  }
}

module.exports = { sendOTP, sendBookingConfirmation, sendStatusUpdateEmail, sendReminderEmail }