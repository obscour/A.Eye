import supabase from './_supabaseClient.js'
import { randomBytes } from 'crypto'
import { sendPasswordResetEmail, getBaseUrl } from './_emailService.js'

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
      .select('uuid, email, username')
      .eq(column, identifier)
      .single()

    // Don't reveal if user exists or not (security best practice)
    // Always return success message even if user doesn't exist
    if (findError || !userData) {
      // Return success to prevent user enumeration
      return res.status(200).json({ 
        message: 'If an account exists with that email/username, a password reset link has been sent.' 
      })
    }

    // Generate secure random token
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Invalidate any existing tokens for this user
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('user_id', userData.uuid)
      .eq('used', false)

    // Create new reset token
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert([{
        user_id: userData.uuid,
        token,
        expires_at: expiresAt.toISOString(),
        used: false
      }])

    if (tokenError) {
      console.error('Error creating reset token:', tokenError)
      return res.status(500).json({ error: 'Failed to create reset token' })
    }

    // Get the base URL from environment or request
    const baseUrl = getBaseUrl(req)
    const resetLink = `${baseUrl}/reset-password.html?token=${token}`

    // Send password reset email
    const emailResult = await sendPasswordResetEmail(userData.email, userData.username, resetLink, req)
    
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error)
      // Still return success to user (security best practice - don't reveal if user exists)
      // The error is logged for debugging
    }

    // For development/testing: return the link in response if email failed or in dev mode
    const isDevelopment = !process.env.VERCEL || process.env.VERCEL_ENV === 'development'
    const shouldReturnLink = isDevelopment || !emailResult.success
    
    return res.status(200).json({ 
      message: 'If an account exists with that email/username, a password reset link has been sent.',
      // Only return link in development or if email sending failed (for testing/debugging)
      ...(shouldReturnLink && { resetLink })
    })
  } catch (err) {
    console.error('Request password reset error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

