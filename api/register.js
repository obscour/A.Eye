import supabase from './_supabaseClient.js'
import { randomUUID } from 'crypto'
import { randomBytes } from 'crypto'
import { sendVerificationEmail, getBaseUrl } from './_emailService.js'

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const body = req.body || {}
    const { username, email, password } = body

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields." })
    }

    // Check if username or email already exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("uuid, username, email")
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle()

    if (checkError) throw checkError
    if (existingUser) {
      return res.status(400).json({ error: "Username or email already taken." })
    }

    // Generate email verification token
    const verificationToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

    // Create new user (email_verified defaults to false)
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          uuid: randomUUID(),
          username,
          email,
          password, // ⚠️ Plaintext for now (add hashing later)
          email_verified: false,
          stats: (() => {
            const initialStats = {};
            for (let char of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
              initialStats[char] = { streak: 0, correct: 0, mastery: 0, attempts: 0 };
            }
            return initialStats;
          })(),
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single()

    if (error) throw error

    // Store verification token
    const { error: tokenError } = await supabase
      .from("email_verification_tokens")
      .insert([{
        user_id: data.uuid,
        token: verificationToken,
        expires_at: expiresAt.toISOString(),
        used: false
      }])

    if (tokenError) {
      console.error('Error creating verification token:', tokenError)
      // Continue anyway - user is created, token can be regenerated if needed
    }

    // Get the base URL from environment or request
    const baseUrl = getBaseUrl(req)
    const verificationLink = `${baseUrl}/verify-email.html?token=${verificationToken}`

    // Send verification email
    const emailResult = await sendVerificationEmail(email, username, verificationLink, req)
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error)
      // Still return success to user, but log the error
      // The user can request a new verification email later if needed
    }

    // For development/testing: return the link in response if email failed or in dev mode
    const isDevelopment = !process.env.VERCEL || process.env.VERCEL_ENV === 'development'
    const shouldReturnLink = isDevelopment || !emailResult.success

    return res.status(200).json({ 
      message: "Registration successful. Please check your email to verify your account.",
      // Only return link in development or if email sending failed (for testing/debugging)
      ...(shouldReturnLink && { verificationLink })
    })
  } catch (err) {
    console.error("Registration error:", err)
    res.status(500).json({ error: err.message || "Internal Server Error" })
  }
}
