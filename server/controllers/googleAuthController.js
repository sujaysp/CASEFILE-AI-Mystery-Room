const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const Mystery = require("../models/Mystery");
const { createToken, publicUser } = require("./authController");

const googleClient = new OAuth2Client();

function isGoogleEmailAuthoritative(email, hostedDomain) {
  const normalizedEmail = email.toLowerCase();
  const emailDomain = normalizedEmail.split("@")[1] || "";

  // Google documents Gmail and verified Google Workspace domains as authoritative.
  if (emailDomain === "gmail.com") return true;
  return Boolean(hostedDomain && hostedDomain.toLowerCase() === emailDomain);
}

function safeDisplayName(value, email) {
  const candidate = typeof value === "string" ? value.trim() : "";
  const fallback = email.split("@")[0] || "Google User";
  const name = (candidate || fallback).slice(0, 40);
  return name.length >= 2 ? name : "Google User";
}

// POST /api/auth/google
async function googleLogin(req, res) {
  const credential =
    typeof req.body?.credential === "string" ? req.body.credential : "";
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(503).json({
      success: false,
      message: "Google sign-in has not been configured yet.",
      code: "GOOGLE_AUTH_NOT_CONFIGURED",
    });
  }

  if (!credential || credential.length > 12000) {
    return res.status(400).json({
      success: false,
      message: "Google did not provide a valid sign-in credential.",
      code: "GOOGLE_CREDENTIAL_REQUIRED",
    });
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured on the server.",
    });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.warn("Google ID token verification failed:", error.message);
    return res.status(401).json({
      success: false,
      message: "Google sign-in could not be verified. Please try again.",
      code: "GOOGLE_TOKEN_INVALID",
    });
  }

  const googleId = payload?.sub;
  const email = typeof payload?.email === "string"
    ? payload.email.trim().toLowerCase()
    : "";
  const emailVerified = payload?.email_verified === true;
  const hostedDomain = typeof payload?.hd === "string" ? payload.hd : "";

  if (
    !googleId ||
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !emailVerified ||
    !isGoogleEmailAuthoritative(email, hostedDomain)
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Use a verified Gmail or Google Workspace account to continue with Google.",
      code: "GOOGLE_EMAIL_NOT_VERIFIED",
    });
  }

  try {
    let user = await User.findOne({ googleId }).select("+googleId");

    if (!user) {
      // Link an existing email/password account only when Google's verified email is authoritative.
      const existingUser = await User.findOne({ email }).select("+googleId");

      if (existingUser) {
        if (existingUser.googleId && existingUser.googleId !== googleId) {
          return res.status(409).json({
            success: false,
            message: "This email is already linked to a different Google account.",
            code: "GOOGLE_ACCOUNT_CONFLICT",
          });
        }

        existingUser.googleId = googleId;
        await existingUser.save();
        user = existingUser;
      } else {
        const isFirstAccount = (await User.countDocuments()) === 0;
        user = await User.create({
          name: safeDisplayName(payload.name, email),
          email,
          googleId,
        });

        if (isFirstAccount) {
          const adoption = await Mystery.updateMany(
            { userId: null },
            { $set: { userId: user._id } }
          );
          console.info(
            `Legacy Casefile records adopted by the first Google account: ${adoption.modifiedCount || 0}`
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Signed in with Google successfully.",
      token: createToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This Google account is already linked to another CASEFILE account.",
        code: "GOOGLE_ACCOUNT_CONFLICT",
      });
    }

    console.error("Google account sign-in failed:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to sign in with Google right now.",
      code: "GOOGLE_LOGIN_FAILED",
    });
  }
}

module.exports = { googleLogin };
