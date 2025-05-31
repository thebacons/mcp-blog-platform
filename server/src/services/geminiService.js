// src/services/geminiService.js
import dotenv from 'dotenv';
import logger from '../logger.js';

// Helper function to safely stringify objects with circular references
const safeStringify = (obj, indent = 2) => {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) return '[Circular]';
      cache.add(value);
    }
    return value;
  }, indent);
};

dotenv.config();

// Helper function to safely access nested object properties
const safeGet = (obj, path, defaultValue = '') => {
  if (!obj) return defaultValue;
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    result = result?.[key];
    if (result === undefined || result === null) return defaultValue;
  }
  return result;
};

/**
 * Generate a simple blog post from user notes
 * @param {string} text - User's notes to transform into a blog post
 * @returns {Promise<string>} - Generated blog post with HTML formatting
 */
export async function generateBlogPost(text) {
  try {
    // For demo purposes, we'll return a formatted version of the text
    // This eliminates the need for a valid Gemini API key
    logger.info('Generating sample blog post from text:', text);
    
    const blogPost = `
    <h1>Blog Post: ${text}</h1>
    
    <h2>Introduction</h2>
    <p>Welcome to this blog post about "${text}". This is a demonstration of the MCP orchestrator
    with direct handling of blog generation capabilities.</p>
    
    <h2>Main Content</h2>
    <p>The MCP (Multi-Agent Control Plane) architecture allows for seamless communication between
    different components in an AI system. This orchestrator demonstrates how client requests can be
    routed to appropriate capabilities.</p>
    
    <h2>Conclusion</h2>
    <p>With this demonstration, we've shown how the MCP architecture can handle message routing based on
    capabilities, with the blog writing agent being one example.</p>
    `;
    
    logger.info('Sample blog post generated successfully');
    return blogPost;
  } catch (error) {
    logger.error('Error generating sample blog post:', error);
    throw new Error(`Failed to generate blog post: ${error.message}`);
  }
}

/**
 * Generate an enhanced blog post incorporating smart location, date-based title, today's photos, weather, and news
 * @param {Object} params - Parameters for blog generation
 * @param {string} params.text - User's notes to transform into a blog post
 * @param {Object} [params.photoMetadata] - Metadata from a photo including location
 * @param {Object} [params.weatherData] - Weather and environmental data
 * @param {Object} [params.newsData] - Recent news articles
 * @param {Object} [params.location] - Smart location detection data
 * @param {Object} [params.titleInfo] - Generated title with date information
 * @param {Array} [params.todaysPhotos] - Today's photos from Google Photos
 * @returns {Promise<string>} - Generated enhanced blog post with HTML formatting
 */
export async function generateEnhancedBlogPost(payload) {
  try {
    // Extract all parameters from the payload
    const {
      text = '',
      useDateTitle = true,
      useTodaysPhotos = true,
      usePhotoData = true,
      useSmartLocation = true,
      useWeatherData = true,
      useNewsData = true,
      selectedPhotos = [],
      newsTopics = [],
      locationData = {},
      weatherData = {},
      // These might be in the root or in a nested structure
      photoMetadata,
      newsData,
      titleInfo,
      todaysPhotos = selectedPhotos, // Fallback to selectedPhotos if todaysPhotos is not provided
    } = payload;

    // Log all incoming data for debugging
    logger.info('Generating enhanced blog post with data:', {
      text: text ? `${text.substring(0, 50)}...` : 'No text',
      useDateTitle,
      useTodaysPhotos,
      usePhotoData,
      useSmartLocation,
      useWeatherData,
      useNewsData,
      hasSelectedPhotos: selectedPhotos?.length > 0,
      hasNewsTopics: newsTopics?.length > 0,
      hasLocationData: Object.keys(locationData || {}).length > 0,
      hasWeatherData: Object.keys(weatherData || {}).length > 0,
      hasPhotoMetadata: !!photoMetadata,
      hasNewsData: !!newsData,
      hasTitleInfo: !!titleInfo,
      hasTodaysPhotos: Array.isArray(todaysPhotos) && todaysPhotos.length > 0
    });

    // Log detailed weather data if available
    if (weatherData && useWeatherData) {
      logger.debug('Weather data details:', {
        temperature: weatherData.temperature,
        conditions: weatherData.conditions,
        unit: weatherData.unit,
        isFallback: weatherData.isFallback,
        hasForecast: !!weatherData.forecast,
        forecastLength: weatherData.forecast?.length || 0
      });
    }
    
    // Log location data if available
    if (locationData && useSmartLocation) {
      logger.debug('Location data details:', {
        name: locationData.name,
        source: locationData.source,
        coordinates: locationData.coordinates
      });
    }
    
    logger.info('Generating enhanced blog post with external data', { 
      hasPhotoMetadata: !!photoMetadata,
      hasWeatherData: !!weatherData,
      hasNewsData: !!newsData,
      hasLocation: !!locationData,
      hasTitleInfo: !!titleInfo,
      hasTodaysPhotos: Array.isArray(todaysPhotos) && todaysPhotos.length > 0
    });
    
    // Use title info or generate a default title
    const title = safeGet(titleInfo, 'title', `Blog Post: ${text || 'Untitled'}`);
    const formattedDate = safeGet(
      titleInfo, 
      'formattedDate', 
      new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })
    );
    
    // Location context with enhanced handling
    let locationContext = '';
    if (useSmartLocation) {
      try {
        // Use locationData as the source for location information
        const locationSource = locationData || {};
        logger.debug('Processing location data:', safeStringify(locationSource));
        
        if (locationSource.name) {
          locationContext = `You're writing from ${locationSource.name}. `;
        } else if (locationSource.coordinates) {
          // If we have coordinates but no name, we can still use them
          const { latitude, longitude } = locationSource.coordinates || {};
          if (latitude !== undefined && longitude !== undefined) {
            locationContext = `You're writing from coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)}). `;
          }
        } else if (photoMetadata?.location) {
          const photoLocation = safeGet(photoMetadata, 'location.locationName');
          if (photoLocation) {
            locationContext = `You're writing from ${photoLocation}. `;
          }
        }
        
        if (!locationContext) {
          logger.debug('No valid location data found in any source');
        } else {
          logger.debug('Generated location context:', locationContext.trim());
        }
      } catch (locationError) {
        logger.error('Error processing location data:', {
          error: locationError.message,
          stack: locationError.stack
        });
        locationContext = '';
      }
    } else {
      logger.debug('Location context not included as per user preference');
    }
    
    // Weather context with enhanced error handling and logging
    let weatherContext = '';
    if (useWeatherData && weatherData) {
      try {
        logger.debug('Processing weather data:', safeStringify(weatherData));
        
        // Safely extract weather data with fallbacks and validation
        // Fix encoding for degree symbol
        const temp = weatherData.temperature !== undefined ? weatherData.temperature : 
                    (weatherData.current?.temperature !== undefined ? weatherData.current.temperature : null);
                    
        const conditions = weatherData.conditions || 
                         (weatherData.current?.conditions || '');
                         
        // Ensure proper degree symbol encoding
        const unit = weatherData.unit === 'Â°C' ? '°C' : (weatherData.unit || '°C');
        
        logger.debug('Extracted weather values:', { temp, conditions, unit });
        
        // Build weather description parts
        const weatherParts = [];
        if (temp !== null && temp !== undefined) {
          weatherParts.push(`${temp}${unit}`);
        }
        if (conditions) {
          weatherParts.push(conditions.toLowerCase());
        }
        
        // Build the weather context
        if (weatherParts.length > 0) {
          weatherContext = `The weather is currently ${weatherParts.join(' and ')}. `;
        }
        
        // Add forecast if available
        if (weatherData.forecast && Array.isArray(weatherData.forecast) && weatherData.forecast.length > 0) {
          const forecastText = weatherData.forecast.map(day => 
            `${day.day}: ${day.conditions} (High: ${day.high}${unit}, Low: ${day.low}${unit})`
          ).join('; ');
          
          if (forecastText) {
            weatherContext += `Forecast: ${forecastText}.`;
          }
        }
        
        logger.debug('Generated weather context:', weatherContext);
      } catch (weatherError) {
        logger.error('Error processing weather data:', {
          error: weatherError.message,
          stack: weatherError.stack,
          weatherData: safeStringify(weatherData)
        });
        weatherContext = 'Weather information is currently unavailable.';
      }
    } else {
      logger.debug('Weather data not included as per user preference');
    }
    
    // News context with enhanced handling
    let newsContext = '';
    if (useNewsData && newsData) {
      try {
        logger.debug('Processing news data:', safeStringify(newsData));
        
        // Handle both array format and object with articles property
        const articles = Array.isArray(newsData) 
          ? newsData 
          : (newsData.articles || []);
        
        if (Array.isArray(articles) && articles.length > 0) {
          const validArticles = articles
            .filter(article => article && article.title)
            .slice(0, 3); // Limit to top 3 articles
          
          if (validArticles.length > 0) {
            newsContext = '<h3>Latest Headlines</h3><ul>';
            validArticles.forEach(article => {
              const source = article.source?.name || article.source || 'Unknown source';
              const publishedAt = article.publishedAt 
                ? new Date(article.publishedAt).toLocaleDateString() 
                : '';
              const dateStr = publishedAt ? ` (${publishedAt})` : '';
              
              newsContext += `
                <li>
                  <strong>${article.title}</strong>${dateStr}<br/>
                  ${article.description || ''}
                  ${article.url ? `<a href="${article.url}" target="_blank">Read more</a>` : ''}
                </li>`;
            });
            newsContext += '</ul>';
          }
        }
        
        if (!newsContext) {
          logger.debug('No valid news articles found');
        } else {
          logger.debug('Generated news context with', validArticles.length, 'articles');
        }
      } catch (newsError) {
        logger.error('Error processing news data:', {
          error: newsError.message,
          stack: newsError.stack
        });
        newsContext = '';
      }
    } else {
      logger.debug('News context not included as per user preference or no data');
    }
    
    // Photo gallery context with enhanced handling
    let photoGalleryContext = '';
    if ((useTodaysPhotos || usePhotoData) && todaysPhotos && todaysPhotos.length > 0) {
      try {
        logger.debug('Processing photos:', safeStringify(todaysPhotos));
        
        // Filter out any invalid photos and get their descriptions
        const photoDescriptions = todaysPhotos
          .filter(photo => photo && (photo.caption || photo.description || photo.filename))
          .map(photo => {
            // Try to get the most descriptive text available
            if (photo.caption) return photo.caption;
            if (photo.description) return photo.description;
            if (photo.filename) return `Photo: ${photo.filename}`;
            return 'Photo';
          });
        
        if (photoDescriptions.length > 0) {
          if (photoDescriptions.length === 1) {
            photoGalleryContext = `Here's a photo from today: ${photoDescriptions[0]}. `;
          } else {
            const allButLast = photoDescriptions.slice(0, -1).join(', ');
            const last = photoDescriptions[photoDescriptions.length - 1];
            photoGalleryContext = `Here are some photos from today: ${allButLast}, and ${last}. `;
          }
          
          // If we have photo metadata, add it to the context
          if (usePhotoData && photoMetadata) {
            const { location, date, camera } = photoMetadata;
            const metadataParts = [];
            
            if (location?.name) {
              metadataParts.push(`taken in ${location.name}`);
            }
            
            if (date) {
              try {
                const photoDate = new Date(date).toLocaleDateString();
                metadataParts.push(`on ${photoDate}`);
              } catch (e) {
                logger.debug('Could not parse photo date:', date);
              }
            }
            
            if (camera?.model) {
              metadataParts.push(`using a ${camera.model}`);
            }
            
            if (metadataParts.length > 0) {
              photoGalleryContext += `These photos were ${metadataParts.join(' ')}. `;
            }
          }
        }
        
        logger.debug('Generated photo gallery context:', photoGalleryContext.trim());
      } catch (photoError) {
        logger.error('Error processing photos:', {
          error: photoError.message,
          stack: photoError.stack
        });
        photoGalleryContext = '';
      }
    } else {
      logger.debug('Photo gallery not included as per user preference or no photos');
    }
    
    // Today's photos gallery
    let photosGallery = '';
    if (todaysPhotos?.length > 0) {
      photosGallery = `
      <h2>Today's Photos</h2>
      <div class="photo-gallery" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
        ${todaysPhotos.map(photo => {
          const thumbnail = safeGet(photo, 'thumbnail');
          const formattedTime = safeGet(photo, 'formattedTime', '');
          const locationName = safeGet(photo, 'location.locationName', 'Unknown location');
          const people = safeGet(photo, 'people', []);
          const cameraMake = safeGet(photo, 'cameraMake', '');
          const cameraModel = safeGet(photo, 'cameraModel', '');
          const exposureSettings = safeGet(photo, 'exposureSettings', '');
          const fullSizeUrl = safeGet(photo, 'fullSizeUrl', '#');
          
          return `
            <div class="photo-card" style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; width: 300px;">
              ${thumbnail ? `<img src="${thumbnail}" alt="Photo from ${formattedTime}" style="width: 100%; border-radius: 4px;">` : ''}
              <div class="photo-details" style="margin-top: 8px; font-size: 14px;">
                ${formattedTime ? `<p style="margin: 2px 0;"><strong>Time:</strong> ${formattedTime}</p>` : ''}
                <p style="margin: 2px 0;"><strong>Location:</strong> ${locationName}</p>
                ${people.length > 0 ? `<p style="margin: 2px 0;"><strong>People:</strong> ${people.join(', ')}</p>` : ''}
                ${cameraMake || cameraModel ? `<p style="margin: 2px 0;"><strong>Camera:</strong> ${cameraMake} ${cameraModel}</p>` : ''}
                ${exposureSettings ? `<p style="margin: 2px 0;"><strong>Settings:</strong> ${exposureSettings}</p>` : ''}
                <a href="${fullSizeUrl}" target="_blank" style="display: inline-block; margin-top: 5px; color: #0066cc;">View Full Size</a>
              </div>
            </div>
          `;
        }).join('')}
      </div>`;
    }
    
    // Single photo context if no gallery
    let photoContext = '';
    if (!photosGallery && photoMetadata) {
      const thumbnail = safeGet(photoMetadata, 'thumbnail');
      const cameraMake = safeGet(photoMetadata, 'cameraMake');
      const cameraModel = safeGet(photoMetadata, 'cameraModel');
      const exposureSettings = safeGet(photoMetadata, 'exposureSettings');
      const people = safeGet(photoMetadata, 'people', []);
      const locationName = safeGet(photoMetadata, 'location.locationName');
      
      photoContext = `
      <div class="photo-card" style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; max-width: 320px; margin: 20px 0;">
        ${thumbnail ? `<img src="${thumbnail}" alt="Photo" style="width: 100%; border-radius: 4px;">` : ''}
        <div class="photo-details" style="margin-top: 8px; font-size: 14px;">
          ${cameraMake || cameraModel ? `<p style="margin: 2px 0;"><strong>Camera:</strong> ${cameraMake} ${cameraModel}</p>` : ''}
          ${exposureSettings ? `<p style="margin: 2px 0;"><strong>Settings:</strong> ${exposureSettings}</p>` : ''}
          ${people.length > 0 ? `<p style="margin: 2px 0;"><strong>People:</strong> ${people.join(', ')}</p>` : ''}
          ${locationName ? `<p style="margin: 2px 0;"><strong>Location:</strong> ${locationName}</p>` : ''}
        </div>
      </div>`;
    }
    
    // Generate the blog post with all available contexts
    const dateTitle = useDateTitle ? new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }) : '';
    
    // Build the blog post sections
    const sections = [];
    
    // Title section
    sections.push(`<h1>Blog Post: ${text || 'My Day'}</h1>`);
    
    // Add date if enabled
    if (dateTitle) {
      sections.push(`<div class="blog-date">${dateTitle}</div>`);
    }
    
    // Introduction section
    let intro = `<h2>Introduction</h2><p>As I sit down to write this blog${text ? ` about "${text}"` : ''}`;
    
    // Add location and weather to introduction if available
    if (locationContext || weatherContext) {
      intro += `, I'm inspired by the world around me. ${locationContext}${weatherContext}`;
    } else {
      intro += '.';
    }
    
    intro += '</p>';
    sections.push(intro);
    
    // Add photo gallery if available
    if (photoGalleryContext) {
      sections.push(`<div class="photo-gallery">${photoGalleryContext}</div>`);
    }
    
    // Add news section if available
    if (newsContext) {
      sections.push('<h2>Latest Developments</h2>');
      sections.push(`<p>${newsContext}</p>`);
    }
    
    // Add main content
    sections.push(`
      <h2>My Thoughts</h2>
      <p>${text || 'Today has been an interesting day.'}</p>
      
      <h2>Conclusion</h2>
      <p>As I reflect on ${text ? 'this topic' : 'the day'}, I'm reminded of how technology continues to shape our experiences and perspectives in meaningful ways.</p>
    `);
    
    // Combine all sections
    const blogPost = sections.join('\n\n');
    
    // Log the generated blog post structure
    logger.debug('Generated blog post with sections:', {
      hasTitle: true,
      hasDate: !!dateTitle,
      hasIntroduction: true,
      hasPhotos: !!photoGalleryContext,
      hasNews: !!newsContext,
      totalLength: blogPost.length
    });
    
    logger.info('Enhanced blog post generated successfully');
    return blogPost;
    
  } catch (error) {
    logger.error('Failed to generate enhanced blog post:', {
      error: error.message,
      stack: error.stack,
      payload: safeStringify(payload)
    });
    
    // Return a user-friendly error message
    return `Error generating blog post: ${error.message}. Please try again later.`;
  }
}

export default {
  generateBlogPost,
  generateEnhancedBlogPost,
  safeGet // Export for testing
};
