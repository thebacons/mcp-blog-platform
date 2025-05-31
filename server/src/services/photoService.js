// src/services/photoService.js
import axios from 'axios';
import logger from '../logger.js';

// Google Photos API configuration
const GOOGLE_PHOTOS_API_BASE = 'https://photoslibrary.googleapis.com/v1';

/**
 * Get metadata for a photo using Google Photos API with AI analysis
 * @param {string} photoUrl - URL or resource ID of the photo
 * @returns {Object} Comprehensive photo metadata including AI analysis
 */
export async function getPhotoMetadata(photoUrl) {
  try {
    logger.info(`Getting metadata for photo: ${photoUrl}`);
    
    // Extract photo ID from URL if needed
    const photoId = extractPhotoId(photoUrl);
    if (!photoId) {
      throw new Error('Invalid photo URL or ID');
    }
    
    // Get the user's access token - in production, this would come from your auth system
    // We're using environment variables for demo, but real apps would use a database
    const accessToken = process.env.GOOGLE_PHOTOS_ACCESS_TOKEN;
    if (!accessToken) {
      logger.warn('No Google Photos access token available - checking for refresh token');
      
      // If we have a refresh token, try to get a new access token
      const refreshToken = process.env.GOOGLE_PHOTOS_REFRESH_TOKEN;
      if (refreshToken) {
        try {
          // Import dynamically to avoid circular dependencies
          const googleAuthService = await import('./googleAuthService.js');
          const { access_token } = await googleAuthService.refreshAccessToken(refreshToken);
          
          if (access_token) {
            logger.info('Successfully refreshed Google Photos access token');
            // Continue with the new access token
            return await getPhotoMetadataWithToken(photoId, access_token);
          }
        } catch (refreshError) {
          logger.error('Failed to refresh access token:', refreshError);
        }
      }
      
      // If we still don't have a valid token, use fallback
      return getFallbackPhotoMetadata(photoUrl);
    }
    
    // We have a valid access token, proceed to get photo metadata
    return await getPhotoMetadataWithToken(photoId, accessToken);
  } catch (error) {
    logger.error('Error getting photo metadata:', error);
    logger.info('Falling back to local metadata extraction');
    
    return getFallbackPhotoMetadata(photoUrl);
  }
}

/**
 * Get photo metadata using a valid access token
 * @param {string} photoId - The Google Photos media item ID
 * @param {string} accessToken - Valid Google Photos access token
 * @returns {Object} - Photo metadata
 */
async function getPhotoMetadataWithToken(photoId, accessToken) {
  try {
    // Make API request to Google Photos
    const response = await axios({
      method: 'GET',
      url: `${GOOGLE_PHOTOS_API_BASE}/mediaItems/${photoId}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const photoData = response.data;
    if (!photoData) {
      throw new Error('No photo data returned from Google Photos API');
    }
    
    // Extract and format basic metadata
    const metadata = {
      id: photoData.id,
      timestamp: photoData.mediaMetadata.creationTime,
      width: photoData.mediaMetadata.width,
      height: photoData.mediaMetadata.height,
      mimeType: photoData.mimeType,
      thumbnail: `${photoData.baseUrl}=w300-h200`,
      fullSizeUrl: photoData.baseUrl,
      filename: photoData.filename || 'Unknown'
    };
    
    // Format the time for display
    const creationTime = new Date(photoData.mediaMetadata.creationTime);
    metadata.formattedTime = creationTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    metadata.formattedDate = creationTime.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    // Add location data if available
    if (photoData.mediaMetadata.photo?.location) {
      const lat = photoData.mediaMetadata.photo.location.latitude;
      const lng = photoData.mediaMetadata.photo.location.longitude;
      
      metadata.location = {
        latitude: lat,
        longitude: lng,
        // Use geocoding service to get location name
        locationName: await getLocationNameFromCoordinates(lat, lng)
      };
      
      // Also get weather data for the location and time if possible
      try {
        // This would ideally use a historical weather API
        // For now we'll use current weather as an approximation
        const weatherService = await import('./weatherService.js');
        metadata.weather = await weatherService.getWeatherData({
          latitude: lat,
          longitude: lng
        });
      } catch (weatherError) {
        logger.warn('Could not get weather data for photo:', weatherError.message);
      }
    }
    
    // Add camera data if available
    if (photoData.mediaMetadata.photo) {
      metadata.cameraMake = photoData.mediaMetadata.photo.cameraMake || 'Unknown';
      metadata.cameraModel = photoData.mediaMetadata.photo.cameraModel || 'Unknown';
      metadata.exposureSettings = formatExposureSettings(photoData.mediaMetadata.photo);
    }
    
    // Use AI to analyze the photo contents
    const aiAnalysis = await analyzePhotoWithAI(photoData.baseUrl);
    
    // Merge AI analysis with metadata
    metadata.aiAnalysis = aiAnalysis;
    metadata.description = aiAnalysis.description;
    metadata.people = aiAnalysis.people;
    metadata.labels = aiAnalysis.labels;
    metadata.landmarks = aiAnalysis.landmarks;
    
    // Get album information if available
    try {
      const albumsResponse = await axios({
        method: 'POST',
        url: `${GOOGLE_PHOTOS_API_BASE}/mediaItems:search`,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          mediaItemIds: [photoId]
        }
      });
      
      if (albumsResponse.data && albumsResponse.data.mediaItems) {
        // Extract album info from response
        metadata.albums = albumsResponse.data.mediaItems[0].albums || [];
      }
    } catch (albumError) {
      logger.warn('Could not get album info:', albumError.message);
    }
    
    return metadata;
  } catch (error) {
    logger.error('Error in getPhotoMetadataWithToken:', error);
    throw error; // Let the caller handle the fallback
  }
}

/**
 * Extract photo ID from Google Photos URL
 * @param {string} url - Google Photos URL or ID
 * @returns {string|null} - Extracted photo ID or null if invalid
 */
function extractPhotoId(url) {
  if (!url) {
    logger.error('No URL provided to extractPhotoId');
    return null;
  }
  
  // If it's already an ID (not a URL), return it directly
  if (!url.includes('/') && !url.includes('?')) {
    logger.info(`Treating as direct photo ID: ${url}`);
    return url;
  }
  
  // Log the URL we're processing
  logger.info(`Extracting photo ID from URL: ${url}`);
  
  try {
    // Handle direct Google Photos links
    if (url.includes('photos.google.com')) {
      logger.info('Detected Google Photos URL');
      
      // Handle photos.google.com direct photo links
      if (url.includes('/photo/')) {
        // Format: https://photos.google.com/photo/AF1QipMC4RbBfITgeKBewsNQN_jvm_XFcq3g1ytcr0fe
        const photoPath = url.split('/photo/');
        if (photoPath.length > 1) {
          const photoId = photoPath[1].split(/[?#]/)[0]; // Remove query params or hash
          if (photoId && photoId.length > 10) {
            logger.info(`Extracted Google Photos direct ID: ${photoId}`);
            return photoId;
          }
        }
      }
      
      try {
        // Try parsing as URL for other Google Photos formats
        const urlObj = new URL(url);
        
        // Handle photos.google.com URLs with pathname segments
        const pathParts = urlObj.pathname.split('/');
        // Extract the photo ID - it's typically the last path segment if not empty
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart.length > 10) {
          logger.info(`Extracted Google Photos ID from path: ${lastPart}`);
          return lastPart;
        }
        
        // Try to extract from query parameters
        if (urlObj.searchParams.has('photo')) {
          const photoId = urlObj.searchParams.get('photo');
          if (photoId && photoId.length > 10) {
            logger.info(`Extracted Google Photos ID from query: ${photoId}`);
            return photoId;
          }
        }
      } catch (urlError) {
        logger.error('Error parsing Google Photos URL as URL object:', urlError);
      }
    }
    
    // Handle shared Google Photos URLs (photos.app.goo.gl)
    if (url.includes('photos.app.goo.gl')) {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const shortId = pathParts[pathParts.length - 1];
        logger.info(`Extracted short URL ID: ${shortId}`);
        return shortId;
      } catch (urlError) {
        logger.error('Error parsing Google Photos short URL:', urlError);
      }
    }
    
    // Handle direct media links from Google Photos CDN
    if (url.includes('googleusercontent.com')) {
      try {
        const urlObj = new URL(url);
        // URLs like: https://lh3.googleusercontent.com/pw/[PHOTO_ID]=/w[WIDTH]-h[HEIGHT]/[FILENAME]
        const pathParts = urlObj.pathname.split('/');
        // The ID is typically after the /pw/ segment
        for (let i = 0; i < pathParts.length; i++) {
          if (pathParts[i] === 'pw' && i + 1 < pathParts.length) {
            const idPart = pathParts[i + 1].split('=')[0]; // Remove any parameters after '='
            logger.info(`Extracted CDN photo ID: ${idPart}`);
            return idPart;
          }
        }
      } catch (urlError) {
        logger.error('Error parsing Google Photos CDN URL:', urlError);
      }
    }
  } catch (e) {
    logger.error('Error parsing photo URL:', e);
  }
  
  // If all extraction methods failed, log and return null
  logger.warn(`Failed to extract photo ID from URL: ${url}`);
  return null;
}

/**
 * Format camera exposure settings into readable string
 * @param {Object} photoMetadata - Camera metadata from Google Photos API
 * @returns {string} - Formatted exposure settings
 */
function formatExposureSettings(photoMetadata) {
  if (!photoMetadata) return 'Unknown';
  
  const aperture = photoMetadata.apertureFNumber ? `f/${photoMetadata.apertureFNumber}` : '';
  const exposure = photoMetadata.exposureTime ? `${photoMetadata.exposureTime}s` : '';
  const iso = photoMetadata.isoEquivalent ? `ISO ${photoMetadata.isoEquivalent}` : '';
  
  const settings = [aperture, exposure, iso].filter(Boolean).join(', ');
  return settings || 'Unknown';
}

/**
 * Get location name from coordinates using reverse geocoding
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<string>} - Human-readable location name
 */
async function getLocationNameFromCoordinates(latitude, longitude) {
  try {
    // Use a geocoding service like Google Maps, Mapbox, or OpenStreetMap
    // For this example, we'll use a simplified approach with Nominatim (OpenStreetMap)
    const response = await axios({
      method: 'GET',
      url: `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      headers: {
        'User-Agent': 'MCP-Blog-Generator' // Required by Nominatim TOS
      }
    });
    
    if (response.data && response.data.display_name) {
      // Simplify the location name - typically returns too much detail
      const parts = response.data.display_name.split(',');
      return `${parts[0].trim()}, ${parts[parts.length - 3].trim()}`;
    }
    
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    logger.error('Error getting location name:', error);
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

/**
 * Analyze a photo using AI to detect people, objects, and scene
 * @param {string} photoUrl - URL to the photo
 * @returns {Promise<Object>} - Analysis results including people, objects, scene, etc.
 */
async function analyzePhotoWithAI(photoUrl) {
  try {
    logger.info('Analyzing photo with AI:', photoUrl);
    
    // Check if Google Vision API key is available
    const visionApiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!visionApiKey) {
      logger.warn('No Vision API key available - skipping AI analysis');
      return {
        people: [],
        labels: [],
        landmarks: [],
        description: null
      };
    }
    
    // Call Google Cloud Vision API
    const response = await axios({
      method: 'POST',
      url: `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        requests: [{
          image: {
            source: {
              imageUri: photoUrl
            }
          },
          features: [
            { type: 'FACE_DETECTION' },
            { type: 'LABEL_DETECTION', maxResults: 10 },
            { type: 'LANDMARK_DETECTION', maxResults: 5 },
            { type: 'IMAGE_PROPERTIES' },
            { type: 'SAFE_SEARCH_DETECTION' },
            { type: 'TEXT_DETECTION' }
          ]
        }]
      }
    });
    
    // Process Vision API response
    const result = response.data.responses[0];
    
    // Extract detected labels (objects, activities, etc.)
    const labels = result.labelAnnotations
      ? result.labelAnnotations.map(label => ({
          name: label.description,
          confidence: label.score
        }))
      : [];
    
    // Extract landmark information
    const landmarks = result.landmarkAnnotations
      ? result.landmarkAnnotations.map(landmark => ({
          name: landmark.description,
          confidence: landmark.score,
          location: landmark.locations?.[0]?.latLng
        }))
      : [];
    
    // Process face detection results
    const faceCount = result.faceAnnotations?.length || 0;
    
    // Generate a natural language description of the image
    const mainLabels = labels.slice(0, 3).map(l => l.name).join(', ');
    const landmark = landmarks.length > 0 ? landmarks[0].name : null;
    
    let description = '';
    if (landmark) {
      description = `Photo of ${landmark}`;
      if (faceCount > 0) {
        description += ` with ${faceCount} ${faceCount === 1 ? 'person' : 'people'}`;
      }
    } else if (mainLabels) {
      if (faceCount > 0) {
        description = `Photo of ${faceCount} ${faceCount === 1 ? 'person' : 'people'} with ${mainLabels}`;
      } else {
        description = `Photo showing ${mainLabels}`;
      }
    }
    
    // In a real implementation, you would use the user's Google Contacts API
    // to match detected faces with contact names
    // This requires additional permissions and API calls
    
    return {
      people: [], // Would be populated with recognized contacts in production
      faceCount,
      labels,
      landmarks,
      description,
      dominantColors: result.imagePropertiesAnnotation?.dominantColors?.colors || [],
      textContent: result.textAnnotations?.[0]?.description || ''
    };
  } catch (error) {
    logger.error('Error analyzing photo with AI:', error);
    return {
      people: [],
      labels: [],
      landmarks: [],
      description: null
    };
  }
}

/**
 * Fallback method to extract metadata locally or provide default values
 * @param {string} photoUrl - URL to the photo
 * @returns {Object} - Basic photo metadata
 */
function getFallbackPhotoMetadata(photoUrl) {
  // This would normally attempt to extract EXIF data if the photo is local
  // or use default values if no metadata can be extracted
  
  return {
    timestamp: new Date().toISOString(),
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      locationName: "San Francisco, CA"
    },
    cameraMake: "Unknown",
    cameraModel: "Unknown",
    exposureSettings: "Unknown",
    thumbnail: photoUrl,
    fullSizeUrl: photoUrl,
    people: []
  };
}

/**
 * Get all photos taken today with metadata using Google Photos API
 * @returns {Promise<Object>} Object containing photos array and metadata
 * @property {Array} photos - Array of photo objects with metadata and AI analysis
 * @property {string} source - Source of the photo data ('google_photos' | 'fallback')
 * @property {string} date - Date the photos were taken (YYYY-MM-DD)
 */
export async function getTodaysPhotos() {
  try {
    const accessToken = process.env.GOOGLE_PHOTOS_ACCESS_TOKEN;
    const refreshToken = process.env.GOOGLE_PHOTOS_REFRESH_TOKEN;
    
    // If no access token but we have a refresh token, try to get a new access token
    if (!accessToken && refreshToken) {
      try {
        const googleAuthService = await import('./googleAuthService.js');
        const tokens = await googleAuthService.refreshAccessToken(refreshToken);
        process.env.GOOGLE_PHOTOS_ACCESS_TOKEN = tokens.access_token;
        
        // Update the expiration time
        if (tokens.expires_in) {
          setTimeout(() => {
            process.env.GOOGLE_PHOTOS_ACCESS_TOKEN = null;
          }, (tokens.expires_in - 60) * 1000); // Invalidate 1 minute before expiration
        }
      } catch (error) {
        logger.error('Error refreshing access token:', error);
      }
    }
    
    // If still no access token, use fallback data
    if (!process.env.GOOGLE_PHOTOS_ACCESS_TOKEN) {
      logger.warn('No valid Google Photos access token available, using fallback data');
      return { photos: getFallbackTodaysPhotos(), source: 'fallback', date: new Date().toISOString().split('T')[0] };
    }
    
    // Get today's date in the required format (YYYY-MM-DD)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    logger.info(`Fetching photos for date: ${todayStr}`);
    
    // Make the API request to search for today's photos
    const response = await axios({
      method: 'POST',
      url: 'https://photoslibrary.googleapis.com/v1/mediaItems:search',
      headers: {
        'Authorization': `Bearer ${process.env.GOOGLE_PHOTOS_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      data: {
        pageSize: 50, // Maximum allowed by the API
        filters: {
          dateFilter: {
            ranges: [{
              startDate: { year, month, day },
              endDate: { year, month, day }
            }]
          },
          mediaTypeFilter: {
            mediaTypes: ['PHOTO']
          }
        },
        orderBy: 'MediaMetadata.creation_time desc'
      },
      timeout: 10000 // 10 second timeout
    });
    
    const mediaItems = response.data.mediaItems || [];
    logger.info(`Found ${mediaItems.length} photos from Google Photos`);
    
    if (mediaItems.length === 0) {
      logger.info('No photos found, using fallback data');
      return { photos: getFallbackTodaysPhotos(), source: 'fallback', date: new Date().toISOString().split('T')[0] };
    }
    
    // Process each photo to get detailed metadata (limit to 10 to avoid rate limiting)
    const maxPhotos = Math.min(mediaItems.length, 10);
    const photos = [];
    
    for (let i = 0; i < maxPhotos; i++) {
      const item = mediaItems[i];
      try {
        // Get the base URL for the photo
        const baseUrl = item.baseUrl || '';
        
        // Skip if no base URL is available
        if (!baseUrl) {
          logger.warn(`Skipping photo ${item.id}: No base URL available`);
          continue;
        }
        
        // Create URLs for different sizes
        const thumbnailUrl = `${baseUrl}=w300-h200`;
        const fullSizeUrl = `${baseUrl}=d`; // '=d' for download URL
        
        // Get additional metadata
        const metadata = item.mediaMetadata || {};
        const { width, height, creationTime } = metadata;
        
        // Get location data if available
        let location = null;
        if (item.mediaMetadata?.location) {
          const { latitude, longitude } = item.mediaMetadata.location;
          try {
            const locationName = await getLocationNameFromCoordinates(latitude, longitude);
            location = {
              locationName,
              coordinates: { latitude, longitude },
              source: 'photo_metadata'
            };
          } catch (error) {
            logger.warn(`Could not get location name for coordinates ${latitude},${longitude}:`, error.message);
            location = {
              locationName: `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
              coordinates: { latitude, longitude },
              source: 'photo_coordinates'
            };
          }
        } else if (item.mediaMetadata?.time) {
          // Try to get location from device location history if available
          const photoTime = new Date(item.mediaMetadata.time);
          try {
            const deviceLocation = await getDeviceLocationAtTime(photoTime);
            if (deviceLocation) {
              location = {
                locationName: deviceLocation.name || 'Device location',
                coordinates: {
                  latitude: deviceLocation.latitude,
                  longitude: deviceLocation.longitude
                },
                source: 'device_history',
                accuracy: deviceLocation.accuracy
              };
            }
          } catch (error) {
            logger.warn('Could not get device location:', error.message);
          }
        }
        
        // Create photo object with basic info first
        const photo = {
          id: item.id,
          filename: item.filename || `photo-${i+1}.jpg`,
          mimeType: item.mimeType || 'image/jpeg',
          url: thumbnailUrl,
          fullSizeUrl,
          baseUrl,
          width: parseInt(width) || 0,
          height: parseInt(height) || 0,
          createdAt: creationTime || new Date().toISOString(),
          location,
          coordinates: location?.coordinates // For backward compatibility
        };
        
        // Get AI analysis
        try {
          const aiAnalysis = await analyzePhotoWithAI(thumbnailUrl);
          photo.analysis = {
            ...aiAnalysis,
            location: aiAnalysis.location || location
          };
        } catch (error) {
          logger.error(`Error analyzing photo ${item.id}:`, error);
          photo.analysis = {
            location: location || { locationName: 'Unknown location' },
            people: [],
            objects: [],
            tags: []
          };
        }
        
        photos.push(photo);
        
      } catch (error) {
        logger.error(`Error processing photo ${item.id || 'unknown'}:`, error);
        // Continue with next photo even if one fails
      }
    }
    
    logger.info(`Successfully processed ${photos.length} photos`);
    
    // Process people and themes across all photos
    const allPeople = new Set();
    const labelCounts = {};
    
    photos.forEach(photo => {
      // Collect people
      if (photo.analysis?.people?.length > 0) {
        photo.analysis.people.forEach(person => allPeople.add(person));
      }
      
      // Collect labels for themes
      if (photo.analysis?.tags?.length > 0) {
        photo.analysis.tags.forEach(tag => {
          labelCounts[tag] = (labelCounts[tag] || 0) + 1;
        });
      }
    });
    
    // Add common themes to the photos array
    photos.commonThemes = Object.entries(labelCounts)
      .filter(([_, count]) => count > 1)
      .sort(([_, countA], [__, countB]) => countB - countA)
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));
    
    return { photos };
    
  } catch (error) {
    logger.error('Error fetching today\'s photos:', error);
    // Return fallback data in case of error
    return { photos: getFallbackTodaysPhotos() };
  }
}

/**
 * Calculate distance between two points using the Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} Radians
 */
function deg2rad(deg) {
  return deg * (Math.PI/180);
}

/**
 * Generate fallback sample data for today's photos when API is unavailable
 * @returns {Array} Array of mock photo objects
 */
function getFallbackTodaysPhotos() {
  // Generate fallback data for demonstration purposes
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-US', { 
    weekday: 'long', month: 'long', day: 'numeric' 
  });
  
  // Create a few sample photos with different times and locations
  const photosCount = 3 + Math.floor(Math.random() * 3); // 3-5 photos
  const mockPhotos = [];
  
  const locations = [
    { latitude: 37.7749, longitude: -122.4194, locationName: "San Francisco, CA" },
    { latitude: 37.8199, longitude: -122.4783, locationName: "Golden Gate Bridge, SF" },
    { latitude: 37.8086, longitude: -122.4098, locationName: "Alcatraz Island, SF" },
    { latitude: 37.8024, longitude: -122.4058, locationName: "Pier 39, SF" }
  ];
  
  const cameras = [
    { make: "Canon", model: "EOS R5", settings: "f/2.8, 1/125s, ISO 100" },
    { make: "Sony", model: "A7 IV", settings: "f/4, 1/60s, ISO 200" },
    { make: "iPhone", model: "13 Pro", settings: "f/1.8, 1/240s, ISO 32" }
  ];
  
  const people = [
    "John", "Emma", "Michael", "Sophia", "William", "Olivia", "James", "Ava"
  ];
  
  // Generate photos throughout the day
  for (let i = 0; i < photosCount; i++) {
    // Random hour between 8am and current hour
    const currentHour = now.getHours();
    const hour = Math.floor(Math.random() * (currentHour - 8 + 1)) + 8;
    const minute = Math.floor(Math.random() * 60);
    
    const photoTime = new Date(now);
    photoTime.setHours(hour, minute);
    
    const formattedTime = photoTime.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Select random location and camera
    const location = locations[Math.floor(Math.random() * locations.length)];
    const camera = cameras[Math.floor(Math.random() * cameras.length)];
    
    // Randomly decide if there are people in the photo
    const hasPeople = Math.random() > 0.3; // 70% chance of having people
    const photoPeople = [];
    
    if (hasPeople) {
      // Add 1-3 random people
      const peopleCount = Math.floor(Math.random() * 3) + 1;
      const shuffledPeople = [...people].sort(() => 0.5 - Math.random());
      photoPeople.push(...shuffledPeople.slice(0, peopleCount));
    }
    
    // Add random photo ID for variety in the thumbnails
    const photoId = 100 + Math.floor(Math.random() * 900);
    
    mockPhotos.push({
      id: `photo-${i}-${Date.now()}`,
      timestamp: photoTime.toISOString(),
      formattedTime,
      location,
      cameraMake: camera.make,
      cameraModel: camera.model,
      exposureSettings: camera.settings,
      thumbnail: `https://picsum.photos/id/${photoId}/300/200`,
      fullSizeUrl: `https://picsum.photos/id/${photoId}/800/600`,
      people: photoPeople,
      title: `Photo from ${formattedTime} on ${formattedDate}`
    });
  }
  
  // Sort by timestamp (newest first)
  return mockPhotos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export default { getPhotoMetadata, getTodaysPhotos };
