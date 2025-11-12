import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body || {}
    const { token } = body

    if (!token) {
      return res.status(400).json({ error: 'Missing verification token' })
    }

    // Find token in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('email_verification_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', token)
      .eq('used', false)
      .single()

    if (tokenError || !tokenData) {
      return res.status(400).json({ error: 'Invalid or expired verification token' })
    }

    // Check if token has expired
    const expiresAt = new Date(tokenData.expires_at)
    if (expiresAt < new Date()) {
      // Mark as used
      await supabase
        .from('email_verification_tokens')
        .update({ used: true })
        .eq('id', tokenData.id)

      return res.status(400).json({ error: 'Verification token has expired' })
    }

    // Verify user's email
    const { data: userData, error: verifyError } = await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('uuid', tokenData.user_id)
      .select('uuid, email, username, role, email_verified')
      .single()

    if (verifyError || !userData) {
      return res.status(400).json({ error: 'User not found or verification failed' })
    }

    // Mark token as used
    await supabase
      .from('email_verification_tokens')
      .update({ used: true })
      .eq('id', tokenData.id)

    // Return user with id field for frontend compatibility
    const user = {
      ...userData,
      id: userData.uuid
    }

    return res.status(200).json({ 
      success: true,
      message: 'Email verified successfully',
      user 
    })
  } catch (err) {
    console.error('Verify email error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}

