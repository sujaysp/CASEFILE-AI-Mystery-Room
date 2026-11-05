const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 40,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // Password-based accounts have a bcrypt hash. Google-only accounts do not.
    passwordHash: {
      type: String,
      required: false,
      select: false,
    },
    // Google's stable subject identifier. Sparse unique index leaves local accounts unaffected.
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
