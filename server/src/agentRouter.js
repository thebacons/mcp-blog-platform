import express from 'express';
import axios from 'axios';
import logger from './logger.js';
import { apiKeyAuth } from './middleware/apiKeyAuth.js';
import { validateSchema } from './middleware/validation.js';
import { getAgentByCapability, getAgentEndpoint } from './registry.js';

// Import service modules
import * as photoService from './services/photoService.js';
import * as titleService from './services/titleService.js';
import { getWeatherData } from './services/weatherService.js';

const router = express.Router();

// Apply authentication middleware to all agent routes
router.use(apiKeyAuth);

/**
 * Forwards a blog-writing request to the Flask Gemini agent and returns the response.
 * @param {string} text - The blog note to send.
 * @returns {Promise<string>} - The generated blog post.
 */
async function routeBlogWriting(text) {
  try {
    const response = await axios.post('http://localhost:5000/callback', { payload: { text } });
    if (response.data && response.data.blog_post) {
      return response.data.blog_post;
    }
    throw new Error('No blog_post in response from agent.');
  } catch (err) {
    logger.error('Error forwarding to blog agent:', err.message);
    throw new Error('Failed to generate blog post: ' + err.message);
  }
}

/**
 * Generates an enhanced blog with rich context including photos, location, weather, and more.
 * @param {Object} enhancedContext - Rich context for blog generation
 * @param {string} enhancedContext.topic - The main blog topic/notes
 * @param {string} enhancedContext.date - The formatted date string
 * @param {Array} enhancedContext.photos - Array of photo objects with metadata
 * @param {string} enhancedContext.location - Location name
 * @param {Object} enhancedContext.weather - Weather data including current conditions and forecast
 * @param {Array} enhancedContext.news - News topics to include
 * @returns {Promise<Object>} - The generated blog with HTML content
 */
async function generateBlog(enhancedContext) {
  try {
    logger.info('Generating enhanced blog with rich context');
    
    // Format the enhanced context for the blog generation
    const formattedContext = {
      topic: enhancedContext.topic,
      date: enhancedContext.date,
      location: enhancedContext.location,
      photos: enhancedContext.photos,
      weather: null,
      newsTopics: enhancedContext.news
    };
    
    // Add weather information with forecast if available
    if (enhancedContext.weather) {
      // Current weather
      const current = enhancedContext.weather.current;
      formattedContext.weather = {
        current: {
          temperature: current.temperature,
          conditions: current.conditions,
          feelsLike: current.feelsLike,
          humidity: current.humidity,
          windSpeed: current.windSpeed
        }
      };
      
      // Add forecast if available
      if (enhancedContext.weather.forecast && enhancedContext.weather.forecast.length > 0) {
        formattedContext.weather.forecast = enhancedContext.weather.forecast;
        logger.info(`Including ${formattedContext.weather.forecast.length}-day forecast in blog`);
      }
    }
    
    // Prepare prompt for the blog generation
    const promptText = `Write a detailed blog post about my day based on the following information:\n
      Topic or Notes: ${formattedContext.topic || 'My day today'}\n
      Date: ${formattedContext.date}\n
      ${formattedContext.location ? `Location: ${formattedContext.location}\n` : ''}\n
      ${formattedContext.photos && formattedContext.photos.length > 0 ?
        `Photos: I took ${formattedContext.photos.length} photos today. 
        ${formattedContext.photos.map(photo => 
          `${photo.description ? photo.description : ''}
          ${photo.people && photo.people.length > 0 ? `People in this photo: ${photo.people.join(', ')}` : ''}
          ${photo.location ? `Location: ${photo.location}` : ''}`
        ).join('\n')}` : ''}\n
      ${formattedContext.weather ? 
        `Weather: Currently ${formattedContext.weather.current.temperature}, ${formattedContext.weather.current.conditions}.
        ${formattedContext.weather.current.feelsLike ? `Feels like ${formattedContext.weather.current.feelsLike}.` : ''}
        ${formattedContext.weather.current.humidity ? `Humidity: ${formattedContext.weather.current.humidity}.` : ''}
        ${formattedContext.weather.forecast ? 
          `Weather forecast: 
          ${formattedContext.weather.forecast.map(day => 
            `${day.day}: High ${day.high}, Low ${day.low}, ${day.conditions}`
          ).join('\n')}` : ''}` : ''}\n
      ${formattedContext.newsTopics && formattedContext.newsTopics.length > 0 ?
        `News topics of interest: ${formattedContext.newsTopics.join(', ')}` : ''}
    `;
    
    // Call the blog generation API
    const response = await axios.post('http://localhost:5000/callback', { 
      payload: { text: promptText }
    });
    
    if (response.data && response.data.blog_post) {
      // Format blog post as HTML
      const blogHtml = formatBlogAsHtml(response.data.blog_post, enhancedContext);
      
      return {
        success: true,
        blog_content: blogHtml,
        raw_content: response.data.blog_post
      };
    }
    
    throw new Error('No blog_post in response from agent.');
  } catch (error) {
    logger.error('Error generating enhanced blog:', error.message);
    throw new Error(`Failed to generate enhanced blog: ${error.message}`);
  }
}

/**
 * Formats a plain text blog post as HTML with enhanced styling
 * @param {string} blogText - The raw blog text
 * @param {Object} context - The context used to generate the blog
 * @returns {string} - Formatted HTML
 */
function formatBlogAsHtml(blogText, context) {
  // Split into paragraphs
  const paragraphs = blogText.split('\n\n').filter(p => p.trim());
  
  // Format with basic HTML
  let html = '';
  
  // Add header with date and location
  html += `<h1>My Day - ${context.date}</h1>`;
  if (context.location) {
    html += `<h2>Location: ${context.location}</h2>`;
  }
  
  // Add weather section if available
  if (context.weather) {
    html += `<div class="weather-section">`;
    html += `<h3>Weather</h3>`;
    html += `<p>Currently ${context.weather.current.temperature}, ${context.weather.current.conditions}</p>`;
    
    // Add forecast if available
    if (context.weather.forecast && context.weather.forecast.length > 0) {
      html += `<div class="forecast">`;
      html += `<h4>Forecast</h4>`;
      html += `<ul>`;
      context.weather.forecast.forEach(day => {
        html += `<li>${day.day}: High ${day.high}, Low ${day.low}, ${day.conditions}</li>`;
      });
      html += `</ul>`;
      html += `</div>`;
    }
    
    html += `</div>`;
  }
  
  // Add blog content
  html += `<div class="blog-content">`;
  paragraphs.forEach(paragraph => {
    // Check if paragraph is a header (starts with # or ##)
    if (paragraph.startsWith('# ')) {
      html += `<h2>${paragraph.substring(2)}</h2>`;
    } else if (paragraph.startsWith('## ')) {
      html += `<h3>${paragraph.substring(3)}</h3>`;
    } else {
      html += `<p>${paragraph}</p>`;
    }
  });
  html += `</div>`;
  
  return html;
}

/**
 * Route for generating enhanced blog posts
 */
router.post('/generate-blog', validateSchema('message'), async (req, res) => {
  try {
    const { text, enhanceOptions = {} } = req.body;
    logger.info('Received blog generation request', { enhanceOptions });
    
    // Generate blog post using the Gemini agent
    const blogPost = await routeBlogWriting(text);
    
    // Apply enhancements based on options
    let enhancedBlog = blogPost;
    let metadata = {};
    
    if (enhanceOptions.includePhotos) {
      const photos = await photoService.getTodaysPhotos();
      metadata.photos = photos;
    }
    
    if (enhanceOptions.smartTitle) {
      const title = await titleService.generateSmartTitle(blogPost);
      metadata.title = title;
    }
    
    if (enhanceOptions.includeWeather && req.body.location) {
      const weatherData = await getWeatherData(req.body.location);
      metadata.weather = weatherData;
    }
    
    res.json({
      success: true,
      blog_post: enhancedBlog,
      metadata
    });
  } catch (error) {
    logger.error('Error in blog generation endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Route for dynamically calling agent capabilities based on capability name
 */
router.post('/capability/:name', validateSchema('message'), async (req, res) => {
  try {
    const { name } = req.params;
    const payload = req.body;
    
    logger.info(`Invoking capability: ${name}`);
    
    // Handle direct capabilities without agent forwarding
    if (name === 'todays-photos') {
      logger.info('Handling todays-photos capability directly');
      const photos = await photoService.getTodaysPhotos();
      return res.json(photos);
    }
    
    if (name === 'get-weather') {
      logger.info('Handling get-weather capability directly');
      try {
        // Extract coordinates, unit preference and number of forecast days
        const { latitude, longitude, units = 'metric', days = 3 } = payload;
        if (!latitude || !longitude) {
          return res.status(400).json({
            success: false,
            error: 'Missing required latitude and longitude for weather data'
          });
        }
        
        // Call weather service
        const weatherData = await getWeatherData({ latitude, longitude });
        
        logger.info(`Weather data obtained for ${latitude}, ${longitude}. Forecast days: ${weatherData.forecast?.length || 0}`);
        
        // Make sure we only return the requested number of forecast days
        if (weatherData.forecast && weatherData.forecast.length > days) {
          weatherData.forecast = weatherData.forecast.slice(0, days);
        }
        
        // Ensure all temperatures are in Celsius for consistency
        if (units === 'metric' && weatherData.current) {
          // Just log the unit consistency check - no conversion needed as our backend always returns Celsius
          logger.info('Ensuring temperature units are in Celsius');
        }
        
        return res.json(weatherData); // Return full weather object including forecast
        
      } catch (error) {
        logger.error('Error in get-weather capability:', error);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
    }
    
    if (name === 'enhanced-blog-writing') {
      try {
        logger.info('Processing enhanced blog writing request');
        
        // Extract the data from the request
        const {
          topic,
          selectedPhotos = [],
          locationData = {},
          weatherData = {},
          newsTopics = []
        } = req.body;
        
        // Construct a rich context for the blog
        const enhancedContext = {
          topic,
          date: new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          photos: selectedPhotos.map(photo => ({
            url: photo.url,
            location: photo.analysis?.location?.locationName || locationData?.name || null,
            people: photo.analysis?.people || [],
            description: photo.analysis?.description || ''
          })),
          location: locationData.name || null,
          weather: weatherData ? {
            current: {
              temperature: `${weatherData.temperature}${weatherData.unit || '°C'}`,
              conditions: weatherData.conditions || 'Unknown',
              feelsLike: weatherData.feelsLike ? `${weatherData.feelsLike}${weatherData.unit || '°C'}` : null,
              humidity: weatherData.humidity ? `${weatherData.humidity}%` : null,
              windSpeed: weatherData.windSpeed ? `${weatherData.windSpeed} km/h` : null,
            },
            forecast: weatherData.forecast ? weatherData.forecast.map(day => ({
              day: day.day,
              high: `${day.high}${weatherData.unit || '°C'}`,
              low: `${day.low}${weatherData.unit || '°C'}`,
              conditions: day.conditions
            })) : null
          } : null,
          news: newsTopics
        };
        
        logger.info(`Enhanced blog context: ${JSON.stringify({ 
          location: enhancedContext.location,
          weatherAvailable: !!enhancedContext.weather,
          forecastDays: enhancedContext.weather?.forecast?.length || 0,
          photoCount: enhancedContext.photos.length
        })}`);
        
        // Call the blog generation service
        const blogResult = await generateBlog(enhancedContext);
        
        // Return the generated blog
        return res.json(blogResult);
      } catch (error) {
        logger.error(`Error in enhanced-blog-writing capability: ${error.message}`);
        return res.status(500).json({ 
          error: 'Failed to generate enhanced blog', 
          message: error.message 
        });
      }
    }
    
    // For other capabilities, use the agent registry
    const agent = getAgentByCapability(name);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: `No agent registered for capability: ${name}`
      });
    }
    
    // Get the endpoint for the agent
    const endpoint = getAgentEndpoint(agent.id);
    
    // Forward the request to the agent
    const response = await axios.post(endpoint, {
      capability: name,
      payload
    });
    
    res.json({
      success: true,
      result: response.data
    });
    
  } catch (error) {
    logger.error(`Error invoking capability:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Note: getWeatherData is now imported from weatherService.js at the top of the file

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

export default router;
