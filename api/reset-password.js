import supabase from './_supabaseClient.js'
import { hashPassword } from './_passwordUtils.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body || {}
    const { token, newPassword, action } = body

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

