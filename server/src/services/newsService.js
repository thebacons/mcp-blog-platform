// src/services/newsService.js
import logger from '../logger.js';

/**
 * Get latest news articles on a specific topic
 * @param {string} topic - The topic to search for (default: AI)
 * @returns {Object} News data including article list
 */
export async function getLatestNews(topic = "AI") {
  logger.info(`Fetching latest news about: ${topic}`);
  
  // In production, you would connect to a news API like NewsAPI.org, Google News API, etc.
  // This mock implementation returns different news depending on the topic

  const newsDatabase = {
    "AI": [
      {
        title: "Google Introduces New Gemini Pro-2 Model",
        source: "TechCrunch",
        summary: "Google has released Gemini Pro-2, enhancing multimodal capabilities with improved context handling and response accuracy.",
        url: "https://techcrunch.com/example",
        published: new Date().toISOString()
      },
      {
        title: "AI Regulation Framework Proposed by EU Commission",
        source: "Reuters",
        summary: "The European Union has introduced a comprehensive framework for regulating AI systems based on risk assessment and transparency requirements.",
        url: "https://reuters.com/example",
        published: new Date(Date.now() - 86400000).toISOString() // Yesterday
      },
      {
        title: "Breakthrough in AI-Powered Medical Diagnostics",
        source: "Nature",
        summary: "Researchers have developed a new approach to medical imaging analysis that achieves radiologist-level accuracy on identifying early-stage conditions.",
        url: "https://nature.com/example",
        published: new Date(Date.now() - 172800000).toISOString() // 2 days ago
      }
    ],
    "Technology": [
      {
        title: "New Quantum Computing Milestone Achieved",
        source: "MIT Technology Review",
        summary: "Scientists have demonstrated quantum advantage in a practical computing task for the first time, showing 100x speedup over classical methods.",
        url: "https://technologyreview.com/example",
        published: new Date().toISOString()
      },
      {
        title: "Apple Unveils Next-Generation Silicon Chips",
        source: "The Verge",
        summary: "Apple's newest M3 Ultra processor breaks performance records while maintaining industry-leading power efficiency.",
        url: "https://theverge.com/example",
        published: new Date(Date.now() - 86400000).toISOString()
      },
      {
        title: "Major Breakthrough in Solid-State Battery Technology",
        source: "Wired",
        summary: "Researchers have solved key challenges in solid-state battery development, promising EVs with 1000-mile range and 5-minute charging.",
        url: "https://wired.com/example",
        published: new Date(Date.now() - 172800000).toISOString()
      }
    ],
    "Environment": [
      {
        title: "Record Ocean Temperatures Recorded Globally",
        source: "National Geographic",
        summary: "Scientists report unprecedented ocean temperature rises in all major basins, raising concerns about marine ecosystem impacts.",
        url: "https://nationalgeographic.com/example",
        published: new Date().toISOString()
      },
      {
        title: "New Carbon Capture Technology Shows Promise",
        source: "Scientific American",
        summary: "A novel direct air capture system demonstrates 70% efficiency improvement over current technologies at significantly lower costs.",
        url: "https://scientificamerican.com/example",
        published: new Date(Date.now() - 86400000).toISOString()
      },
      {
        title: "Major Nations Announce Enhanced Climate Commitments",
        source: "BBC",
        summary: "Leading economies have pledged more aggressive emissions reduction targets, aiming for carbon neutrality by 2040.",
        url: "https://bbc.com/example",
        published: new Date(Date.now() - 172800000).toISOString()
      }
    ]
  };
  
  // Default to AI news if topic not found
  const articles = newsDatabase[topic] || newsDatabase["AI"];
  
  return { articles };
}

export default { getLatestNews };
