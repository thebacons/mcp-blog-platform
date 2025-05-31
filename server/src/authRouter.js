// src/authRouter.js
import express from 'express';
import logger from './logger.js';
import * as googleAuthService from './services/googleAuthService.js';

const router = express.Router();

/**
 * Route to begin Google OAuth flow
 */
router.get('/google', (req, res) => {
  try {
    const authUrl = googleAuthService.getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error starting Google auth flow:', error);
    res.status(500).json({ error: 'Authentication failed to start' });
  }
});

/**
 * OAuth callback route
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code missing' });
    }
    
    // Exchange code for tokens
    const { tokens, user } = await googleAuthService.getTokensFromCode(code);
    
    // In a real application, you would store these tokens securely
    // For this demo, we'll show them to be copied to .env file
    const tokensDisplay = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(tokens.expiry_date).toISOString()
    };
    
    // Render a page showing the tokens (for demo purposes only)
    res.send(`
      <h1>Authentication Successful!</h1>
      <p>Welcome, ${user.name} (${user.email})</p>
      <h2>Your tokens (copy these to your .env file):</h2>
      <pre>GOOGLE_PHOTOS_ACCESS_TOKEN=${tokens.access_token}</pre>
      <pre>GOOGLE_PHOTOS_REFRESH_TOKEN=${tokens.refresh_token}</pre>
      <p>Access token expires at: ${new Date(tokens.expiry_date).toLocaleString()}</p>
      <p><strong>Note:</strong> In a production application, tokens should be stored securely.</p>
    `);
  } catch (error) {
    logger.error('Error in OAuth callback:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
