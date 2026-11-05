const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Mystery = require("../models/Mystery");

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
  };
}

function createToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }

  return jwt.sign(
    { sub: String(user._id) },
    secret,
    {
      expiresIn: "7d",
      issuer: "casefile-api",
      audience: "casefile-client",
    }
  );
}

// POST /api/auth/register
async function register(req, res) {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured on the server.",
    });
  }
  if (name.length < 2 || name.length > 40) {
    return res.status(400).json({
      success: false,
      message: "Name must be between 2 and 40 characters.",
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({
      success: false,
      message: "Please enter a valid email address.",
    });
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({
      success: false,
      message: "Password must be between 8 and 72 characters.",
    });
  }

  try {
    const isFirstAccount = (await User.countDocuments()) === 0;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });

    if (isFirstAccount) {
      const adoption = await Mystery.updateMany(
        { userId: null },
        { $set: { userId: user._id } }
      );
      console.info(
        `Legacy Casefile records adopted by the first account: ${adoption.modifiedCount || 0}`
      );
    }

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }
    console.error("Account registration failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to create your account right now.",
    });
  }
}

// POST /api/auth/login
async function login(req, res) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured on the server.",
    });
  }

  try {
    const user = await User.findOne({ email }).select("+passwordHash");
    const passwordMatches =
      Boolean(user?.passwordHash) && await bcrypt.compare(password, user.passwordHash);

    if (!user || !passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Email or password is incorrect.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Signed in successfully.",
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Account login failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to sign in right now.",
    });
  }
}

// GET /api/auth/me
async function getCurrentUser(req, res) {
  return res.status(200).json({ success: true, user: req.user });
}

module.exports = { register, login, getCurrentUser, publicUser, createToken };
