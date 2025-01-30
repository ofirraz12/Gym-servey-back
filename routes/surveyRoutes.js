const express = require("express");
const router = express.Router();
const pool = require("../db");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
require("dotenv").config();

// Google OAuth2 Credentials
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "https://developers.google.com/oauthplayground";
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const sendEmail = async (email) => {
  try {
    console.log("📧 Attempting to send email to:", email);

    const accessTokenResponse = await oAuth2Client.getAccessToken();
    if (!accessTokenResponse.token) {
      console.error("❌ Failed to generate access token");
      return;
    }

    console.log("✅ Access token generated:", accessTokenResponse.token);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: accessTokenResponse.token,
      },
    });

    const mailOptions = {
      from: `"Gym App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Thank You for Participating! 🎉",
      text: `תודה שמילאת את הסקר! 
בימים הקרובים נשלח איימל נוסף ובו נסביר לעומק על האפליקציה והחזון שלנו. 
המשך יום נהדר! 😊

🔹 קוד ההנחה שלך: GYM20`,
     };

    console.log("🚀 Sending email now...");
    const result = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", result);
  } catch (error) {
    console.error("❌ Error sending email:", error);

    // Log detailed error info
    if (error.response) {
      console.error("📌 Google API Error Response:", error.response.data);
    }
    if (error.config) {
      console.error("📌 Google API Error Config:", error.config);
    }
  }
};


// 🛠️ API Route: Save survey responses & send email
router.post("/submit", async (req, res) => {
  const {
    age,
    trainingDuration,
    trainingPlan,
    beginnerHelp,
    aiHelp,
    teenSocial,
    trainingChallenge,
    researchInterest,
    email,
  } = req.body;

  try {
    console.log("📝 Received survey submission for:", email);

    // Insert new survey response first
    const result = await pool.query(
      `INSERT INTO surveys (age, training_duration, training_plan, beginner_help, ai_help, teen_social, training_challenge, research_interest, email) 
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [age, trainingDuration, trainingPlan, beginnerHelp, aiHelp, teenSocial, trainingChallenge, researchInterest, email]
    );

    console.log("✅ Survey data saved to database.");

    // Now check if the email exists and send email
    const existingUser = await pool.query("SELECT * FROM surveys WHERE email = $1", [email]);

    if (existingUser.rows.length > 0) {
      console.log("📧 Email exists, sending thank you email...");
      await sendEmail(email);
    } else {
      console.log("❌ Email check failed after insert.");
    }

    res.json({ success: true, survey: result.rows[0] });
  } catch (err) {
    console.error("❌ Error handling survey submission:", err);
    res.status(500).json({ error: "Failed to process the survey." });
  }
});

module.exports = router;
