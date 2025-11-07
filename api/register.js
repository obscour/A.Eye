import supabase from './_supabaseClient.js'
import { randomUUID } from 'crypto'

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const body = req.body || {}
    const { firstName, lastName, username, email, password, role } = body

    if (!firstName || !lastName || !username || !email || !password || !role) {
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

    // Create new user
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          uuid: randomUUID(),
          first_name: firstName,
          last_name: lastName,
          username,
          email,
          password, // ⚠️ Plaintext for now (add hashing later)
          role,
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

    // Return user with id field for frontend compatibility
    const user = {
      ...data,
      id: data.uuid
    }

    return res.status(200).json({ message: "Registration successful", user })
  } catch (err) {
    console.error("Registration error:", err)
    res.status(500).json({ error: err.message || "Internal Server Error" })
  }
}
