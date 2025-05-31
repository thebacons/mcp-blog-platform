/**
 * API client for the MCP Orchestrator
 */
const api = {
  /**
   * Ping the server
   * @returns {Promise<Object>} Response from the server
   */
  async ping() {
    const res = await fetch('/api/ping');
    return await res.json();
  },

  /**
   * Register with the server
   * @param {Object} payload - Registration payload
   * @param {string} apiKey - API key for authentication
   * @returns {Promise<Object>} Response from the server
   */
  async register(payload, apiKey) {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {})
      },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  /**
   * Send a message to the server
   * @param {Object} payload - Message payload
   * @param {string} apiKey - API key for authentication
   * @returns {Promise<Object>} Response from the server
   */
  async message(payload, apiKey) {
    const res = await fetch('/api/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {})
      },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },
  
  /**
   * Call a specific capability directly with provided parameters
   * @param {string} capability - Capability name to call
   * @param {Object} params - Parameters to pass to the capability
   * @param {string} apiKey - API key for authentication
   * @returns {Promise<Object>} - Response from the server
   */
  async callCapability(capability, params = {}, apiKey) {
    try {
      console.log(`Calling capability: ${capability}`, params);
      
      // Special handling for enhanced-blog-writing which uses the /api/message endpoint
      if (capability === 'enhanced-blog-writing') {
        const res = await fetch('/api/message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'X-API-Key': apiKey } : {})
          },
          body: JSON.stringify({
            capability: 'enhanced-blog-writing',
            payload: params,
            messageId: `msg_${Date.now()}`
          })
        });
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Error calling capability ${capability}: ${res.status}`);
        }
        
        return await res.json();
      }
      
      // Map capability names to their correct API endpoints
      let endpointCapability = capability;
      
      // Special case mappings for capabilities with different endpoint names
      const capabilityMappings = {
        'get-weather': 'environmental-data',
        'todays-photos': 'todays-photos',
        'photo-metadata': 'photo-metadata'
      };
      
      if (capabilityMappings[capability]) {
        endpointCapability = capabilityMappings[capability];
        console.log(`Mapping capability ${capability} to endpoint ${endpointCapability}`);
      }
      
      // Use the correct endpoint path (singular 'capability')
      const res = await fetch(`/api/capability/${endpointCapability}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {})
        },
        body: JSON.stringify(params)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error calling capability ${capability}: ${res.status}`);
      }
      
      return await res.json();
    } catch (error) {
      console.error(`Error calling capability ${capability}:`, error);
      throw error;
    }
  },
  
  /**
   * Generate an enhanced blog post with photo, weather, and location data
   * @param {string} text - The blog text content
   * @param {Object} options - Enhancement options
   * @param {Array} options.photos - Selected photos to include
   * @param {Object} options.location - Location data
   * @param {Object} options.weather - Weather data
   * @param {string} apiKey - API key for authentication
   * @returns {Promise<Object>} - The enhanced blog content
   */
  async generateEnhancedBlog(text, options = {}, apiKey) {
    try {
      console.log('Generating enhanced blog with:', { text, options });
      const res = await fetch('/api/generate-blog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {})
        },
        body: JSON.stringify({
          text,
          enhanceOptions: options
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Error generating enhanced blog: ${res.status}`);
      }
      
      return await res.json();
    } catch (error) {
      console.error('Error generating enhanced blog:', error);
      throw error;
    }
  },

  /**
   * Get device location and sensor data
   * @returns {Promise<Object|null>} Device location and sensor data or null if unavailable
   */
  async getDeviceLocationData() {
    // Check for running on a mobile device
    const isMobile = this.isRunningOnMobileDevice();
    console.log(`Running on ${isMobile ? 'mobile device' : 'desktop browser'}`);
    
    // Initialize the data object
    const deviceData = {
      isMobile,
      location: null,
      timestamp: Date.now()
    };
    
    try {
      // Try to get precise geolocation
      if (navigator && navigator.geolocation) {
        try {
          // Request high-accuracy position
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve(pos),
              (err) => reject(err),
              { 
                enableHighAccuracy: true, 
                timeout: 15000, 
                maximumAge: 30000 
              }
            );
          });
          
          // Store location data
          deviceData.location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
          };
          
          console.log('Obtained device geolocation:', deviceData.location);
        } catch (geoError) {
          console.log('Geolocation error:', geoError.message);
        }
      }
      
      return deviceData;
    } catch (error) {
      console.log('Error getting device data:', error.message);
      return null;
    }
  },
  
  /**
   * Check if the application is running on a mobile device
   * @returns {boolean} True if running on a mobile device
   */
  isRunningOnMobileDevice() {
    if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
    
    // Detect mobile devices by user agent
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    
    return mobileRegex.test(userAgent) || 
           (typeof window !== 'undefined' && window.innerWidth <= 800 && window.innerHeight <= 900) || // Screen size heuristic
           (typeof navigator !== 'undefined' && 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0); // Touch capability
  }
};

export default api;
