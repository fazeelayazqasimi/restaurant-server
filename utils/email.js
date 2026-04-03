const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

const sendOTP = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: `"TableBook" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your OTP for TableBook Registration',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eef0f4; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; width: 50px; height: 50px; background: #f43f5e; border-radius: 12px; text-align: center; line-height: 50px; font-size: 24px; color: white;">T</div>
          </div>
          <h2 style="color: #0f172a; text-align: center;">Verify Your Email</h2>
          <p style="color: #475569; text-align: center;">Your OTP for TableBook registration is:</p>
          <div style="background: #f8f9fb; padding: 16px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 8px; border-radius: 12px; margin: 20px 0;">${otp}</div>
          <p style="color: #64748b; font-size: 12px; text-align: center;">This OTP is valid for 10 minutes.</p>
        </div>
      `
    })
    return true
  } catch (error) {
    console.error('Email error:', error)
    return false
  }
}

const sendBookingConfirmation = async (email, name, restaurant, date, time, guests) => {
  try {
    await transporter.sendMail({
      from: `"TableBook" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Booking Confirmed - TableBook',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eef0f4; border-radius: 16px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; width: 50px; height: 50px; background: #10b981; border-radius: 12px; text-align: center; line-height: 50px; font-size: 24px; color: white;">✓</div>
          </div>
          <h2 style="color: #0f172a; text-align: center;">Booking Confirmed!</h2>
          <p style="color: #475569;">Hello ${name},</p>
          <p style="color: #475569;">Your reservation has been confirmed.</p>
          <div style="background: #f8f9fb; padding: 16px; border-radius: 12px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Restaurant:</strong> ${restaurant}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
            <p style="margin: 5px 0;"><strong>Guests:</strong> ${guests}</p>
          </div>
          <p style="color: #64748b; font-size: 12px; text-align: center;">Thank you for choosing TableBook!</p>
        </div>
      `
    })
    return true
  } catch (error) {
    console.error('Email error:', error)
    return false
  }
}

module.exports = { sendOTP, sendBookingConfirmation }