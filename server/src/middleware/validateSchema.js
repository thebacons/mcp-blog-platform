// src/middleware/validateSchema.js
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import logger from '../logger.js';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv); 

export const validateSchema = (schema) => {
  if (!schema) {
    logger.error('Schema not provided to validateSchema middleware. This is a server-side configuration error.');
    return (req, res, next) => {
        logger.error(`Misconfiguration: validateSchema middleware used without a schema for path ${req.path}`);
        res.status(500).json({ error: 'Server configuration error: Schema validation cannot be performed.' });
    };
  }

  const validate = ajv.compile(schema);

  return (req, res, next) => {
    if (!validate(req.body)) {
      logger.warn('Schema validation failed:', { path: req.path, errors: validate.errors });
      return res.status(400).json({
        error: 'Bad Request: Schema validation failed.',
        details: validate.errors.map(err => ({
          path: err.instancePath || 'body',
          message: err.message,
          params: err.params
        }))
      });
    }
    logger.debug(`Schema validation successful for path: ${req.path}`);
    next();
  };
};

export default validateSchema;
