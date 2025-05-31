// testAuth.js - A simplified Google OAuth test
import express from 'express';
import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const app = express();
const PORT = 4000;

// Get credentials from environment variables
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:4000/oauth2callback';

// Create an OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Define the scopes
const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

// Start route - redirect to Google auth
app.get('/auth', (req, res) => {
  console.log('Auth attempt with:', { 
    clientId: CLIENT_ID?.substring(0, 10) + '...',
    redirectUri: REDIRECT_URI
  });
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    include_granted_scopes: true,
    prompt: 'consent'
  });
  
  console.log('Redirecting to:', authUrl);
  res.redirect(authUrl);
});

// Callback route
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization code is missing');
  }
  
  try {
    console.log('Got authorization code, exchanging for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Got tokens:', {
      access_token: tokens.access_token?.substring(0, 10) + '...',
      refresh_token: tokens.refresh_token ? 'Present' : 'Not present',
      expiry_date: new Date(tokens.expiry_date).toISOString()
    });
    
    res.send(`
      <h1>Authentication Successful!</h1>
      <h2>Your tokens:</h2>
      <pre>GOOGLE_PHOTOS_ACCESS_TOKEN=${tokens.access_token}</pre>
      <pre>GOOGLE_PHOTOS_REFRESH_TOKEN=${tokens.refresh_token || 'Not provided'}</pre>
      <p>Access token expires at: ${new Date(tokens.expiry_date).toLocaleString()}</p>
    `);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Test OAuth server running at http://localhost:${PORT}`);
  console.log(`Go to http://localhost:${PORT}/auth to start the OAuth flow`);
});
