// src/services/locationService.js
import axios from 'axios';
import logger from '../logger.js';

// Configuration for geolocation services
const IP_GEOLOCATION_PROVIDERS = [
  {
    name: 'ipapi',
    url: (ip) => `https://ipapi.co/${ip}/json/`,
    parser: (data) => ({
      latitude: data.latitude,
      longitude: data.longitude,
      locationName: `${data.city}, ${data.country_name}`,
      region: data.region,
      countryCode: data.country_code,
      timezone: data.timezone,
      source: 'ipapi'
    })
  },
  {
    name: 'ipinfo',
    url: (ip) => `https://ipinfo.io/${ip}/json`,
    parser: (data) => {
      const [lat, lng] = (data.loc || '0,0').split(',').map(Number);
      return {
        latitude: lat,
        longitude: lng,
        locationName: `${data.city || 'Unknown'}, ${data.country || 'Unknown'}`,
        region: data.region,
        countryCode: data.country,
        timezone: data.timezone,
        source: 'ipinfo'
      };
    }
  },
  {
    name: 'geojs',
    url: (ip) => `https://get.geojs.io/v1/ip/geo/${ip}.json`,
    parser: (data) => ({
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      locationName: `${data.city}, ${data.country}`,
      region: data.region,
      countryCode: data.country_code,
      timezone: data.timezone,
      source: 'geojs'
    })
  }
];

/**
 * Get location data from the client device with multiple fallback options
 * Prioritizes: 1) Mobile sensors, 2) Browser geolocation, 3) IP geolocation
 * @param {Object} options - Options for location detection
 * @param {Object} [options.deviceData] - Mobile device sensor data if available
 * @param {Object} [options.browserLocation] - Browser geolocation data if provided
 * @param {string} [options.clientIP] - The IP address to use for fallback
 * @param {boolean} [options.highAccuracy=true] - Whether to request high accuracy (uses more battery)
 * @param {number} [options.timeout=15000] - Timeout for geolocation request in milliseconds
 * @param {string} [options.userAgent] - User agent string to help identify device type
 * @returns {Promise<Object>} Location data including city, country, coordinates
 */
export async function detectClientLocation(options = {}) {
  const { 
    deviceData, 
    browserLocation, 
    clientIP, 
    highAccuracy = true, 
    timeout = 15000,
    userAgent
  } = options;
  
  try {
    logger.info('Attempting to detect client location with priority on real data');
    
    // 1. First priority: Use mobile device sensor data if available
    if (deviceData && deviceData.location) {
      logger.info('Using mobile device sensor data for location');
      
      const { latitude, longitude, accuracy } = deviceData.location;
      if (latitude && longitude) {
        // Get location name using reverse geocoding
        const locationName = await getLocationNameFromCoordinates(latitude, longitude);
        
        return {
          latitude,
          longitude,
          accuracy: accuracy || 0,
          altitude: deviceData.location.altitude,
          heading: deviceData.location.heading,
          speed: deviceData.location.speed,
          locationName,
          source: 'mobile-device-sensors'
        };
      }
    }
    
    // 2. Second priority: Use browser geolocation data if already provided
    if (browserLocation && browserLocation.latitude && browserLocation.longitude) {
      logger.info('Using provided browser geolocation data');
      
      // Get location name using reverse geocoding if not already provided
      const locationName = browserLocation.locationName || 
        await getLocationNameFromCoordinates(
          browserLocation.latitude,
          browserLocation.longitude
        );
      
      return {
        ...browserLocation,
        locationName,
        source: 'browser-geolocation'
      };
    }
    
    // 3. Third priority: Try to get browser geolocation if we're on client-side
    if (typeof window !== 'undefined' && window.navigator && window.navigator.geolocation) {
      logger.info('Browser geolocation API available, attempting to get position');
      
      try {
        // Try browser geolocation (accurate when permitted)
        const position = await getBrowserGeolocation({ highAccuracy, timeout });
        
        // Get location name using reverse geocoding
        const locationName = await getLocationNameFromCoordinates(
          position.coords.latitude,
          position.coords.longitude
        );
        
        return {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          locationName,
          timestamp: position.timestamp,
          source: 'browser-geolocation'
        };
      } catch (geoError) {
        logger.warn(`Browser geolocation failed: ${geoError.message}, falling back to IP`);
        // Fall back to IP geolocation
      }
    }
    
    // 4. Fourth priority: IP-based geolocation as fallback
    if (clientIP) {
      logger.info('Using IP-based geolocation as fallback');
      const formattedIP = formatIPAddress(clientIP);
      return await getLocationFromIP(formattedIP);
    } 
    
    // 5. Last resort: Use server's IP address
    logger.warn('No client IP provided, attempting to use server IP');
    try {
      // Try to get the server's external IP
      const response = await axios.get('https://api.ipify.org?format=json');
      if (response.data && response.data.ip) {
        return await getLocationFromIP(response.data.ip);
      }
    } catch (ipError) {
      logger.error('Failed to get server IP:', ipError.message);
    }
    
    throw new Error('No geolocation methods available');
  } catch (error) {
    logger.error('All location detection methods failed:', error.message);
    return getDefaultLocation();
  }
}

/**
 * Get browser geolocation using the Navigator API
 * @param {Object} options - Geolocation options
 * @returns {Promise<GeolocationPosition>} - Geolocation position
 */
function getBrowserGeolocation(options = {}) {
  const { highAccuracy = false, timeout = 10000 } = options;
  
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.navigator || !window.navigator.geolocation) {
      return reject(new Error('Geolocation API not available'));
    }
    
    window.navigator.geolocation.getCurrentPosition(
      position => resolve(position),
      error => reject(error),
      {
        enableHighAccuracy: highAccuracy,
        timeout,
        maximumAge: 30000 // Accept cached positions up to 30 seconds old
      }
    );
  });
}

/**
 * Get location data from IP address using multiple providers for reliability
 * @param {string} ipAddress - The IP address to geolocate
 * @returns {Promise<Object>} Location data including city, country, coordinates
 */
export async function getLocationFromIP(ipAddress) {
  try {
    logger.info(`Getting location data from IP address: ${ipAddress}`);
    
    // Try each provider in order until one succeeds
    for (const provider of IP_GEOLOCATION_PROVIDERS) {
      try {
        logger.debug(`Trying geolocation provider: ${provider.name}`);
        const response = await axios.get(provider.url(ipAddress), {
          timeout: 5000, // 5 second timeout per provider
          headers: {
            'User-Agent': 'MCP-Blog-Generator/1.0'
          }
        });
        
        if (response.data) {
          const locationData = provider.parser(response.data);
          
          // Validate that we got usable data
          if (locationData.latitude && locationData.longitude) {
            logger.info(`Successfully got location from ${provider.name}`);
            return locationData;
          }
        }
      } catch (providerError) {
        logger.warn(`Provider ${provider.name} failed: ${providerError.message}`);
        // Continue to next provider
      }
    }
    
    throw new Error('All IP geolocation providers failed');
  } catch (error) {
    logger.error('Error getting location from IP:', error.message);
    return getDefaultLocation();
  }
}

/**
 * Get location name from coordinates using reverse geocoding
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<string>} - Human-readable location name
 */
export async function getLocationNameFromCoordinates(latitude, longitude) {
  try {
    // First try Nominatim (OpenStreetMap) service
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'User-Agent': 'MCP-Blog-Generator/1.0' // Required by Nominatim TOS
        },
        timeout: 5000
      }
    );
    
    if (response.data && response.data.display_name) {
      // Simplify the location name - typically returns too much detail
      const parts = response.data.display_name.split(',');
      if (parts.length >= 3) {
        return `${parts[0].trim()}, ${parts[parts.length - 3].trim()}`;
      }
      return parts[0].trim();
    }
    
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch (error) {
    logger.error('Error getting location name:', error.message);
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

/**
 * Format a client IP address for geolocation
 * For local development, this returns a default IP
 * @param {string} clientIP - The client's IP address
 * @returns {string} Formatted IP address
 */
export function formatIPAddress(clientIP) {
  if (!clientIP) return null;
  
  // Handle localhost/development environments
  if (clientIP === '127.0.0.1' || clientIP === 'localhost' || 
      clientIP.startsWith('192.168.') || clientIP.startsWith('10.') || 
      clientIP.startsWith('172.')) {
    // Return a default public IP for testing - this is Google's DNS
    return '8.8.8.8';
  }
  
  // Handle IPv6 format with port
  if (clientIP.includes(':') && clientIP.includes('.')) {
    // Format like: ::ffff:127.0.0.1
    return clientIP.split(':').pop();
  }
  
  // Handle IPv4 with port
  if (clientIP.includes(':') && !clientIP.includes('.')) {
    return clientIP.split(':')[0];
  }
  
  return clientIP;
}

/**
 * Get a default location when all location detection methods fail
 * @returns {Object} Default location data
 */
function getDefaultLocation() {
  const now = new Date();
  const hour = now.getHours();
  
  // Use San Francisco during business hours, London otherwise for demo purposes
  if (hour >= 9 && hour <= 17) {
    return {
      latitude: 37.7749,
      longitude: -122.4194,
      locationName: 'San Francisco, USA',
      region: 'California',
      countryCode: 'US',
      timezone: 'America/Los_Angeles',
      source: 'default-fallback'
    };
  } else {
    return {
      latitude: 51.5074,
      longitude: -0.1278,
      locationName: 'London, UK',
      region: 'England',
      countryCode: 'GB',
      timezone: 'Europe/London',
      source: 'default-fallback'
    };
  }
}

export default {
  detectClientLocation,
  getLocationFromIP,
  formatIPAddress,
  getLocationNameFromCoordinates
};
