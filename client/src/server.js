import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5173;
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:4000';
const AGENT_REGISTRATION_API_KEY = process.env.AGENT_REGISTRATION_API_KEY;
const ORCHESTRATOR_OUTBOUND_API_KEY = process.env.ORCHESTRATOR_OUTBOUND_API_KEY;

app.use(cors());
app.use(express.json());

// Health check proxy
app.get('/api/ping', async (req, res) => {
  try {
    const resp = await axios.get(`${ORCHESTRATOR_URL}/`);
    res.json({ status: 'ok', orchestrator: resp.data });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Register agent
app.post('/api/register', async (req, res) => {
  try {
    const resp = await axios.post(`${ORCHESTRATOR_URL}/register`, req.body, {
      headers: {
        'X-API-Key': req.headers['x-api-key'] || AGENT_REGISTRATION_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    res.json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
});

// Send message
app.post('/api/message', async (req, res) => {
  try {
    const resp = await axios.post(`${ORCHESTRATOR_URL}/message`, req.body, {
      headers: {
        'X-API-Key': req.headers['x-api-key'] || ORCHESTRATOR_OUTBOUND_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    res.json(resp.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message });
  }
});

// Enhanced blog writing endpoint
app.post('/api/message', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || ORCHESTRATOR_OUTBOUND_API_KEY;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key is required' });
    }

    const { capability, payload } = req.body;
    
    if (capability !== 'enhanced-blog-writing') {
      // Forward other capabilities to the default handler
      const response = await axios.post(
        `${ORCHESTRATOR_URL}/message`,
        req.body,
        {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      return res.json(response.data);
    }

    // Handle enhanced-blog-writing capability
    if (!payload || !payload.topic) {
      return res.status(400).json({ error: 'Blog topic is required' });
    }

    // Forward the request to the orchestrator with the correct format
    const response = await axios.post(
      `${ORCHESTRATOR_URL}/message`,
      {
        capability: 'enhanced-blog-writing',
        data: payload
      },
      {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error('Error in message handling:', err.message);
    res.status(err.response?.status || 500).json(
      err.response?.data || { error: err.message }
    );
  }
});

app.listen(PORT, () => {
  console.log(`Orchestrator client proxy running on http://localhost:${PORT}`);
});
