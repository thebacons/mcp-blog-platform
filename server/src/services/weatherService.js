// src/services/weatherService.js
import axios from 'axios';
import logger from '../logger.js';

// API configurations for weather services
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY;

/**
 * Get weather and environmental data based on coordinates
 * @param {Object} coordinates - The location coordinates
 * @param {number} coordinates.latitude - Latitude
 * @param {number} coordinates.longitude - Longitude
 * @param {Date} [coordinates.timestamp] - Optional timestamp for historical weather
 * @returns {Promise<Object>} Weather and environmental data
 */
export async function getWeatherData(coordinates) {
  try {
    logger.info(`Getting weather data for coordinates: ${coordinates.latitude}, ${coordinates.longitude}`);
    
    // Check if this is a request for historical or current weather
    const isHistorical = coordinates.timestamp && 
                         new Date(coordinates.timestamp).getTime() < Date.now() - (24 * 60 * 60 * 1000);
    
    // Try to get real weather data first
    if (OPENWEATHER_API_KEY) {
      try {
        // For current weather
        if (!isHistorical) {
          return await getOpenWeatherData(coordinates);
        } 
        // For historical weather, we'd need a paid service
        // like OpenWeather One Call API 3.0 with history
      } catch (openWeatherError) {
        logger.error('OpenWeather API error:', openWeatherError.message);
      }
    }
    
    // Try alternate weather provider
    if (WEATHERAPI_KEY) {
      try {
        return await getWeatherAPIData(coordinates);
      } catch (weatherApiError) {
        logger.error('WeatherAPI error:', weatherApiError.message);
      }
    }
    
    // If all real APIs fail, fall back to generated data
    logger.warn('No weather API keys available or API errors, using generated data');
    return generateWeatherData(coordinates);
  } catch (error) {
    logger.error('Error in weather service:', error.message);
    return generateWeatherData(coordinates);
  }
}

/**
 * Get weather data from OpenWeather API
 * @param {Object} coordinates - Location coordinates
 * @returns {Promise<Object>} - Formatted weather data
 */
async function getOpenWeatherData(coordinates) {
  const { latitude, longitude } = coordinates;
  
  // Get current weather data in metric units (Celsius)
  const weatherResponse = await axios.get(
    `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${OPENWEATHER_API_KEY}`
  );
  
  // Get 5-day forecast in metric units (Celsius)
  const forecastResponse = await axios.get(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=metric&appid=${OPENWEATHER_API_KEY}`
  );
  
  // Get air pollution data
  const pollutionResponse = await axios.get(
    `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}`
  );
  
  // Format current weather
  const current = {
    temperature: Math.round(weatherResponse.data.main.temp),
    feelsLike: Math.round(weatherResponse.data.main.feels_like),
    conditions: weatherResponse.data.weather[0].main,
    description: weatherResponse.data.weather[0].description,
    humidity: weatherResponse.data.main.humidity,
    windSpeed: Math.round(weatherResponse.data.wind.speed),
    windDirection: weatherResponse.data.wind.deg,
    pressure: weatherResponse.data.main.pressure,
    icon: weatherResponse.data.weather[0].icon,
    iconUrl: `https://openweathermap.org/img/wn/${weatherResponse.data.weather[0].icon}@2x.png`
  };
  
  // Get sunrise/sunset data
  const sunriseTimestamp = weatherResponse.data.sys.sunrise * 1000;
  const sunsetTimestamp = weatherResponse.data.sys.sunset * 1000;
  const sunrise = new Date(sunriseTimestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const sunset = new Date(sunsetTimestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  // Format air quality
  const aqiMap = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
  const aqi = pollutionResponse.data.list[0].main.aqi;
  
  // Extract forecast data
  const forecast = [];
  const dailyForecasts = {};
  
  // Group forecast by day
  forecastResponse.data.list.forEach(item => {
    const date = new Date(item.dt * 1000).toLocaleDateString('en-US');
    if (!dailyForecasts[date]) {
      dailyForecasts[date] = {
        temps: [],
        conditions: [],
        icons: []
      };
    }
    
    dailyForecasts[date].temps.push(item.main.temp);
    dailyForecasts[date].conditions.push(item.weather[0].main);
    dailyForecasts[date].icons.push(item.weather[0].icon);
  });
  
  // Process daily forecasts
  Object.entries(dailyForecasts).forEach(([date, data], index) => {
    if (index < 3) { // Limit to 3 days
      const temps = data.temps;
      const high = Math.round(Math.max(...temps));
      const low = Math.round(Math.min(...temps));
      
      // Get most common condition
      const conditionCounts = {};
      data.conditions.forEach(condition => {
        conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
      });
      const mainCondition = Object.entries(conditionCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
      
      // Get icon for that condition
      const iconIndex = data.conditions.findIndex(c => c === mainCondition);
      const icon = data.icons[iconIndex] || '01d';
      
      const dayName = index === 0 ? 'Today' : 
                    index === 1 ? 'Tomorrow' : 
                    new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
      
      forecast.push({
        day: dayName,
        date,
        high,
        low,
        conditions: mainCondition,
        icon,
        iconUrl: `https://openweathermap.org/img/wn/${icon}@2x.png`
      });
    }
  });
  
  // Add tide data if coordinates are near coast
  const tides = await getTideData(coordinates);
  
  return {
    source: 'OpenWeather API',
    current,
    astronomy: { sunrise, sunset },
    airQuality: {
      index: aqi,
      description: aqiMap[aqi - 1] || 'Unknown'
    },
    tides,
    forecast
  };
}

/**
 * Get weather data from WeatherAPI.com
 * @param {Object} coordinates - Location coordinates
 * @returns {Promise<Object>} - Formatted weather data
 */
async function getWeatherAPIData(coordinates) {
  const { latitude, longitude } = coordinates;
  
  // Get weather data from WeatherAPI.com with metric units
  const response = await axios.get(
    `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${latitude},${longitude}&days=5&aqi=yes&alerts=no`
  );
  
  // Ensure we have valid data
  if (!response.data || !response.data.current) {
    throw new Error('Invalid response from WeatherAPI');
  }
  
  const data = response.data;
  
  // Format current weather
  const current = {
    temperature: Math.round(data.current.temp_c),
    feelsLike: Math.round(data.current.feelslike_c),
    conditions: data.current.condition.text,
    humidity: data.current.humidity,
    windSpeed: Math.round(data.current.wind_kph),
    windDirection: data.current.wind_degree,
    pressure: data.current.pressure_mb,
    icon: data.current.condition.icon,
    iconUrl: `https:${data.current.condition.icon}`
  };
  
  // Get astronomy data
  const astronomy = {
    sunrise: data.forecast.forecastday[0].astro.sunrise,
    sunset: data.forecast.forecastday[0].astro.sunset,
    moonPhase: data.forecast.forecastday[0].astro.moon_phase
  };
  
  // Format air quality
  const aqiUSEPA = data.current.air_quality['us-epa-index'];
  const aqiMap = ['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'];
  
  // Extract forecast data
  const forecast = data.forecast.forecastday.map((day, index) => {
    const date = new Date(day.date);
    return {
      day: index === 0 ? 'Today' : 
           index === 1 ? 'Tomorrow' : 
           date.toLocaleDateString('en-US', { weekday: 'long' }),
      date: day.date,
      high: Math.round(day.day.maxtemp_c),
      low: Math.round(day.day.mintemp_c),
      conditions: day.day.condition.text,
      icon: day.day.condition.icon,
      iconUrl: `https:${day.day.condition.icon}`,
      rainChance: day.day.daily_chance_of_rain,
      humidity: day.day.avghumidity
    };
  });
  
  // Extract tide data if available
  let tides = null;
  if (data.forecast.forecastday[0].tides && data.forecast.forecastday[0].tides[0].tide.length > 0) {
    const tidesToday = data.forecast.forecastday[0].tides[0].tide;
    
    // Find next high and low tides
    const now = new Date();
    const nextHigh = tidesToday.find(t => t.type === 'High' && new Date(t.time) > now);
    const nextLow = tidesToday.find(t => t.type === 'Low' && new Date(t.time) > now);
    
    tides = {
      nextHigh: nextHigh ? new Date(nextHigh.time).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true
      }) : null,
      nextLow: nextLow ? new Date(nextLow.time).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true
      }) : null,
      tideHeight: nextHigh ? `${nextHigh.height_ft} ft` : ''
    };
  } else {
    // If API doesn't provide tide data, try our own calculation
    tides = await getTideData(coordinates);
  }
  
  return {
    source: 'WeatherAPI.com',
    current,
    astronomy,
    airQuality: {
      index: aqiUSEPA,
      description: aqiMap[aqiUSEPA - 1] || 'Unknown'
    },
    tides,
    forecast
  };
}

/**
 * Get tide data for coastal locations
 * @param {Object} coordinates - Location coordinates
 * @returns {Promise<Object|null>} - Tide data if available
 */
async function getTideData(coordinates) {
  try {
    // Check if location is likely coastal
    // This would normally use a more sophisticated check
    const isCoastal = await isCoastalLocation(coordinates);
    
    if (!isCoastal) {
      return null;
    }
    
    // In a real app, you would use a tide API like WorldTides API or NOAA
    // For now, we'll generate synthetic tide data
    
    const now = new Date();
    const hour = now.getHours();
    
    // Generate next high and low tide times based on lunar cycle
    // This is a simplified model - real tides are more complex
    const moonPhase = getMoonPhase(now);
    const baseHighTideHour = (moonPhase * 24) % 12; // 0-12 hours
    
    let nextHighHour = Math.floor(baseHighTideHour);
    // Adjust to next occurrence if it's in the past
    if ((nextHighHour < hour) || (nextHighHour === hour && now.getMinutes() > 30)) {
      nextHighHour += 12; // Next tidal cycle
    }
    if (nextHighHour >= 24) nextHighHour -= 24;
    
    // Low tide is approximately 6 hours after high tide
    let nextLowHour = (nextHighHour + 6) % 24;
    
    // Format tide times
    const formatTideTime = (hour) => {
      const date = new Date(now);
      date.setHours(hour, Math.floor(Math.random() * 60));
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    };
    
    return {
      nextHigh: formatTideTime(nextHighHour),
      nextLow: formatTideTime(nextLowHour),
      tideHeight: (1.5 + Math.random() * 1.5).toFixed(1) + ' ft'
    };
  } catch (error) {
    logger.error('Error getting tide data:', error.message);
    return null;
  }
}

/**
 * Check if a location is likely coastal
 * @param {Object} coordinates - Location coordinates
 * @returns {Promise<boolean>} - True if location is likely coastal
 */
async function isCoastalLocation(coordinates) {
  try {
    // In a real implementation, you would use a coastline database or service
    // For simplicity, we're doing a basic check using reverse geocoding
    
    // If we have a geocoding API key, we could use that here
    // For now, we'll use a simple heuristic based on coordinates
    
    // Predefined list of coastal regions (very simplified)
    const coastalRegions = [
      { name: 'US West Coast', minLat: 32, maxLat: 49, minLng: -125, maxLng: -117 },
      { name: 'US East Coast', minLat: 25, maxLat: 45, minLng: -82, maxLng: -65 },
      { name: 'European Atlantic', minLat: 36, maxLat: 60, minLng: -10, maxLng: 5 },
      { name: 'Mediterranean', minLat: 30, maxLat: 45, minLng: -5, maxLng: 36 },
      { name: 'Australia', minLat: -45, maxLat: -10, minLng: 110, maxLng: 155 }
    ];
    
    // Check if coordinates fall within any coastal region
    const { latitude, longitude } = coordinates;
    for (const region of coastalRegions) {
      if (latitude >= region.minLat && latitude <= region.maxLat &&
          longitude >= region.minLng && longitude <= region.maxLng) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.error('Error checking coastal location:', error.message);
    return false;
  }
}

/**
 * Get approximate moon phase (0-1, where 0=new moon, 0.5=full moon)
 * @param {Date} date - Date to calculate moon phase for
 * @returns {number} - Moon phase value (0-1)
 */
function getMoonPhase(date) {
  // Simplified moon phase calculation
  // A lunar cycle is approximately 29.53 days
  const LUNAR_CYCLE = 29.53;
  
  // New moon reference date (known new moon)
  const NEW_MOON_REF = new Date('2023-01-21').getTime();
  
  // Calculate days since reference new moon
  const daysSinceRef = (date.getTime() - NEW_MOON_REF) / (24 * 60 * 60 * 1000);
  
  // Calculate current phase (0-1)
  return (daysSinceRef % LUNAR_CYCLE) / LUNAR_CYCLE;
}

/**
 * Generate synthetic weather data when APIs are unavailable
 * @param {Object} coordinates - Location coordinates
 * @returns {Promise<Object>} Generated weather data
 */
async function generateWeatherData(coordinates) {
  logger.info('Generating synthetic weather data');
  
  function getRandomWeatherCondition() {
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Overcast', 'Light Rain', 'Rain', 'Thunderstorms', 'Foggy', 'Snow', 'Clear'];
    return conditions[Math.floor(Math.random() * conditions.length)];
  }
  
  // Calculate sunrise/sunset times based on coordinates and date
  function calculateAstronomyTimes(lat, lng, date) {
    // This is a simplified calculation
    const now = date || new Date();
    const baseHour = 6; // Base sunrise hour
    
    // Adjust for latitude (higher latitudes have more extreme sunrise/sunset times)
    const latFactor = Math.abs(lat) / 90; // 0 at equator, 1 at poles
    const seasonFactor = Math.sin((now.getMonth() + 9.5) * Math.PI / 6); // +1 in summer, -1 in winter for northern hemisphere
    
    // Reverse season factor for southern hemisphere
    const adjustedSeasonFactor = lat >= 0 ? seasonFactor : -seasonFactor;
    
    // Calculate sunrise/sunset hours
    const dayLengthVariation = 4 * latFactor * adjustedSeasonFactor; // Max 4 hour variation
    const sunriseHour = baseHour + dayLengthVariation/2;
    const sunsetHour = 18 - dayLengthVariation/2;
    
    // Format times
    const sunrise = `${Math.floor(sunriseHour)}:${String(Math.floor((sunriseHour % 1) * 60)).padStart(2, '0')} AM`;
    const sunset = `${Math.floor(sunsetHour - 12)}:${String(Math.floor((sunsetHour % 1) * 60)).padStart(2, '0')} PM`;
    
    return { sunrise, sunset };
  }
  
  // Get tide data if needed
  let tideData = null;
  if (!coordinates.timestamp) {
    try {
      tideData = await getTideData(coordinates);
    } catch (error) {
      logger.error('Error getting tide data:', error.message);
    }
  }
  
  // Get current date and time for realistic forecasts
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[now.getDay()];
  const tomorrow = days[(now.getDay() + 1) % 7];
  const dayAfterTomorrow = days[(now.getDay() + 2) % 7];
  const dayAfterAfterTomorrow = days[(now.getDay() + 3) % 7];
  
  // Generate hourly forecasts (next 24 hours)
  const hourlyForecasts = [];
  for (let i = 0; i < 24; i++) {
    const forecastTime = new Date(now.getTime() + i * 60 * 60 * 1000);
    const hour = forecastTime.getHours();
    const hourFormatted = hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
    
    // Temperature variation throughout the day (cooler at night, warmer in afternoon)
    const timeOfDay = (hour - 14) / 24; // Peak at 2pm
    const tempVariation = -Math.cos(timeOfDay * 2 * Math.PI) * 5; // +/- 5°C variation
    
    const baseTemp = 18 + Math.random() * 7; // Base temp around 18-25°C
    hourlyForecasts.push({
      time: hourFormatted,
      temperature: Math.round(baseTemp + tempVariation),
      conditions: getRandomWeatherCondition(),
      precipitation: Math.round(Math.random() * 20) + '%'
    });
  }
  
  return {
    source: 'Generated Data',
    current: {
      temperature: Math.round(18 + Math.random() * 7), // 18-25°C (reasonable Celsius range)
      feelsLike: Math.round(19 + Math.random() * 6),
      conditions: getRandomWeatherCondition(),
      humidity: Math.floor(55 + Math.random() * 30),
      windSpeed: Math.floor(3 + Math.random() * 15),
      iconUrl: null // No icon URL for generated data
    },
    astronomy: calculateAstronomyTimes(coordinates.latitude, coordinates.longitude),
    tides: tideData,
    airQuality: {
      index: Math.floor(30 + Math.random() * 70),
      description: 'Moderate'
    },
    hourlyForecast: hourlyForecasts.slice(0, 12), // Only include 12 hours
    forecast: [
      { 
        day: today, 
        high: Math.round(20 + Math.random() * 7), // 20-27°C 
        low: Math.round(10 + Math.random() * 5),  // 10-15°C 
        conditions: getRandomWeatherCondition(),
        iconUrl: null 
      },
      { 
        day: tomorrow, 
        high: Math.round(20 + Math.random() * 7), 
        low: Math.round(10 + Math.random() * 5), 
        conditions: getRandomWeatherCondition(),
        iconUrl: null 
      },
      { 
        day: dayAfterTomorrow, 
        high: Math.round(20 + Math.random() * 7), 
        low: Math.round(10 + Math.random() * 5), 
        conditions: getRandomWeatherCondition(),
        iconUrl: null 
      }
    ]
  };
}

// getWeatherData is already exported with its declaration
