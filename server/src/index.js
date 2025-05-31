import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import logger from './logger.js';
import { apiKeyAuth } from './middleware/apiKeyAuth.js';
import registry from './registry.js';
import services from './services/index.js';
import agentRouter from './agentRouter.js';
import authRouter from './authRouter.js';

dotenv.config();
console.log('Loaded AGENT_REGISTRATION_API_KEYS:', process.env.AGENT_REGISTRATION_API_KEYS);
console.log('Loaded ORCHESTRATOR_OUTBOUND_API_KEYS:', process.env.ORCHESTRATOR_OUTBOUND_API_KEYS);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('MCP Orchestrator is running!');
});

// Mount the agent router
app.use('/api/agents', agentRouter);

// Mount the authentication router
app.use('/api/auth', authRouter);

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong', status: 'ok', time: new Date().toISOString() });
});

// Register an agent with capabilities
app.post('/api/register',
  apiKeyAuth(process.env.AGENT_REGISTRATION_API_KEYS),
  (req, res) => {
    try {
      logger.info('Agent registration attempt:', req.body);
      registry.registerAgent(req.body);
      res.status(201).json({ 
        message: 'Agent registered successfully', 
        agentId: req.body.agentId 
      });
    } catch (err) {
      logger.error('Error registering agent:', err.message);
      res.status(400).json({ error: err.message });
    }
  }
);

// Process messages and route to appropriate capability handlers
app.post('/api/message',
  apiKeyAuth(process.env.ORCHESTRATOR_OUTBOUND_API_KEYS),
  async (req, res) => {
    logger.info('Message received:', req.body);
    try {
      const { capability, payload, messageId } = req.body;
      
      // Handle blog-writing capability directly with Gemini
      if (capability === 'blog-writing') {
        if (!payload || !payload.text) {
          return res.status(400).json({ error: 'Missing text for blog writing.' });
        }
        const blog_post = await services.geminiService.generateBlogPost(payload.text);
        return res.status(200).json({ blog_post });
      }
      
      // Handle enhanced-blog-writing capability
      if (capability === 'enhanced-blog-writing') {
        if (!payload || !payload.text) {
          return res.status(400).json({ error: 'Missing text for enhanced blog writing.' });
        }
        const blog_post = await services.geminiService.generateEnhancedBlogPost(payload);
        return res.status(200).json({ blog_post });
      }
      
      // For other capabilities, find registered agents and route to them
      const agents = registry.findAgentsByCapability(capability);
      if (agents.length === 0) {
        return res.status(404).json({ 
          error: `No agents found with capability: ${capability}` 
        });
      }
      
      // In a real implementation, you would route to the agent
      // For now, return a placeholder response
      res.status(200).json({ 
        message: 'Message received and will be routed', 
        messageId,
        capability,
        agentCount: agents.length,
        agents: agents.map(a => a.agentId)
      });
    } catch (err) {
      logger.error('Error in /api/message:', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// Photo metadata capability
app.post('/api/capabilities/photo-metadata',
  apiKeyAuth(process.env.ORCHESTRATOR_OUTBOUND_API_KEYS),
  async (req, res) => {
    try {
      const { photoUrl } = req.body;
      if (!photoUrl) {
        return res.status(400).json({ error: 'Missing photoUrl parameter' });
      }
      
      const metadata = await services.photoService.getPhotoMetadata(photoUrl);
      res.status(200).json({ metadata });
    } catch (err) {
      logger.error('Error processing photo metadata:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Weather & environmental data capability
app.post('/api/capabilities/environmental-data',
  apiKeyAuth(process.env.ORCHESTRATOR_OUTBOUND_API_KEYS),
  async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Missing coordinates' });
      }
      
      const data = await services.weatherService.getWeatherData(latitude, longitude);
      res.status(200).json(data);
    } catch (err) {
      logger.error('Error fetching environmental data:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// News capability
app.post('/api/capabilities/latest-news',
  apiKeyAuth(process.env.ORCHESTRATOR_OUTBOUND_API_KEYS),
  async (req, res) => {
    try {
      const { topic } = req.body;
      const news = await services.newsService.getLatestNews(topic || 'AI');
      res.status(200).json(news);
    } catch (err) {
      logger.error('Error fetching news:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Location detection capability
app.post('/api/capabilities/detect-location',
  apiKeyAuth(process.env.ORCHESTRATOR_OUTBOUND_API_KEYS),
  async (req, res) => {
    try {
      // Get client IP address
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      
      // Get any client-provided geolocation data (from browser API)
      const { browserLocation } = req.body;
      
      // Detect location using best available method
      const location = await services.locationService.detectClientLocation({
        clientIP: clientIp,
        browserLocation
      });
      
      res.status(200).json({ location });
    } catch (err) {
      logger.error('Error detecting location:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Title generation capability
app.post('/api/capabilities/generate-title',
  apiKeyAuth(process.env.ORCHESTRATOR_OUTBOUND_API_KEYS),
  async (req, res) => {
    try {
      const { content, metadata } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Missing content for title generation' });
      }
      
      const titleInfo = await services.titleService.generateTitleWithDate(content, metadata);
      res.status(200).json(titleInfo);
    } catch (err) {
      logger.error('Error generating title:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Today's photos capability
app.post('/api/capabilities/todays-photos',
  apiKeyAuth(process.env.ORCHESTRATOR_OUTBOUND_API_KEYS),
  async (req, res) => {
    try {
      const photos = await services.photoService.getTodaysPhotos();
      res.status(200).json({ photos });
    } catch (err) {
      logger.error('Error fetching today\'s photos:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Try to start the server with automatic port retry if the port is in use
let currentPort = PORT;
const MAX_PORT_ATTEMPTS = 10;

function startServer(port, attempt = 1) {
  // Ensure port is a number
  const numericPort = parseInt(port, 10);
  
  const server = app.listen(numericPort)
    .on('listening', () => {
      logger.info(`MCP Orchestrator listening on port ${numericPort}`);
      app.set('port', numericPort); // Store the actual port used
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
        const nextPort = numericPort + 1;
        logger.warn(`Port ${numericPort} is in use, trying port ${nextPort}`);
        server.close();
        // Try the next port
        startServer(nextPort, attempt + 1);
      } else {
        logger.error(`Could not start server: ${err.message}`);
        if (attempt >= MAX_PORT_ATTEMPTS) {
          logger.error(`Failed to find an available port after ${MAX_PORT_ATTEMPTS} attempts`);
        }
        process.exit(1);
      }
    });

  return server;
}

// Start the server with automatic port retry
const server = startServer(currentPort);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
