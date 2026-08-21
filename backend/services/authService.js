import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleTokenAndGetUser = async (token) => {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  
  const payload = ticket.getPayload();
  const { sub: googleId, email, name, picture, email_verified } = payload;

  if (!email_verified) {
    throw new Error("Google email is not verified.");
  }

  let user = await User.findOne({ email });
  if (user) {
    if (!user.googleId) {
      user.googleId = googleId;
      user.picture = user.picture || picture;
      await user.save();
    }
  } else {
    user = await User.create({ googleId, email, name, picture });
  }

  const customJwt = jwt.sign(
    { userId: user._id, googleId, email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return { token: customJwt, user };
};
