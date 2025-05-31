// src/services/googleAuthService.js
import axios from 'axios';
import { google } from 'googleapis';
import logger from '../logger.js';

// Google OAuth configuration
const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/auth/google/callback'
};

// Log OAuth configuration for debugging (omitting secret)
logger.info(`Google OAuth Config: clientId=${GOOGLE_OAUTH_CONFIG.clientId?.substring(0, 8)}..., redirectUri=${GOOGLE_OAUTH_CONFIG.redirectUri}`);

// Scopes required for Google Photos access
const SCOPES = [
  'https://www.googleapis.com/auth/photoslibrary.readonly', // Read-only access to Google Photos
  'https://www.googleapis.com/auth/userinfo.profile', // Basic profile info
  'https://www.googleapis.com/auth/userinfo.email' // Email
];

/**
 * Create an OAuth2 client for Google API authentication
 * @returns {OAuth2Client} Google OAuth2 client
 */
function createOAuth2Client() {
  const { clientId, clientSecret, redirectUri } = GOOGLE_OAUTH_CONFIG;
  
  if (!clientId || !clientSecret) {
    logger.error('Google OAuth credentials not configured');
    throw new Error('Google OAuth credentials missing');
  }
  
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate a Google OAuth authorization URL
 * @returns {string} Authorization URL to redirect the user to
 */
export function getAuthUrl() {
  try {
    const oauth2Client = createOAuth2Client();
    
    return oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get a refresh token for server-side use
      scope: SCOPES,
      prompt: 'consent' // Force the consent screen to ensure getting refresh token
    });
  } catch (error) {
    logger.error('Error generating auth URL:', error);
    throw error;
  }
}

/**
 * Exchange authorization code for access and refresh tokens
 * @param {string} code - Authorization code from Google OAuth
 * @returns {Promise<Object>} Tokens and user info
 */
export async function getTokensFromCode(code) {
  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    // Set credentials to client for immediate use
    oauth2Client.setCredentials(tokens);
    
    // Get user info
    const userInfo = await getUserInfo(tokens.access_token);
    
    return {
      tokens,
      user: userInfo
    };
  } catch (error) {
    logger.error('Error getting tokens from code:', error);
    throw error;
  }
}

/**
 * Refresh an expired access token using a refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} New access token info
 */
export async function refreshAccessToken(refreshToken) {
  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    return {
      access_token: credentials.access_token,
      expires_at: Date.now() + credentials.expiry_date,
      token_type: credentials.token_type
    };
  } catch (error) {
    logger.error('Error refreshing access token:', error);
    throw error;
  }
}

/**
 * Get user profile information using an access token
 * @param {string} accessToken - Google access token
 * @returns {Promise<Object>} User profile information
 */
async function getUserInfo(accessToken) {
  try {
    const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    logger.error('Error getting user info:', error);
    throw error;
  }
}

/**
 * Get a configured OAuth2 client with valid credentials
 * @param {string} refreshToken - Refresh token for the user
 * @returns {Promise<OAuth2Client>} Configured OAuth2 client
 */
export async function getAuthorizedClient(refreshToken) {
  try {
    const oauth2Client = createOAuth2Client();
    
    // Set the refresh token
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    
    // Force token refresh
    await oauth2Client.refreshAccessToken();
    
    return oauth2Client;
  } catch (error) {
    logger.error('Error getting authorized client:', error);
    throw error;
  }
}

export default {
  getAuthUrl,
  getTokensFromCode,
  refreshAccessToken,
  getAuthorizedClient
};
