// src/middleware/apiKeyAuth.js
import logger from '../logger.js';

export const apiKeyAuth = (validApiKeysEnvVar) => {
  return (req, res, next) => {
    const apiKey = req.header('X-API-Key');
    const allowedKeys = (validApiKeysEnvVar || '').split(',').map(key => key.trim()).filter(key => key.length > 0);

    if (!apiKey) {
      logger.warn('API key missing from request');
      return res.status(401).json({ error: 'Unauthorized: API key is missing.' });
    }

    if (allowedKeys.length === 0) {
        logger.error('No API keys configured on the server. Denying all requests.');
        return res.status(500).json({ error: 'Server configuration error: No API keys set.' });
    }

    if (!allowedKeys.includes(apiKey)) {
      logger.warn(`Invalid API key received: ${apiKey}`);
      return res.status(403).json({ error: 'Forbidden: Invalid API key.' });
    }

    logger.debug('API key validated successfully.');
    next();
  };
};

export default apiKeyAuth;
