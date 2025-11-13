import supabase from './_supabaseClient.js'
import { randomBytes } from 'crypto'
import { sendVerificationEmail, getBaseUrl } from './_emailService.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body || {}
    const { identifier } = body

    if (!identifier) {
      return res.status(400).json({ error: 'Missing email or username' })
    }

    // Find user by email or username
    const column = identifier.includes('@') ? 'email' : 'username'
    
    const { data: userData, error: findError } = await supabase
      .from('users')
      .select('uuid, email, username, email_verified')
      .eq(column, identifier)
      .single()

    if (findError || !userData) {
      // Don't reveal if user exists (security best practice)
      return res.status(200).json({ 
        message: 'If an account exists with that email/username, a verification email has been sent.' 
      })
    }

    // Check if email is already verified
    if (userData.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' })
    }

    // Invalidate any existing unused tokens for this user
    await supabase
      .from('email_verification_tokens')
      .update({ used: true })
      .eq('user_id', userData.uuid)
      .eq('used', false)

    // Generate new verification token
    const verificationToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

    // Create new verification token
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert([{
        user_id: userData.uuid,
        token: verificationToken,
        expires_at: expiresAt.toISOString(),
        used: false
      }])

    if (tokenError) {
      console.error('Error creating verification token:', tokenError)
      return res.status(500).json({ error: 'Failed to create verification token' })
    }

    // Get the base URL from environment or request
    const baseUrl = getBaseUrl(req)
    const verificationLink = `${baseUrl}/api/verify-email?token=${verificationToken}`
    
    // Log the verification link for debugging (remove in production if needed)
    console.log('Generated verification link (resend):', verificationLink)

    // Send verification email
    const emailResult = await sendVerificationEmail(userData.email, userData.username, verificationLink, req)
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error)
      // Still return success to user (security best practice)
    }

    // For development/testing: return the link in response if email failed or in dev mode
    const isDevelopment = !process.env.VERCEL || process.env.VERCEL_ENV === 'development'
    const shouldReturnLink = isDevelopment || !emailResult.success

    return res.status(200).json({ 
      message: 'If an account exists with that email/username, a verification email has been sent.',
      // Only return link in development or if email sending failed (for testing/debugging)
      ...(shouldReturnLink && { verificationLink })
    })
  } catch (err) {
    console.error('Resend verification email error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

