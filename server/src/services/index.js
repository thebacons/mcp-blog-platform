// src/services/index.js
// Consolidate all service integrations
import photoService from './photoService.js';
import * as weatherService from './weatherService.js';
import newsService from './newsService.js';
import geminiService from './geminiService.js';
import locationService from './locationService.js';
import titleService from './titleService.js';

export default {
  photoService,
  weatherService,
  newsService,
  geminiService,
  locationService,
  titleService
};
