import pkg from '@getbrevo/brevo'
const { ApiClient, TransactionalEmailsApi, SendSmtpEmail } = pkg

// Initialize Brevo client only if API key is available
let apiInstance = null
let apiKey = null

try {
  if (process.env.BREVO_API_KEY) {
    // Get or create the default API client instance
    const defaultClient = ApiClient.instance || new ApiClient()
    
    // Set up authentication
    if (!defaultClient.authentications) {
      defaultClient.authentications = {}
    }
    
    // Set the API key
    defaultClient.authentications['api-key'] = {
      type: 'apiKey',
      in: 'header',
      name: 'api-key'
    }
    defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY
    
    // Create the transactional emails API instance
    apiInstance = new TransactionalEmailsApi(defaultClient)
    apiKey = process.env.BREVO_API_KEY
  }
} catch (err) {
  console.error('Failed to initialize Brevo:', err.message)
  console.error('Error details:', err)
  // Continue without email functionality - will return error when trying to send
}

/**
 * Get the base URL for the application
 * Priority: Explicit production URLs > Request headers (for local dev) > VERCEL_URL
 */
function getBaseUrl(req) {
  // In production, prioritize NEXT_PUBLIC_APP_URL (usually the canonical domain with www)
  // This ensures consistency with how users access the site
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  
  // Fallback to PRODUCTION_URL if NEXT_PUBLIC_APP_URL is not set
  if (process.env.PRODUCTION_URL) {
    return process.env.PRODUCTION_URL
  }
  
  // When running locally (vercel dev), prioritize request headers
  // This ensures localhost URLs are used during local development
  if (req?.headers?.origin) {
    const origin = req.headers.origin
    // If origin is localhost, use it (local development)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin
    }
    // In production, if we have a request origin that matches our domain, use it
    // This handles www vs non-www automatically
    if (origin.includes('aeyebraille.online')) {
      return origin
    }
  }
  
  if (req?.headers?.referer) {
    const referer = req.headers.referer.split('/').slice(0, 3).join('/')
    // If referer is localhost, use it (local development)
    if (referer.includes('localhost') || referer.includes('127.0.0.1')) {
      return referer
    }
    // In production, if referer matches our domain, use it
    if (referer.includes('aeyebraille.online')) {
      return referer
    }
  }
  
  // Check if we're in local development (vercel dev sets VERCEL_ENV)
  const isLocalDev = !process.env.VERCEL || process.env.VERCEL_ENV === 'development'
  if (isLocalDev) {
    return 'http://localhost:3000'
  }
  
  // Production: Check for Vercel URL
  // VERCEL_URL is the deployment URL (might be preview or production)
  // VERCEL_BRANCH_URL is the branch-specific URL
  if (process.env.VERCEL_URL) {
    // Ensure it includes https://
    const url = process.env.VERCEL_URL.startsWith('http') 
      ? process.env.VERCEL_URL 
      : `https://${process.env.VERCEL_URL}`
    return url
  }
  
  // Last resort: localhost
  return 'http://localhost:3000'
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(email, username, verificationLink, req) {
  if (!process.env.BREVO_API_KEY || !apiInstance) {
    console.error('BREVO_API_KEY is not set or Brevo is not initialized. Email will not be sent.')
    console.log('Verification link:', verificationLink)
    return { success: false, error: 'Email service not configured' }
  }

  const fromEmail = {
    email: process.env.BREVO_FROM_EMAIL || 'noreplya.eye@gmail.com',
    name: process.env.BREVO_FROM_NAME || 'A.Eye'
  }
  
  try {
    const sendSmtpEmail = new SendSmtpEmail()
    sendSmtpEmail.subject = 'Verify Your Email Address - A.Eye'
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to A.Eye!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <p style="font-size: 16px;">Hi ${username},</p>
          <p style="font-size: 16px;">Thank you for creating an account with A.Eye! To complete your registration, please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Verify Email Address</a>
          </div>
          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #999; word-break: break-all; background: #fff; padding: 10px; border-radius: 5px; border: 1px solid #e0e0e0;">${verificationLink}</p>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">This link will expire in 24 hours.</p>
          <p style="font-size: 14px; color: #666;">If you didn't create an account with A.Eye, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">This is an automated message, please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `
    sendSmtpEmail.textContent = `
Welcome to A.Eye!

Hi ${username},

Thank you for creating an account with A.Eye! To complete your registration, please verify your email address by clicking the link below:

${verificationLink}

This link will expire in 24 hours.

If you didn't create an account with A.Eye, please ignore this email.

This is an automated message, please do not reply to this email.
    `.trim()
    sendSmtpEmail.sender = fromEmail
    sendSmtpEmail.to = [{ email, name: username }]

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail)

    console.log('Verification email sent successfully to', email)
    return { success: true, data }
  } catch (err) {
    console.error('Error sending verification email:', err)
    return { success: false, error: err.message || 'Failed to send email' }
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email, username, resetLink, req) {
  if (!process.env.BREVO_API_KEY || !apiInstance) {
    console.error('BREVO_API_KEY is not set or Brevo is not initialized. Email will not be sent.')
    console.log('Reset link:', resetLink)
    return { success: false, error: 'Email service not configured' }
  }

  const fromEmail = {
    email: process.env.BREVO_FROM_EMAIL || 'noreplya.eye@gmail.com',
    name: process.env.BREVO_FROM_NAME || 'A.Eye'
  }
  
  try {
    const sendSmtpEmail = new SendSmtpEmail()
    sendSmtpEmail.subject = 'Password Reset Request - A.Eye'
    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Password Reset Request</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
          <p style="font-size: 16px;">Hi ${username},</p>
          <p style="font-size: 16px;">We received a request to reset your password for your A.Eye account. Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px;">Reset Password</a>
          </div>
          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #999; word-break: break-all; background: #fff; padding: 10px; border-radius: 5px; border: 1px solid #e0e0e0;">${resetLink}</p>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">This link will expire in 1 hour.</p>
          <p style="font-size: 14px; color: #ff6b6b; font-weight: bold;">If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">This is an automated message, please do not reply to this email.</p>
        </div>
      </body>
      </html>
    `
    sendSmtpEmail.textContent = `
Password Reset Request

Hi ${username},

We received a request to reset your password for your A.Eye account. Click the link below to reset your password:

${resetLink}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

This is an automated message, please do not reply to this email.
    `.trim()
    sendSmtpEmail.sender = fromEmail
    sendSmtpEmail.to = [{ email, name: username }]

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail)

    console.log('Password reset email sent successfully to', email)
    return { success: true, data }
  } catch (err) {
    console.error('Error sending password reset email:', err)
    return { success: false, error: err.message || 'Failed to send email' }
  }
}

export { getBaseUrl }
