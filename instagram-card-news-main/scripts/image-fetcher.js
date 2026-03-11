'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Image Fetcher Service
 * Handles image fetching from multiple APIs with caching and relevance scoring
 */
class ImageFetcher {
  constructor(options = {}) {
    this.cacheSize = options.cacheSize || 50;
    this.maxImages = options.maxImages || 10;
    this.qualityFilter = options.qualityFilter || ['high', 'medium'];
    this.minResolution = options.minResolution || { width: 800, height: 1000 };
    this.cacheDir = path.join(process.cwd(), '..', 'workspace', 'image-cache');
    this.cacheFile = path.join(this.cacheDir, 'cache.json');

    // Initialize cache directory
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Load or create cache
    this.cache = this.loadCache();

    // Initialize APIs
    this.pexelsApiKey = process.env.PEXELS_API_KEY || options.pexelsApiKey;
    this.unsplashApiKey = process.env.UNSPLASH_API_KEY || options.unsplashApiKey;
  }

  /**
   * Main entry point - fetch images for a topic
   * @param {string} topic - Search topic
   * @param {object} options - Fetch options
   * @returns {Promise<Array>} Array of image objects with metadata
   */
  async fetchImages(topic, options = {}) {
    const {
      imageUsage = 'topic-matched',
      maxImages = this.maxImages,
      source = ['pexels', 'unsplash'], // Multiple sources
      minScore = 70,
      refresh = false,
    } = options;

    console.log(`🔍 Fetching images for topic: "${topic}"`);

    // Check cache first
    if (!refresh && imageUsage === 'topic-matched') {
      const cachedImages = this.getCachedImages(topic);
      if (cachedImages && cachedImages.length > 0) {
        console.log(`✓ Found ${cachedImages.length} cached images`);
        return cachedImages.slice(0, maxImages);
      }
    }

    // Fetch images from multiple sources
    let allImages = [];

    if (Array.isArray(source)) {
      for (const src of source) {
        try {
          console.log(`  Fetching from ${src}...`);
          const images = await this.fetchFromSource(src, topic, maxImages * 2);
          allImages = allImages.concat(images);
        } catch (error) {
          console.warn(`  Warning: ${src} fetch failed: ${error.message}`);
        }
      }
    } else {
      allImages = await this.fetchFromSource(source, topic, maxImages * 2);
    }

    // Score and filter images
    const scoredImages = this.scoreImages(allImages, topic);

    // Filter by minimum score
    const filteredImages = scoredImages.filter(img => img.score >= minScore);

    // Limit to max images
    const selectedImages = filteredImages.slice(0, maxImages);

    // Sort by score
    selectedImages.sort((a, b) => b.score - a.score);

    console.log(`✓ Selected ${selectedImages.length} images with score >= ${minScore}`);

    // Cache results
    if (selectedImages.length > 0 && imageUsage === 'topic-matched') {
      this.cacheImages(topic, selectedImages);
    }

    return selectedImages;
  }

  /**
   * Fetch images from a specific source
   * @param {string} source - Source name (pexels, unsplash)
   * @param {string} topic - Search topic
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of raw image objects
   */
  async fetchFromSource(source, topic, limit) {
    switch (source) {
      case 'pexels':
        return await this.fetchFromPexels(topic, limit);
      case 'unsplash':
        return await this.fetchFromUnsplash(topic, limit);
      default:
        throw new Error(`Unknown source: ${source}`);
    }
  }

  /**
   * Fetch images from Pexels API
   * @param {string} query - Search query
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of raw image objects
   */
  async fetchFromPexels(query, limit) {
    if (!this.pexelsApiKey) {
      throw new Error('Pexels API key not configured');
    }

    return new Promise((resolve, reject) => {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=portrait`;

      https.get(url, {
        headers: {
          Authorization: this.pexelsApiKey,
        },
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const images = response.photos.map(photo => ({
              url: photo.src.portrait || photo.src.original,
              full_url: photo.src.original,
              source: 'pexels',
              photographer: photo.photographer,
              photographer_url: photo.photographer_url,
              alt: photo.alt,
              source_url: photo.url,
              width: photo.width,
              height: photo.height,
              id: photo.id,
            }));
            resolve(images);
          } catch (error) {
            reject(new Error(`Pexels API parse error: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Pexels API error: ${error.message}`));
      });
    });
  }

  /**
   * Fetch images from Unsplash API
   * @param {string} query - Search query
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of raw image objects
   */
  async fetchFromUnsplash(query, limit) {
    if (!this.unsplashApiKey) {
      throw new Error('Unsplash API key not configured');
    }

    return new Promise((resolve, reject) => {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=portrait`;

      https.get(url, {
        headers: {
          Authorization: `Client-ID ${this.unsplashApiKey}`,
        },
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const images = response.results.map(photo => ({
              url: photo.urls.regular,
              full_url: photo.urls.full,
              raw_url: photo.urls.raw,
              source: 'unsplash',
              photographer: photo.user.name,
              photographer_url: photo.user.links.html,
              location: photo.location?.title,
              alt: photo.description || query,
              width: photo.width,
              height: photo.height,
              id: photo.id,
              license: photo.license,
              likes: photo.likes,
              downloads: photo.downloads,
            }));
            resolve(images);
          } catch (error) {
            reject(new Error(`Unsplash API parse error: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Unsplash API error: ${error.message}`));
      });
    });
  }

  /**
   * Score images based on relevance and quality
   * @param {Array} images - Raw image objects
   * @param {string} topic - Search topic
   * @returns {Array} Scored image objects
   */
  scoreImages(images, topic) {
    const keywords = this.extractKeywords(topic);

    return images.map((image, index) => {
      const semanticScore = this.calculateSemanticScore(image, keywords);
      const visualScore = this.calculateVisualScore(image);
      const sourceScore = this.calculateSourceScore(image);
      const engagementScore = this.calculateEngagementScore(image);

      // Weighted score calculation
      const score = (
        semanticScore * 0.35 +
        visualScore * 0.25 +
        sourceScore * 0.15 +
        engagementScore * 0.25
      );

      return {
        ...image,
        score: Math.round(score * 100) / 100,
        relevance_keywords: keywords,
        analyzed_at: new Date().toISOString(),
      };
    });
  }

  /**
   * Extract keywords from topic
   * @param {string} topic - Search topic
   * @returns {Array<string>} Array of keywords
   */
  extractKeywords(topic) {
    // Remove common words and extract keywords
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', '의', '는', '이', '가', '을', '를', '와', '과', '하고', '의해', '에서', '에', '대해', '해서', '해서']);

    const words = topic
      .toLowerCase()
      .replace(/[^\w\sㄱ-힣]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.has(word));

    return [...new Set(words)];
  }

  /**
   * Calculate semantic relevance score
   * @param {object} image - Image object
   * @param {Array} keywords - Keywords
   * @returns {number} Score between 0-1
   */
  calculateSemanticScore(image, keywords) {
    if (!image.alt || keywords.length === 0) return 0.5;

    const alt = image.alt.toLowerCase();
    let matchCount = 0;

    for (const keyword of keywords) {
      if (alt.includes(keyword)) {
        matchCount++;
      }
    }

    const score = Math.min(matchCount / keywords.length, 1.0);
    return score;
  }

  /**
   * Calculate visual quality score
   * @param {object} image - Image object
   * @returns {number} Score between 0-1
   */
  calculateVisualScore(image) {
    let score = 0.5;

    // Check resolution
    if (image.width && image.height) {
      const aspectRatio = image.width / image.height;
      // Portrait aspect ratio should be between 0.75 and 0.85 (vertical)
      if (aspectRatio >= 0.75 && aspectRatio <= 0.85) {
        score += 0.2;
      }
    }

    // Check photo size (more pixels = better)
    if (image.width && image.height) {
      const pixelCount = image.width * image.height;
      if (pixelCount >= 1000000) { // 1920x1080 or higher
        score += 0.2;
      } else if (pixelCount >= 500000) {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate source trust score
   * @param {object} image - Image object
   * @returns {number} Score between 0-1
   */
  calculateSourceScore(image) {
    let score = 0.5;

    // Higher score for trusted sources
    const trustedSources = ['unsplash', 'pexels', 'getty', 'shutterstock'];
    if (trustedSources.some(src => image.source?.includes(src))) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate engagement potential score
   * @param {object} image - Image object
   * @returns {number} Score between 0-1
   */
  calculateEngagementScore(image) {
    let score = 0.5;

    // More likes/engagement = better
    if (image.likes && image.likes > 100) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Cache images for a topic
   * @param {string} topic - Search topic
   * @param {Array} images - Image objects
   */
  cacheImages(topic, images) {
    // Clean up old entries
    const now = Date.now();
    const ttl = 7 * 24 * 60 * 60 * 1000; // 7 days

    this.cache = this.cache.filter(entry => {
      const age = now - entry.timestamp;
      return age < ttl;
    });

    // Add new entry
    this.cache.unshift({
      topic,
      images: images.map(img => ({
        url: img.url,
        score: img.score,
        cached_at: img.analyzed_at,
      })),
      timestamp: now,
    });

    // Keep cache size manageable
    if (this.cache.length > this.cacheSize) {
      this.cache = this.cache.slice(0, this.cacheSize);
    }

    // Save to file
    fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
  }

  /**
   * Load cache from file
   * @returns {object} Cache object
   */
  loadCache() {
    if (fs.existsSync(this.cacheFile)) {
      try {
        const data = fs.readFileSync(this.cacheFile, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        console.warn('Failed to load cache:', error.message);
      }
    }
    return [];
  }

  /**
   * Get cached images for a topic
   * @param {string} topic - Search topic
   * @returns {Array|null} Cached images or null
   */
  getCachedImages(topic) {
    const now = Date.now();
    const ttl = 7 * 24 * 60 * 60 * 1000; // 7 days

    for (const entry of this.cache) {
      if (entry.topic === topic) {
        const age = now - entry.timestamp;
        if (age < ttl) {
          return entry.images;
        }
      }
    }
    return null;
  }

  /**
   * Get usage statistics
   * @returns {object} Statistics object
   */
  getStats() {
    return {
      cacheSize: this.cache.length,
      cacheEntries: this.cache.map(entry => ({
        topic: entry.topic,
        imageCount: entry.images.length,
        age: Date.now() - entry.timestamp,
      })),
      apiKeysConfigured: {
        pexels: !!this.pexelsApiKey,
        unsplash: !!this.unsplashApiKey,
      },
    };
  }
}

// Export as module
module.exports = ImageFetcher;
