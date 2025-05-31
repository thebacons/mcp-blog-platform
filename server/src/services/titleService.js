// src/services/titleService.js
import logger from '../logger.js';

/**
 * Generate an intelligent blog title using the current date and content summary
 * @param {string} blogContent - The main content or theme of the blog
 * @param {Object} metadata - Additional metadata (photos, location, activities)
 * @returns {Object} Title information including formatted date and suggested title
 */
export async function generateTitleWithDate(blogContent, metadata = {}) {
  try {
    logger.info('Generating title with date for blog content');
    
    // Get current date in the required format
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = now.toLocaleDateString('en-US', options);
    
    // Extract activity type from the content
    let activityType = extractActivityType(blogContent);
    
    // Add people if available in metadata
    let peopleString = '';
    if (metadata.people && metadata.people.length > 0) {
      peopleString = metadata.people.length === 1 
        ? `with ${metadata.people[0]}`
        : `with ${metadata.people.slice(0, -1).join(', ')} and ${metadata.people[metadata.people.length - 1]}`;
    }
    
    // Add location if available
    let locationString = '';
    if (metadata.location && metadata.location.locationName) {
      const locationParts = metadata.location.locationName.split(',');
      locationString = ` in ${locationParts[0].trim()}`;
    }
    
    // Generate the title
    const title = `${formattedDate} - ${activityType}${peopleString}${locationString}`;
    
    return {
      formattedDate,
      title,
      day: now.getDate(),
      month: now.toLocaleDateString('en-US', { month: 'long' }),
      year: now.getFullYear(),
      weekday: now.toLocaleDateString('en-US', { weekday: 'long' })
    };
  } catch (error) {
    logger.error('Error generating title:', error.message);
    
    // Fallback to a simple date title
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    
    return {
      formattedDate,
      title: `${formattedDate} - ${blogContent.substring(0, 30)}...`,
      day: now.getDate(),
      month: now.toLocaleDateString('en-US', { month: 'long' }),
      year: now.getFullYear(),
      weekday: now.toLocaleDateString('en-US', { weekday: 'long' })
    };
  }
}

/**
 * Extract activity type from blog content
 * @param {string} content - The blog content to analyze
 * @returns {string} Detected activity type
 */
function extractActivityType(content) {
  // List of common activities to detect
  const activities = [
    { keywords: ['lunch', 'dinner', 'breakfast', 'meal', 'restaurant'], activity: 'Wonderful meal' },
    { keywords: ['hike', 'hiking', 'walk', 'walking', 'trek', 'trekking', 'mountain'], activity: 'Amazing hike' },
    { keywords: ['beach', 'sun', 'sand', 'ocean', 'sea', 'swim'], activity: 'Beautiful beach day' },
    { keywords: ['work', 'meeting', 'project', 'office'], activity: 'Productive work day' },
    { keywords: ['family', 'kids', 'children', 'parents'], activity: 'Special family time' },
    { keywords: ['travel', 'trip', 'journey', 'vacation', 'holiday'], activity: 'Exciting travels' },
    { keywords: ['code', 'coding', 'programming', 'developer', 'software'], activity: 'Coding adventures' },
    { keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'data science'], activity: 'AI explorations' },
  ];
  
  // Lowercase content for case-insensitive matching
  const lowerContent = content.toLowerCase();
  
  // Check each activity type
  for (const { keywords, activity } of activities) {
    if (keywords.some(keyword => lowerContent.includes(keyword.toLowerCase()))) {
      return activity;
    }
  }
  
  // Default if no activity detected
  return 'Wonderful day';
}

/**
 * Generate a smart title for a blog post based on its content and metadata
 * @param {string} blogContent - The content of the blog post
 * @param {Object} metadata - Optional metadata including photos, location, etc.
 * @returns {Promise<string>} - The generated smart title
 */
export async function generateSmartTitle(blogContent, metadata = {}) {
  try {
    logger.info('Generating smart title for blog content');
    
    // First try to extract key topics from the blog content
    const topics = extractKeyTopics(blogContent);
    
    // Generate title information with date
    const titleInfo = await generateTitleWithDate(blogContent, metadata);
    
    // Enhance the title with topics if available
    if (topics.length > 0) {
      // Pick the most relevant topic
      const mainTopic = topics[0];
      
      // Add location if available
      let locationString = '';
      if (metadata.location && metadata.location.locationName) {
        const locationParts = metadata.location.locationName.split(',');
        locationString = ` in ${locationParts[0].trim()}`;
      }
      
      // Create a more compelling title
      return `${titleInfo.formattedDate} - ${mainTopic.charAt(0).toUpperCase() + mainTopic.slice(1)}${locationString}`;
    }
    
    // If no topics could be extracted, use the basic title
    return titleInfo.title;
  } catch (error) {
    logger.error('Error generating smart title:', error.message);
    
    // Fallback to a simple date and excerpt
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    
    // Extract first 20 characters for the title
    const excerpt = blogContent.substring(0, 20).trim();
    
    return `${formattedDate} - ${excerpt}...`;
  }
}

/**
 * Extract key topics from blog content
 * @param {string} content - The blog content to analyze
 * @returns {Array<string>} - Array of key topics
 */
function extractKeyTopics(content) {
  // This would ideally use NLP processing to extract key topics
  // For this example, we'll use a simplified keyword extraction approach
  
  // List of common topics with their related keywords
  const topics = [
    { name: 'adventure', keywords: ['adventure', 'explore', 'discover', 'journey', 'quest'] },
    { name: 'travel', keywords: ['travel', 'trip', 'vacation', 'tourism', 'destination', 'sightseeing'] },
    { name: 'food', keywords: ['food', 'meal', 'restaurant', 'cuisine', 'dining', 'lunch', 'dinner', 'breakfast'] },
    { name: 'technology', keywords: ['technology', 'tech', 'digital', 'software', 'app', 'computer', 'AI', 'code'] },
    { name: 'nature', keywords: ['nature', 'outdoors', 'wildlife', 'forest', 'mountains', 'hiking', 'trees'] },
    { name: 'urban exploration', keywords: ['city', 'urban', 'downtown', 'street', 'building', 'architecture'] },
    { name: 'relaxation', keywords: ['relax', 'peaceful', 'calm', 'rest', 'unwind', 'break', 'leisure'] },
    { name: 'celebration', keywords: ['celebration', 'party', 'event', 'birthday', 'anniversary', 'gathering'] },
    { name: 'reflection', keywords: ['reflection', 'thinking', 'contemplation', 'thoughts', 'meditation', 'mindfulness'] },
    { name: 'creativity', keywords: ['creativity', 'art', 'music', 'writing', 'creation', 'imagination'] }
  ];
  
  // Count keyword occurrences in the content
  const topicScores = {};
  const lowerContent = content.toLowerCase();
  
  topics.forEach(topic => {
    let score = 0;
    topic.keywords.forEach(keyword => {
      // Count occurrences of the keyword
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) {
        score += matches.length;
      }
    });
    
    if (score > 0) {
      topicScores[topic.name] = score;
    }
  });
  
  // Sort topics by score and return the names
  return Object.entries(topicScores)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
}

export default {
  generateTitleWithDate,
  generateSmartTitle
};
