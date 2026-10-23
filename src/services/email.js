import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmailOTP = async (email, otp, purpose = "signup") => {
  const subjects = {
    signup: "Verify your email - Bible Ads Campaign",
    forgot_password: "Password reset verification - Bible Ads Campaign",
    profile: "Verify your email - Bible Ads Campaign",
  };

  const descriptions = {
    signup: "Complete your account registration",
    forgot_password: "Reset your account password",
    profile: "Verify your email address",
  };

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email SMTP configuration is missing.");
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: subjects[purpose] || "Verification code - Bible Ads Campaign",
      text: `${descriptions[purpose] || "Verify your account"}.\n\nYour verification code is ${otp}.\n\nThis code expires in 5 minutes. If you did not request this code, you can ignore this email.`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto; padding: 24px; color: #202124;">
        <h2 style="color: #6F5ADC;">Bible Ads Campaign</h2>
        <p>${descriptions[purpose] || "Verify your account"}.</p>
        <p>Your verification code is:</p>
        <div style="font-size: 30px; font-weight: bold; letter-spacing: 8px; padding: 16px 0;">${otp}</div>
        <p>This code expires in 5 minutes.</p>
        <p>If you did not request this code, you can ignore this email.</p>
      </div>
    `,
    });
  } catch (error) {
    console.error("SMTP AUTHENTICATION / EMAIL ERROR:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      host: process.env.EMAIL_HOST,
      userConfigured: Boolean(process.env.EMAIL_USER),
      passConfigured: Boolean(process.env.EMAIL_PASS),
    });

    throw error;
  }

  return true;
};
