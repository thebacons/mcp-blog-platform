// src/logger.js
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const { combine, timestamp, printf, colorize, align } = winston.format;

const customFormat = printf(({ level, message, timestamp: ts, ...metadata }) => {
  let msg = `${ts} [${level}]: ${message} `;
  if (Object.keys(metadata).length > 0) {
    const filteredMetadata = { ...metadata };
    delete filteredMetadata.level;
    delete filteredMetadata.timestamp;
    if (Object.keys(filteredMetadata).length > 0) {
        try {
            msg += JSON.stringify(filteredMetadata);
        } catch (e) {
            msg += '[UnserializableMetadata]';
        }
    }
  }
  return msg;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    colorize({ all: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    align(),
    customFormat
  ),
  transports: [
    new winston.transports.Console(),
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
  ]
});

export default logger;
