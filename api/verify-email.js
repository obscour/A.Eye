import supabase from './_supabaseClient.js'

export default async function handler(req, res) {
  // Handle GET request - serve the verification page
  if (req.method === 'GET') {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Email - A.Eye</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
  <link href="/css/styles.css" rel="stylesheet" />
</head>
<body class="d-flex align-items-center justify-content-center vh-100">
  <!-- Verification Box -->
  <div class="login-box text-center">
    <h3 class="mb-4">Email Verification</h3>

    <!-- Error Message -->
    <div id="error-message" class="alert alert-danger" style="display: none;"></div>
    <!-- Success Message -->
    <div id="success-message" class="alert alert-success" style="display: none;"></div>

    <!-- Loading Message -->
    <div id="loading-message" class="alert alert-info">
      Verifying your email address...
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    // Get token from URL
    function getTokenFromURL() {
      const params = new URLSearchParams(window.location.search);
      return params.get('token');
    }

    // Display error or success message
    function showMessage(type, text) {
      const loadingMsg = document.getElementById('loading-message');
      const errorMsg = document.getElementById('error-message');
      const successMsg = document.getElementById('success-message');
      
      loadingMsg.style.display = 'none';
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';
      
      if (type === 'error') {
        errorMsg.textContent = text;
        errorMsg.style.display = 'block';
      } else {
        successMsg.textContent = text;
        successMsg.style.display = 'block';
      }
    }

    // Verify email on page load
    document.addEventListener('DOMContentLoaded', async () => {
      console.log('=== INLINED SCRIPT VERSION v2.0 ===');
      console.log('Current URL:', window.location.href);
      
      const token = getTokenFromURL();
      console.log('Token from URL:', token ? 'Found' : 'Not found');
      
      if (!token) {
        showMessage('error', 'Invalid verification link. No token provided.');
        return;
      }

      try {
        console.log('Sending verification request...');
        const res = await fetch('/api/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const result = await res.json();
        console.log('Verification response:', result);

        if (!res.ok) {
          throw new Error(result.error || 'Verification failed');
        }

        // Store user in localStorage
        localStorage.setItem('user', JSON.stringify(result.user));
        console.log('User stored in localStorage');

        showMessage('success', 'Email verified successfully! Redirecting to dashboard...');

        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 2000);
      } catch (err) {
        console.error('Verification error:', err);
        showMessage('error', err.message || 'Verification failed. Please try again or request a new verification link.');
      }
    });
  </script>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    return res.status(200).send(htmlContent)
  }

  // Handle POST request - verify the email token
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
      console.error('Token lookup error:', tokenError)
      console.error('Token searched: [REDACTED]')
      return res.status(400).json({ error: 'Invalid or expired verification token' })
    }

    console.log('Token found, user_id:', tokenData.user_id, 'Type:', typeof tokenData.user_id)

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

    // Ensure user_id is a string for comparison
    const userId = String(tokenData.user_id)
    
    // First, check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('uuid, email, username, role, email_verified')
      .eq('uuid', userId)
      .maybeSingle()

    if (checkError) {
      console.error('User lookup error:', checkError)
      console.error('Token user_id:', userId, 'Type:', typeof userId)
      return res.status(500).json({ error: 'Database error while verifying user' })
    }

    if (!existingUser) {
      console.error('User not found for user_id:', userId)
      return res.status(400).json({ error: 'User not found or verification failed' })
    }

    // Verify user's email
    const { data: userData, error: verifyError } = await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('uuid', userId)
      .select('uuid, email, username, role, email_verified')
      .maybeSingle()

    if (verifyError) {
      console.error('User update error:', verifyError)
      console.error('Token user_id:', userId)
      return res.status(500).json({ error: 'Failed to update user verification status' })
    }

    if (!userData) {
      console.error('User update returned no data for user_id:', userId)
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

