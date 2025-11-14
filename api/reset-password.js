import supabase from './_supabaseClient.js'
import { hashPassword } from './_passwordUtils.js'
import { randomBytes } from 'crypto'
import { sendPasswordResetEmail, getBaseUrl } from './_emailService.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body || {}
    const { token, newPassword, action, identifier } = body

    // Handle request password reset
    if (action === 'request' || (!token && identifier)) {
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
      const resetToken = randomBytes(32).toString('hex')
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
          token: resetToken,
          expires_at: expiresAt.toISOString(),
          used: false
        }])

      if (tokenError) {
        console.error('Error creating reset token:', tokenError)
        return res.status(500).json({ error: 'Failed to create reset token' })
      }

      // Get the base URL from environment or request
      const baseUrl = getBaseUrl(req)
      const resetLink = `${baseUrl}/reset-password.html?token=${resetToken}`

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
    }

    if (!token) {
      return res.status(400).json({ error: 'Missing reset token' })
    }

    // Handle token validation (action === 'validate')
    if (action === 'validate') {
      // Find token in database
      const { data: tokenData, error: tokenError } = await supabase
        .from('password_reset_tokens')
        .select('id, user_id, expires_at, used')
        .eq('token', token)
        .eq('used', false)
        .single()

      if (tokenError || !tokenData) {
        return res.status(400).json({ error: 'Invalid or expired reset token' })
      }

      // Check if token has expired
      const expiresAt = new Date(tokenData.expires_at)
      if (expiresAt < new Date()) {
        // Mark as used
        await supabase
          .from('password_reset_tokens')
          .update({ used: true })
          .eq('id', tokenData.id)

        return res.status(400).json({ error: 'Reset token has expired' })
      }

      // Get user info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('uuid, email, username')
        .eq('uuid', tokenData.user_id)
        .single()

      if (userError || !userData) {
        return res.status(400).json({ error: 'User not found' })
      }

      return res.status(200).json({ 
        valid: true,
        userId: userData.uuid,
        email: userData.email,
        username: userData.username
      })
    }

    // Handle password reset (default action)
    if (!newPassword) {
      return res.status(400).json({ error: 'Missing new password' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' })
    }

    // Find and validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', token)
      .eq('used', false)
      .single()

    if (tokenError || !tokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    // Check if token has expired
    const expiresAt = new Date(tokenData.expires_at)
    if (expiresAt < new Date()) {
      // Mark as used
      await supabase
        .from('password_reset_tokens')
        .update({ used: true })
        .eq('id', tokenData.id)

      return res.status(400).json({ error: 'Reset token has expired' })
    }

    // Hash the new password before updating
    const hashedPassword = await hashPassword(newPassword)
    
    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('uuid', tokenData.user_id)

    if (updateError) {
      console.error('Error updating password:', updateError)
      return res.status(500).json({ error: 'Failed to update password' })
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('id', tokenData.id)

    return res.status(200).json({ message: 'Password reset successful' })
  } catch (err) {
    console.error('Reset password error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

