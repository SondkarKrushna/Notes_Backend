const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Otp = require("../models/Otp");

// Generate OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

//
// ================= SEND OTP =================
//
router.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number required" });
    }

    let otp =
      process.env.NODE_ENV === "development"
        ? process.env.STATIC_OTP
        : generateOTP();

    const hashedOtp = await bcrypt.hash(otp, 10);

    await Otp.findOneAndUpdate(
      { phone },
      {
        otp: hashedOtp,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      { upsert: true, new: true }
    );

    console.log("Generated OTP:", otp);

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//
// ================= REGISTER =================
//
router.post("/register", async (req, res) => {
  try {
    const { name, phone, otp } = req.body;

    const storedOtp = await Otp.findOne({ phone });

    if (!storedOtp)
      return res.status(400).json({ message: "OTP not found" });

    if (storedOtp.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    const isMatch = await bcrypt.compare(otp, storedOtp.otp);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid OTP" });

    const existingUser = await User.findOne({ phone });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const user = await User.create({ name, phone });

    await Otp.deleteOne({ phone });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Registration successful",
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//
// ================= LOGIN =================
//
router.post("/login", async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({ phone });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    const storedOtp = await Otp.findOne({ phone });
    if (!storedOtp)
      return res.status(400).json({ message: "OTP not found" });

    if (storedOtp.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    const isMatch = await bcrypt.compare(otp, storedOtp.otp);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid OTP" });

    await Otp.deleteOne({ phone });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;