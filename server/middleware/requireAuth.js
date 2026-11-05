const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Please sign in to access this resource.",
      code: "AUTH_REQUIRED",
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured on the server.",
      code: "AUTH_NOT_CONFIGURED",
    });
  }

  let payload;

  try {
    payload = jwt.verify(token, secret, {
      issuer: "casefile-api",
      audience: "casefile-client",
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Your session has expired or is invalid. Please sign in again.",
      code: "INVALID_TOKEN",
    });
  }

  try {
    const user = await User.findById(payload.sub).select("_id name email");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Your session is no longer valid. Please sign in again.",
        code: "INVALID_SESSION",
      });
    }

    req.user = {
      id: String(user._id),
      userId: String(user._id),
      name: user.name,
      email: user.email,
    };

    return next();
  } catch (error) {
    console.error("Authentication user lookup failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to validate your session right now.",
      code: "AUTH_LOOKUP_FAILED",
    });
  }
}

module.exports = requireAuth;