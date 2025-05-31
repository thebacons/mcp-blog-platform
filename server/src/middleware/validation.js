// src/middleware/validation.js
import logger from '../logger.js';

/**
 * Middleware for JSON schema validation
 * @param {string} schemaName - The name of the schema to validate against
 * @returns {Function} Express middleware function
 */
export const validateSchema = (schemaName) => {
  return (req, res, next) => {
    // In a production app, you would use a schema validation library like Ajv
    // For now, we'll do some basic validation

    logger.info(`Validating request against schema: ${schemaName}`);
    
    // Basic validation for message schema
    if (schemaName === 'message') {
      // Check that it has the necessary fields
      if (!req.body) {
        return res.status(400).json({ error: 'Request body is required' });
      }
      
      // For capability endpoints, validate based on capability requirements
      if (req.path.startsWith('/capability/') && !req.params.name) {
        return res.status(400).json({ error: 'Capability name is required' });
      }
      
      // For blog generation, validate the text field
      if (req.path === '/generate-blog' && (!req.body.text || typeof req.body.text !== 'string')) {
        return res.status(400).json({ error: 'Text field is required and must be a string' });
      }
    }
    
    // If validation passes, continue to the next middleware/route handler
    next();
  };
};

export default {
  validateSchema
};
