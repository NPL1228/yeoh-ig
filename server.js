import express from 'express';
import cors from 'cors';
import { IgApiClient } from 'instagram-private-api';
import nodemailer from 'nodemailer';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Database setup
const db = await open({
  filename: './database.sqlite',
  driver: sqlite3.Database
});

await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    trial_start_date TEXT,
    subscription_type TEXT,
    subscription_end_date TEXT
  );
`);

// Instagram API client
const ig = new IgApiClient();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const trialStartDate = new Date().toISOString();
    
    await db.run(
      'INSERT INTO users (email, password, trial_start_date, subscription_type) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, trialStartDate, 'trial']
    );

    res.json({ message: 'Registration successful' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Extract Instagram followers
app.post('/api/extract-followers', authenticateToken, async (req, res) => {
  try {
    const { username } = req.body;
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    
    // Check subscription status
    const isTrialUser = user.subscription_type === 'trial';
    const trialExpired = new Date(user.trial_start_date) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    if (isTrialUser && trialExpired) {
      return res.status(403).json({ error: 'Trial period expired' });
    }

    // Instagram login
    ig.state.generateDevice(process.env.IG_USERNAME);
    await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
    
    // Get user followers
    const targetUser = await ig.user.searchExact(username);
    const followers = await ig.feed.accountFollowers(targetUser.pk).items();
    
    // Remove duplicates
    const uniqueFollowers = Array.from(new Set(followers.map(f => f.username)))
      .map(username => {
        const follower = followers.find(f => f.username === username);
        return {
          username: follower.username,
          fullName: follower.full_name,
          isPrivate: follower.is_private,
          profilePicUrl: follower.profile_pic_url
        };
      });

    // Limit results for trial users
    const results = isTrialUser ? uniqueFollowers.slice(0, 1000) : uniqueFollowers;
    
    res.json({
      followers: results,
      total: uniqueFollowers.length,
      limited: isTrialUser
    });
  } catch (error) {
    res.status(500).json({ error: 'Follower extraction failed' });
  }
});

// Bulk message sending
app.post('/api/send-messages', authenticateToken, async (req, res) => {
  try {
    const { platform, recipients, message } = req.body;
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

    // Validate subscription
    if (user.subscription_type === 'trial') {
      const trialExpired = new Date(user.trial_start_date) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      if (trialExpired) {
        return res.status(403).json({ error: 'Trial period expired' });
      }
    }

    let results = [];

    switch (platform) {
      case 'instagram':
        // Instagram DM sending
        ig.state.generateDevice(process.env.IG_USERNAME);
        await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
        
        for (const username of recipients) {
          try {
            const user = await ig.user.searchExact(username);
            const thread = ig.entity.directThread([user.pk.toString()]);
            await thread.broadcastText(message);
            results.push({ username, status: 'success' });
          } catch (error) {
            results.push({ username, status: 'failed', error: error.message });
          }
        }
        break;

      case 'gmail':
        // Gmail sending
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
          }
        });

        for (const email of recipients) {
          try {
            await transporter.sendMail({
              from: process.env.GMAIL_USER,
              to: email,
              subject: 'Bulk Message',
              text: message
            });
            results.push({ email, status: 'success' });
          } catch (error) {
            results.push({ email, status: 'failed', error: error.message });
          }
        }
        break;
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Message sending failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});