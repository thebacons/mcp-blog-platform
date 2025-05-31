import React, { useState, useEffect, useRef } from 'react';
import api from './api';

const API_KEY = 'orchestrator-message-key'; // Default API key

export default function EnhancedBlogApp() {
  // State for blog content
  const [blogTopic, setBlogTopic] = useState('My day today was amazing!');
  const [blogResult, setBlogResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // State for enhancement features
  const [useDateTitle, setUseDateTitle] = useState(true); // Always on by default
  const [useTodaysPhotos, setUseTodaysPhotos] = useState(true);
  const [usePhotoData, setUsePhotoData] = useState(false);
  const [useSmartLocation, setUseSmartLocation] = useState(true); // On by default
  const [useWeatherData, setUseWeatherData] = useState(true);
  const [useNewsData, setUseNewsData] = useState(false);
  
  // Enhanced data state
  const [specificPhotoUrl, setSpecificPhotoUrl] = useState('');
  const [specificPhotoMetadata, setSpecificPhotoMetadata] = useState(null);
  const [coordinates, setCoordinates] = useState({ latitude: 37.7749, longitude: -122.4194 }); // SF by default
  const [locationData, setLocationData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [todaysPhotos, setTodaysPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [newsTopic, setNewsTopic] = useState('technology');
  
  // State for news topics with checkboxes
  const [newsTopics, setNewsTopics] = useState([
    { id: 'technology', label: 'Technology', selected: true },
    { id: 'science', label: 'Science', selected: false },
    { id: 'health', label: 'Health', selected: false },
    { id: 'business', label: 'Business', selected: false },
    { id: 'entertainment', label: 'Entertainment', selected: false },
    { id: 'sports', label: 'Sports', selected: false },
    { id: 'politics', label: 'Politics', selected: false },
  ]);
  
  // State for included people from photos
  const [includedPeople, setIncludedPeople] = useState([]);
  
  // State for thinking panel
  const [showThinking, setShowThinking] = useState(true);
  const [thinkingLogs, setThinkingLogs] = useState([]);
  const thinkingPanelRef = useRef(null);
  
  // Add a log entry to the thinking panel
  const addThinkingLog = (message) => {
    const newLog = {
      timestamp: new Date().toLocaleTimeString(),
      message
    };
    setThinkingLogs(prev => [...prev, newLog]);
    
    // Scroll to bottom of thinking panel
    setTimeout(() => {
      if (thinkingPanelRef.current) {
        thinkingPanelRef.current.scrollTop = thinkingPanelRef.current.scrollHeight;
      }
    }, 100);
  };
  
  // Initialize: Fetch photos and detect location on component mount
  useEffect(() => {
    fetchTodaysPhotos();
    detectLocation();
  }, []);
  
  // Auto-scroll thinking panel when logs change
  useEffect(() => {
    if (thinkingPanelRef.current) {
      thinkingPanelRef.current.scrollTop = thinkingPanelRef.current.scrollHeight;
    }
  }, [thinkingLogs]);
  
  // Fetch today's photos with analysis
  const fetchTodaysPhotos = async () => {
    setLoadingPhotos(true);
    addThinkingLog('Fetching today\'s photos...');
    
    try {
      const response = await api.callCapability('todays-photos', {}, API_KEY);
      const photos = Array.isArray(response?.photos) ? response.photos : [];
      
      if (photos.length === 0) {
        addThinkingLog('No photos found from today');
        setTodaysPhotos([]);
        return;
      }
      
      // Log the source of the photos (API or fallback)
      addThinkingLog(`Photo data source: ${response.source || 'unknown'}`);
      if (response.source === 'fallback') {
        addThinkingLog('Using fallback photo data - check Google Photos API configuration');
      }

      // Add selection status and ensure photo has a valid URL
      const photosWithSelection = photos.map(photo => {
        if (!photo.url && photo.baseUrl) {
          // If baseUrl exists but url doesn't, create a thumbnail URL
          photo.url = `${photo.baseUrl}=w300-h200`;
        } else if (!photo.url && photo.id) {
          // If we only have an ID, construct a URL (this might not work for all cases)
          photo.url = `https://lh3.googleusercontent.com/${photo.id}=w300-h200`;
        }
        
        return {
          ...photo,
          selected: true,
          analysis: null
        };
      }).filter(photo => !!photo.url); // Filter out any photos without URLs
      
      setTodaysPhotos(photosWithSelection);
      addThinkingLog(`Found ${photosWithSelection.length} photos from today`);
      
      // Analyze each photo that has a URL
      for (const photo of photosWithSelection) {
        if (photo.url) {
          await analyzePhoto(photo);
        }
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
      addThinkingLog(`Error fetching photos: ${error.message}`);
    } finally {
      setLoadingPhotos(false);
    }
  };

  // Analyze a photo with AI
  const analyzePhoto = async (photo) => {
    if (!photo?.url) {
      addThinkingLog('Skipping photo analysis: Missing photo URL');
      return null;
    }

    try {
      const photoName = photo.filename || photo.url.split('/').pop() || 'Unnamed photo';
      addThinkingLog(`Analyzing photo: ${photoName}`);
      
      const response = await api.callCapability('photo-metadata', { 
        photoUrl: photo.url,
        photoId: photo.id // Pass photo ID if available for better metadata lookup
      }, API_KEY);
      
      if (!response?.metadata) {
        throw new Error('No metadata in response');
      }
      
      // Update the photo with analysis data
      setTodaysPhotos(prev => prev.map(p => 
        p.url === photo.url ? { 
          ...p, 
          analysis: {
            ...response.metadata,
            // Ensure we have a fallback for location
            location: response.metadata.location || {
              locationName: 'Unknown location',
              coordinates: photo.coordinates
            }
          } 
        } : p
      ));
      
      const locationInfo = response.metadata.location?.locationName || 'Unknown location';
      const peopleCount = response.metadata.people?.length || 0;
      addThinkingLog(`Photo analysis complete: Found ${peopleCount} people, location: ${locationInfo}`);
      
      return response.metadata;
    } catch (error) {
      console.error('Error analyzing photo:', error);
      addThinkingLog(`Error analyzing photo: ${error.message}`);
      return null;
    }
  };

  // Get specific photo metadata
  const getSpecificPhotoMetadata = async () => {
    if (!specificPhotoUrl) {
      addThinkingLog('No URL provided for specific photo analysis');
      return;
    }
    
    // Clean up the URL if needed
    let cleanUrl = specificPhotoUrl.trim();
    
    // Fix common URL typos
    if (cleanUrl.startsWith('hhttps://')) {
      cleanUrl = cleanUrl.replace('hhttps://', 'https://');
      addThinkingLog(`Fixed typo in URL: ${cleanUrl}`);
    }
    
    // Handle Google Photos URLs
    if (cleanUrl.includes('photos.google.com')) {
      addThinkingLog(`Detected Google Photos URL: ${cleanUrl}`);
      
      // Special handling for Google Photos URLs
      try {
        const urlObj = new URL(cleanUrl);
        // Extract the photo ID from the path
        if (urlObj.pathname.includes('/photo/')) {
          const pathParts = urlObj.pathname.split('/');
          const photoId = pathParts[pathParts.length - 1];
          addThinkingLog(`Extracted Google Photos ID: ${photoId}`);
        }
      } catch (e) {
        addThinkingLog(`Error parsing Google Photos URL: ${e.message}`);
      }
    }
    
    addThinkingLog(`Fetching metadata for specific photo: ${cleanUrl}`);
    setIsLoading(true);
    
    try {
      const response = await api.callCapability('photo-metadata', { photoUrl: cleanUrl }, API_KEY);
      
      if (response && response.metadata) {
        setSpecificPhotoMetadata(response.metadata);
        addThinkingLog(`Specific photo analysis complete`);
      } else {
        throw new Error('No metadata returned from service');
      }
    } catch (error) {
      console.error('Error fetching photo metadata:', error);
      addThinkingLog(`Error analyzing specific photo: ${error.message}`);
      
      // Set fallback metadata
      setSpecificPhotoMetadata({
        description: 'Unable to analyze this photo. The photo URL may be invalid or inaccessible.',
        error: error.message,
        url: cleanUrl
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Detect user's location
  const detectLocation = async () => {
    addThinkingLog('Detecting location from device or network...');
    
    try {
      // Check if we have photos with location data
      if (todaysPhotos.length > 0) {
        addThinkingLog('Checking photos for location metadata...');
        
        // Log all photo location metadata for debugging
        todaysPhotos.forEach((photo, index) => {
          if (photo.location || (photo.analysis && photo.analysis.location)) {
            addThinkingLog(`Photo ${index + 1} location metadata: ${JSON.stringify(photo.location || photo.analysis.location)}`);
          }
        });
        
        // First try to find a photo with coordinates in location property
        let photoWithLocation = todaysPhotos.find(p => p.location?.coordinates);
        if (photoWithLocation?.location) {
          const { latitude, longitude } = photoWithLocation.location.coordinates;
          setCoordinates({ latitude, longitude });
          
          // Use the photo's location name if available
          if (photoWithLocation.location.locationName) {
            setLocationData({
              name: photoWithLocation.location.locationName,
              coordinates: { latitude, longitude },
              source: 'photo_metadata'
            });
            addThinkingLog(`Using photo location from metadata: ${photoWithLocation.location.locationName}`);
            fetchWeatherData(latitude, longitude);
            return;
          }
        }
        
        // If no direct location coordinates, try alternative metadata structures
        photoWithLocation = todaysPhotos.find(p => 
          p.analysis?.location?.coordinates || 
          (p.analysis?.location?.latitude && p.analysis?.location?.longitude)
        );
        
        if (photoWithLocation?.analysis?.location) {
          const loc = photoWithLocation.analysis.location;
          // Handle different coordinate formats
          const latitude = loc.coordinates ? loc.coordinates.latitude : loc.latitude;
          const longitude = loc.coordinates ? loc.coordinates.longitude : loc.longitude;
          
          if (latitude && longitude) {
            setCoordinates({ latitude, longitude });
            
            if (loc.locationName) {
              setLocationData({
                name: loc.locationName,
                coordinates: { latitude, longitude },
                source: 'photo_analysis'
              });
              addThinkingLog(`Using location from photo analysis: ${loc.locationName}`);
              fetchWeatherData(latitude, longitude);
              return;
            }
          }
        }
        
        // Try simple lat/long format in photo metadata
        photoWithLocation = todaysPhotos.find(p => 
          p.latitude && p.longitude || 
          (p.metadata && p.metadata.latitude && p.metadata.longitude)
        );
        
        if (photoWithLocation) {
          let latitude, longitude;
          if (photoWithLocation.latitude && photoWithLocation.longitude) {
            latitude = photoWithLocation.latitude;
            longitude = photoWithLocation.longitude;
          } else if (photoWithLocation.metadata) {
            latitude = photoWithLocation.metadata.latitude;
            longitude = photoWithLocation.metadata.longitude;
          }
          
          if (latitude && longitude) {
            setCoordinates({ latitude, longitude });
            addThinkingLog(`Using raw coordinates from photo: ${latitude}, ${longitude}`);
            
            // Get location name via reverse geocoding
            try {
              const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`);
              const data = await response.json();
              if (data.display_name) {
                setLocationData({
                  name: data.display_name,
                  coordinates: { latitude, longitude },
                  source: 'photo_reverse_geocode'
                });
                addThinkingLog(`Reverse geocoded photo location: ${data.display_name}`);
              }
            } catch (error) {
              addThinkingLog(`Error reverse geocoding photo location: ${error.message}`);
              setLocationData({
                name: `Photo Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
                coordinates: { latitude, longitude },
                source: 'photo_coordinates'
              });
            }
            
            fetchWeatherData(latitude, longitude);
            return;
          }
        }
      }
      
      // Fall back to device geolocation if no photo location
      try {
        const position = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
            return;
          }
          
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        
        const { latitude, longitude } = position.coords;
        setCoordinates({ latitude, longitude });
        
        // Get location name
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`);
          const data = await response.json();
          setLocationData({
            name: data.display_name || 'Current location',
            coordinates: { latitude, longitude },
            source: 'geolocation'
          });
          addThinkingLog(`Device location: ${data.display_name || 'Unknown location'}`);
        } catch (error) {
          console.error('Error getting location name:', error);
          setLocationData({
            name: `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            coordinates: { latitude, longitude },
            source: 'geolocation_coords'
          });
          addThinkingLog(`Location coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        
        // Fetch weather data for the location
        fetchWeatherData(latitude, longitude);
        
      } catch (error) {
        console.error('Error detecting location:', error);
        addThinkingLog(`Location detection failed: ${error.message}. Using default location.`);
        // Use default location (San Francisco)
        fetchWeatherData(37.7749, -122.4194);
      }
    } catch (error) {
      console.error('Error in location detection:', error);
      addThinkingLog(`Error in location detection: ${error.message}`);
    }
  };

  // Try to extract location from photos as fallback
  const tryExtractLocationFromPhotos = () => {
    const photosWithLocation = todaysPhotos.filter(photo => 
      photo.analysis && photo.analysis.location && photo.analysis.location.locationName
    );
    
    if (photosWithLocation.length > 0) {
      const photoLocation = photosWithLocation[0].analysis.location;
      setLocationData(photoLocation);
      addThinkingLog(`Using location from photo: ${photoLocation.locationName}`);
      
      if (photoLocation.latitude && photoLocation.longitude) {
        fetchWeatherData(photoLocation.latitude, photoLocation.longitude);
      }
    } else {
      addThinkingLog('No location data available in photos');
    }
  };
  
  // Toggle news topic selection
  const toggleNewsTopic = (topicId) => {
    setNewsTopics(prev => prev.map(topic => 
      topic.id === topicId ? { ...topic, selected: !topic.selected } : topic
    ));
  };

  // Fetch weather data
  const fetchWeatherData = async (latitude, longitude) => {
    if (!useWeatherData) return;
    
    addThinkingLog(`Fetching weather data for coordinates: ${latitude}, ${longitude}`);
    
    try {
      const response = await api.callCapability(
        'get-weather',
        { 
          latitude, 
          longitude,
          units: 'metric', // Request metric units (Celsius)
          days: 3 // Request 3-day forecast
        },
        API_KEY
      );
      
      // Check if we have valid weather data
      if (response) {
        let weatherWithUnits;
        
        // Handle both new and legacy formats
        if (typeof response.temperature !== 'undefined') {
          // Legacy format - simple temperature object
          weatherWithUnits = {
            ...response,
            unit: response.unit || 'Â°C', // Default to Celsius if not specified
            // Convert temperature to number if it's a string
            temperature: typeof response.temperature === 'string' 
              ? parseFloat(response.temperature.replace(/[^0-9.-]+/g, ''))
              : response.temperature
          };
        } else if (response.current) {
          // New format with current weather and forecast
          weatherWithUnits = {
            ...response,
            // Make sure top-level properties exist for backward compatibility
            temperature: response.current.temperature,
            conditions: response.current.conditions,
            feelsLike: response.current.feelsLike,
            humidity: response.current.humidity,
            windSpeed: response.current.windSpeed,
            unit: 'Â°C',
            icon: response.current.icon,
            iconUrl: response.current.iconUrl
          };
          
          // Log forecast data if available
          if (response.forecast && response.forecast.length > 0) {
            addThinkingLog(`Forecast received for ${response.forecast.length} days`);
            response.forecast.forEach(day => {
              addThinkingLog(`${day.day}: High ${day.high}Â°C, Low ${day.low}Â°C, ${day.conditions}`);
            });
          }
        } else {
          throw new Error('Unrecognized weather data format');
        }
        
        setWeatherData(weatherWithUnits);
        addThinkingLog(`Weather data received: ${weatherWithUnits.temperature}Â°C, ${weatherWithUnits.conditions || 'Unknown conditions'}`);
      } else {
        throw new Error('Invalid weather data received');
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
      addThinkingLog(`Error fetching weather data: ${error.message}`);
      
      // Set fallback weather data
      setWeatherData({
        temperature: 20, // Default temperature in Celsius
        conditions: 'Partly Cloudy',
        unit: 'Â°C',
        isFallback: true,
        // Add fallback forecast
        forecast: [
          { day: 'Today', high: 22, low: 16, conditions: 'Partly Cloudy' },
          { day: 'Tomorrow', high: 23, low: 17, conditions: 'Mostly Sunny' },
          { day: 'Day After', high: 21, low: 15, conditions: 'Cloudy' }
        ]
      });
    }
  };

  // Export to different formats
  const handleExport = (format) => {
    console.log(`Exporting blog as ${format}`);
    alert(`Exporting blog as ${format}`);
  };
  
  // Handle blog generation
  const handleGenerateBlog = async () => {
    setIsLoading(true);
    setBlogResult('');
    setThinkingLogs([]);
    
    try {
      addThinkingLog('Starting blog generation...');
      
      // Collect all the data needed for the blog
      const blogData = {
        text: blogTopic, // Changed from 'topic' to 'text' to match server expectation
        useDateTitle,
        useTodaysPhotos,
        usePhotoData,
        useSmartLocation,
        useWeatherData,
        useNewsData,
        selectedPhotos: todaysPhotos.filter(photo => photo.selected),
        newsTopics: newsTopics.filter(topic => topic.selected).map(topic => topic.id),
        locationData: locationData || {},
        weatherData: weatherData || {}
      };
      
      addThinkingLog('Sending blog generation request to server...');
      
      // Call the enhanced blog generation endpoint
      const response = await api.callCapability(
        'enhanced-blog-writing', 
        blogData, 
        API_KEY
      );
      
      if (response && response.blog_post) {
        setBlogResult(response.blog_post);
        addThinkingLog('Blog generated successfully!');
      } else {
        throw new Error('No blog post was generated');
      }
    } catch (error) {
      console.error('Error generating blog:', error);
      setBlogResult(`<p>Error generating blog: ${error.message}</p>`);
      addThinkingLog(`ERROR: Blog generation failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle photo selection
  const togglePhotoSelection = (photoUrl) => {
    setTodaysPhotos(prevPhotos => 
      prevPhotos.map(photo => 
        photo.url === photoUrl 
          ? { ...photo, selected: !photo.selected } 
          : photo
      )
    );
  };

  // Render the component
  return (
    <div style={styles.container}>
      <main style={styles.mainContent}>
        <section style={styles.section}>
          <h2 style={styles.heading}>Your Notes</h2>
          <textarea 
            value={blogTopic}
            onChange={(e) => setBlogTopic(e.target.value)}
            placeholder="Enter some notes or thoughts to turn into a blog post..."
            rows="6"
            style={styles.textarea}
          />
        </section>
        
        <section style={styles.section}>
          <h2 style={styles.heading}>Today's Photos</h2>
          {loadingPhotos ? (
            <div style={styles.loadingIndicator}>Loading photos...</div>
          ) : todaysPhotos.length > 0 ? (
            <div style={styles.photoGrid}>
              {todaysPhotos.map((photo, index) => (
                <div key={index} style={styles.photoCard}>
                  <img 
                    src={photo.url} 
                    alt={`Photo ${index + 1}`} 
                    style={styles.photoImage}
                  />
                  <div style={styles.photoActions}>
                    <button 
                      onClick={() => togglePhotoSelection(photo.url)}
                      style={photo.selected ? styles.photoSelectedButton : styles.photoButton}
                    >
                      {photo.selected ? 'Selected' : 'Select'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No photos found for today.</p>
          )}
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>Blog Settings</h2>
          <div style={styles.settingsGrid}>
            <label style={styles.settingItem}>
              <input 
                type="checkbox" 
                checked={useDateTitle} 
                onChange={(e) => setUseDateTitle(e.target.checked)}
              />
              Include date in title
            </label>
            <label style={styles.settingItem}>
              <input 
                type="checkbox" 
                checked={useTodaysPhotos} 
                onChange={(e) => setUseTodaysPhotos(e.target.checked)}
              />
              Include today's photos
            </label>
            <label style={styles.settingItem}>
              <input 
                type="checkbox" 
                checked={usePhotoData} 
                onChange={(e) => setUsePhotoData(e.target.checked)}
              />
              Include photo metadata
            </label>
            <label style={styles.settingItem}>
              <input 
                type="checkbox" 
                checked={useSmartLocation} 
                onChange={(e) => setUseSmartLocation(e.target.checked)}
              />
              Use smart location
            </label>
            <label style={styles.settingItem}>
              <input 
                type="checkbox" 
                checked={useWeatherData} 
                onChange={(e) => setUseWeatherData(e.target.checked)}
              />
              Include weather data
            </label>
            <label style={styles.settingItem}>
              <input 
                type="checkbox" 
                checked={useNewsData} 
                onChange={(e) => setUseNewsData(e.target.checked)}
              />
              Include news
            </label>
          </div>
        </section>

        <button 
          onClick={handleGenerateBlog}
          disabled={isLoading}
          style={isLoading ? {...styles.button, ...styles.buttonDisabled} : styles.button}
        >
          {isLoading ? 'Generating...' : 'Generate Enhanced Blog'}
        </button>

        {blogResult && (
          <section style={styles.section}>
            <h2 style={styles.heading}>Generated Blog</h2>
            <div 
              style={styles.blogPreview}
              dangerouslySetInnerHTML={{ __html: blogResult }}
            />
            <div style={styles.exportButtons}>
              <button 
                onClick={() => handleExport('markdown')}
                style={styles.exportButton}
              >
                Export as Markdown
              </button>
              <button 
                onClick={() => handleExport('html')}
                style={styles.exportButton}
              >
                Export as HTML
              </button>
              <button 
                onClick={() => handleExport('pdf')}
                style={styles.exportButton}
              >
                Export as PDF
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

// Inline styles
const styles = {
  container: {
    fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    color: '#333',
  },
  header: {
    marginBottom: '20px',
    padding: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    margin: '0 0 10px 0',
    color: '#1a73e8',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    margin: '0 0 20px 0',
  },
  actionButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
    width: '100%',
  },
  actionButton: {
    backgroundColor: '#f1f3f4',
    color: '#333',
    border: 'none',
    padding: '10px 15px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
  },
  activeButton: {
    backgroundColor: '#e8f0fe',
    color: '#1a73e8',
  },
  exportSelect: {
    padding: '10px 15px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    backgroundColor: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
  },
  blogPreview: {
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    maxHeight: '500px',
    overflowY: 'auto',
  },
  // Weather forecast styles
  forecastContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '15px',
    gap: '10px',
  },
  forecastDay: {
    flex: 1,
    backgroundColor: '#f1f3f4',
    borderRadius: '8px',
    padding: '10px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  forecastDayName: {
    fontWeight: '600',
    marginBottom: '5px',
    fontSize: '14px',
  },
  forecastIcon: {
    margin: '5px 0',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastTemp: {
    display: 'flex',
    gap: '10px',
    margin: '5px 0',
  },
  forecastHigh: {
    fontWeight: '600',
    color: '#d32f2f',
  },
  forecastLow: {
    color: '#1976d2',
  },
  forecastConditions: {
    fontSize: '12px',
    color: '#666',
  },
  thinkingPanel: {
    backgroundColor: '#202124',
    color: '#e8eaed',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  },
  thinkingTitle: {
    color: '#8ab4f8',
    margin: '0 0 10px 0',
    fontSize: '16px',
    fontWeight: '600',
  },
  thinkingContent: {
    maxHeight: '200px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '14px',
    padding: '10px',
    backgroundColor: '#303134',
    borderRadius: '4px',
  },
  logEntry: {
    marginBottom: '5px',
    lineHeight: '1.4',
  },
  logTimestamp: {
    color: '#bdc1c6',
    marginRight: '8px',
  },
  logMessage: {
    color: '#e8eaed',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  section: {
    marginBottom: '10px',
    padding: '20px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  heading: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '15px',
    color: '#1a73e8',
    borderBottom: '1px solid #e8eaed',
    paddingBottom: '10px',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '16px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  photoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '15px',
  },
  photoCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.1)',
  },
  photoHeader: {
    padding: '10px',
    backgroundColor: '#f1f3f4',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoTitle: {
    fontSize: '14px',
    fontWeight: '500',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    maxWidth: '120px',
  },
  photoCheckbox: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    gap: '4px',
  },
  photoImageContainer: {
    height: '150px',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.2s ease',
  },
  photoMetadata: {
    padding: '10px',
    fontSize: '12px',
  },
  metadataItem: {
    marginBottom: '5px',
  },
  specificPhotoContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  urlInputContainer: {
    display: 'flex',
    gap: '10px',
  },
  urlInput: {
    flex: '1',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
  },
  analyzeButton: {
    backgroundColor: '#1a73e8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '0 15px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  specificPhotoResult: {
    display: 'flex',
    gap: '20px',
    backgroundColor: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
  },
  specificPhotoPreview: {
    flex: '0 0 200px',
    height: '200px',
    overflow: 'hidden',
    borderRadius: '4px',
  },
  specificPhotoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  specificPhotoDetails: {
    flex: '1',
  },
  photoAnalysisTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginTop: '0',
    marginBottom: '10px',
    color: '#1a73e8',
  },
  photoDetail: {
    marginBottom: '8px',
    fontSize: '14px',
  },
  locationContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  locationHeader: {
    borderBottom: '1px solid #e8eaed',
    paddingBottom: '10px',
  },
  locationName: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 5px 0',
  },
  weatherContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '15px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0',
    position: 'relative',
    maxWidth: '400px',
    margin: '10px 0'
  },
  weatherIcon: {
    width: '60px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2.5rem'
  },
  weatherDetails: {
    flex: 1
  },
  weatherTemp: {
    fontSize: '1.8rem',
    fontWeight: '600',
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '4px'
  },
  feelsLike: {
    fontSize: '0.9rem',
    color: '#666',
    fontWeight: 'normal'
  },
  weatherConditions: {
    fontSize: '1rem',
    color: '#555',
    marginBottom: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  weatherExtra: {
    fontSize: '0.85rem',
    color: '#666',
    opacity: 0.9
  },
  weatherNote: {
    position: 'absolute',
    bottom: '4px',
    right: '10px',
    fontSize: '0.7rem',
    color: '#888',
    fontStyle: 'italic'
  },
  locationSource: {
    fontSize: '12px',
    color: '#666',
  },
  weatherContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  currentWeather: {
    padding: '15px',
    backgroundColor: '#e8f0fe',
    borderRadius: '8px',
    textAlign: 'center',
  },
  temperatureDisplay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '10px 0',
  },
  temperature: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a73e8',
  },
  feelsLike: {
    fontSize: '14px',
    color: '#666',
    marginTop: '4px',
  },
  conditions: {
    fontSize: '18px',
    fontWeight: '500',
    margin: '5px 0',
  },
  weatherDetails: {
    fontSize: '14px',
    color: '#666',
    marginTop: '5px',
  },
  forecast: {
    marginTop: '15px',
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  hourlyForecast: {
    marginTop: '15px',
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  hourlyContainer: {
    display: 'flex',
    overflowX: 'auto',
    gap: '10px',
    paddingBottom: '8px',
  },
  hourlyItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '60px',
    padding: '8px 5px',
    borderRadius: '6px',
    backgroundColor: '#f8f9fa',
  },
  hourTime: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#444',
  },
  hourlyIcon: {
    fontSize: '20px',
    margin: '5px 0',
  },
  hourlyTemp: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a73e8',
  },
  precipProb: {
    fontSize: '12px',
    color: '#666',
    marginTop: '3px',
  },
  forecastTitle: {
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 10px 0',
    color: '#444',
  },
  forecastDay: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #e8eaed',
  },
  dayName: {
    fontWeight: '500',
    width: '80px',
  },
  dayCondition: {
    color: '#666',
    flex: '1',
    textAlign: 'center',
  },
  dayTemp: {
    fontWeight: '500',
    width: '100px',
    textAlign: 'right',
  },
  weatherNote: {
    fontSize: '12px',
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: '5px',
  },
  refreshButton: {
    backgroundColor: '#1a73e8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    alignSelf: 'flex-start',
  },
  loadingLocation: {
    textAlign: 'center',
    padding: '20px',
  },
  loadingIndicator: {
    fontSize: '16px',
    color: '#666',
    margin: '10px 0',
  },
  locationNote: {
    fontSize: '14px',
    color: '#888',
  },
  topicsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  topicButton: {
    backgroundColor: '#f1f3f4',
    border: 'none',
    borderRadius: '20px',
    padding: '8px 15px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  selectedTopic: {
    backgroundColor: '#e8f0fe',
    color: '#1a73e8',
  },
  button: {
    backgroundColor: '#1a73e8',
    color: 'white',
    padding: '15px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    margin: '10px 0',
    transition: 'background-color 0.2s ease',
    transition: 'background 0.3s',
    marginBottom: '30px',
  },
  buttonDisabled: {
    background: '#95a5a6',
    cursor: 'not-allowed',
  },
  blogPreview: {
    background: 'white',
    padding: '20px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    minHeight: '200px',
  }
};
