'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const PixabayProvider = require('./image-provider-pixabay');
const WikimediaProvider = require('./image-provider-wikimedia');
const {
  classifyTopic,
  routeProviders,
  getAvailableProviders,
} = require('./image-topic-router');

/**
 * Image Fetcher Service
 * Handles image fetching from multiple APIs with caching, relevance scoring, and intelligent routing
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
    this.pixabayApiKey = process.env.PIXABAY_API_KEY || options.pixabayApiKey;

    // Initialize provider instances
    this.pixabayProvider = new PixabayProvider({ apiKey: this.pixabayApiKey });
    this.wikimediaProvider = new WikimediaProvider();
  }

  /**
   * Return API key value for provider.
   * @param {string} providerName
   * @returns {string|undefined}
   */
  getApiKeyForProvider(providerName) {
    const keys = {
      pexels: this.pexelsApiKey,
      unsplash: this.unsplashApiKey,
      pixabay: this.pixabayApiKey,
    };
    return keys[providerName];
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
      useRouting = true, // Enable intelligent routing
    } = options;

    console.log(`🔍 Fetching images for topic: "${topic}"`);

    // Analyze topic if routing is enabled
    let routingInfo = null;
    if (useRouting) {
      routingInfo = this.analyzeTopic(topic);
      console.log(`📊 Topic classified as: ${routingInfo.classification.label} (${routingInfo.classification.type})`);
      console.log(`🎯 Provider priority: ${routingInfo.provider_priorities.join(' → ')}`);
    }

    // Check cache first
    if (!refresh && imageUsage === 'topic-matched') {
      const cachedImages = this.getCachedImages(topic);
      if (cachedImages && cachedImages.length > 0) {
        console.log(`✓ Found ${cachedImages.length} cached images`);
        return cachedImages.slice(0, maxImages);
      }
    }

    // Fetch images using routing or direct source selection
    let allImages = [];
    let sourcesUsed = [];

    if (useRouting && routingInfo) {
      // Use intelligent routing
      const priorities = routingInfo.provider_priorities;
      const providers = getAvailableProviders();

      console.log(`🎯 Using routing: ${priorities.join(' → ')}`);

      for (const providerName of priorities) {
        if (allImages.length >= maxImages * 2) break; // Enough images, stop

        const providerInfo = providers[providerName];
        if (!providerInfo) continue;

        // Check if provider is available (has API key or is keyless)
        if (providerInfo.requires_api_key) {
          const apiKey = this.getApiKeyForProvider(providerName);
          if (!apiKey) {
            console.log(`  ⚠️ Skipping ${providerName} (API key not configured)`);
            continue;
          }
        }

        try {
          console.log(`  📥 Fetching from ${providerName}...`);
          let images;

          if (providerName === 'pixabay') {
            images = await this.pixabayProvider.fetchImages(topic, maxImages * 2);
          } else if (providerName === 'wikimedia') {
            images = await this.wikimediaProvider.fetchImages(topic, maxImages * 2);
          } else if (providerName === 'pexels') {
            images = await this.fetchFromPexels(topic, maxImages * 2);
          } else if (providerName === 'unsplash') {
            images = await this.fetchFromUnsplash(topic, maxImages * 2);
          }

          if (images && images.length > 0) {
            console.log(`  ✓ Got ${images.length} images from ${providerName}`);
            allImages = allImages.concat(images);
            sourcesUsed.push(providerName);
          }
        } catch (error) {
          console.warn(`  ⚠️ ${providerName} fetch failed: ${error.message}`);
          // Continue to next provider
        }
      }
    } else {
      // Use direct source selection (original behavior)
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
    }

    console.log(`  📊 Total images collected: ${allImages.length}`);

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

    // Log routing summary if available
    if (routingInfo) {
      console.log(`🤖 Routing summary: ${sourcesUsed.length} sources tried, ${sourcesUsed.join(', ')}`);
    }

    return selectedImages;
  }

  /**
   * Analyze topic for routing recommendations
   * @param {string} topic - The topic to analyze
   * @returns {object} Routing analysis
   */
  analyzeTopic(topic) {
    return {
      classification: classifyTopic(topic),
      provider_priorities: routeProviders(classifyTopic(topic).type),
    };
  }

  /**
   * Fetch images from a specific source
   * @param {string} source - Source name (pexels, unsplash, pixabay, wikimedia)
   * @param {string} topic - Search topic
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of raw image objects
   */
  async fetchFromSource(source, topic, limit) {
    switch (source) {
      case 'pixabay':
        return await this.pixabayProvider.fetchImages(topic, limit);
      case 'wikimedia':
        return await this.wikimediaProvider.fetchImages(topic, limit);
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
   * Test all configured providers
   * @returns {Promise<object>} Test results for each provider
   */
  async testProviders() {
    const providers = getAvailableProviders();
    const results = {};

    for (const [name, info] of Object.entries(providers)) {
      try {
        if (name === 'pixabay') {
          results[name] = await this.pixabayProvider.test();
        } else if (name === 'wikimedia') {
          results[name] = await this.wikimediaProvider.test();
        } else if (name === 'pexels') {
          results[name] = !!(this.pexelsApiKey && await this.fetchFromPexels('test', 1).catch(() => false));
        } else if (name === 'unsplash') {
          results[name] = !!(this.unsplashApiKey && await this.fetchFromUnsplash('test', 1).catch(() => false));
        }

        results[name].available = !!results[name];
        results[name].name = info.name;
        results[name].requires_key = info.requires_api_key;
      } catch (error) {
        results[name] = {
          available: false,
          error: error.message,
          name: info.name,
          requires_key: info.requires_api_key,
        };
      }
    }

    return results;
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
   * Build a slide-aware search query.
   * @param {string} topic
   * @param {object} slide
   * @returns {string}
   */
  buildSlideQuery(topic, slide) {
    const parts = [
      topic,
      slide.headline,
      slide.emphasis,
      slide.badge_text,
      slide.badge2_text,
      slide.left_title,
      slide.right_title,
      slide.body,
      slide.body2,
      slide.subtext,
    ].filter(Boolean);

    const cleaned = parts
      .join(' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Keep query compact for provider APIs while preserving topic intent.
    return cleaned.slice(0, 160);
  }

  /**
   * Build context keywords from slide content.
   * @param {string} topic
   * @param {object} slide
   * @returns {Array<string>}
   */
  extractSlideKeywords(topic, slide) {
    const raw = [
      topic,
      slide.headline,
      slide.body,
      slide.body2,
      slide.emphasis,
      slide.badge_text,
      slide.badge2_text,
      slide.left_title,
      slide.right_title,
      slide.subtext,
    ].filter(Boolean).join(' ');

    return this.extractKeywords(raw);
  }

  /**
   * Additional score based on slide context and image type preference.
   * @param {object} image
   * @param {Array<string>} keywords
   * @param {string} slideType
   * @returns {number}
   */
  calculateSlideContextScore(image, keywords, slideType) {
    if (!keywords.length) return 0;

    const tags = Array.isArray(image.tags) ? image.tags.join(' ') : '';
    const haystack = [
      image.alt,
      image.title,
      image.description,
      tags,
      image.type,
    ].filter(Boolean).join(' ').toLowerCase();

    let keywordHits = 0;
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) keywordHits += 1;
    }

    let bonus = (keywordHits / keywords.length) * 35;

    // Design-oriented preference:
    // - full image slides: prefer real photos over illustrations.
    if (slideType === 'content-fullimage') {
      if (image.type === 'photo') bonus += 10;
      if (image.type === 'illustration' || image.type === 'vector') bonus -= 8;
    }

    return bonus;
  }

  /**
   * Fetch the best image candidate for a specific slide.
   * @param {string} topic
   * @param {object} slide
   * @param {object} options
   * @returns {Promise<object|null>}
   */
  async fetchBestImageForSlide(topic, slide, options = {}) {
    const {
      minScore = 60,
      maxImagesPerQuery = 8,
      usedUrls = new Set(),
      refresh = false,
    } = options;

    const slideQuery = this.buildSlideQuery(topic, slide);
    const fallbackQuery = [topic, slide.headline].filter(Boolean).join(' ').trim();
    const queries = [...new Set([slideQuery, fallbackQuery, topic].filter(Boolean))];

    let candidates = [];
    for (const query of queries) {
      try {
        const images = await this.fetchImages(query, {
          maxImages: maxImagesPerQuery,
          minScore,
          refresh,
          useRouting: true,
        });
        candidates = candidates.concat(images || []);
      } catch (error) {
        console.warn(`  ⚠️ Image fetch failed for query "${query}": ${error.message}`);
      }
    }

    if (!candidates.length) return null;

    // Deduplicate by URL while keeping best base score.
    const deduped = new Map();
    for (const candidate of candidates) {
      const key = candidate.url || candidate.full_url;
      if (!key) continue;
      const prev = deduped.get(key);
      if (!prev || (candidate.score || 0) > (prev.score || 0)) {
        deduped.set(key, candidate);
      }
    }

    const keywords = this.extractSlideKeywords(topic, slide);
    const ranked = [...deduped.values()].map((image) => {
      const base = typeof image.score === 'number' ? image.score : 0;
      const context = this.calculateSlideContextScore(image, keywords, slide.type);
      const duplicatePenalty = usedUrls.has(image.url) ? 30 : 0;
      return {
        ...image,
        final_score: Math.round((base + context - duplicatePenalty) * 100) / 100,
      };
    });

    ranked.sort((a, b) => b.final_score - a.final_score);
    return ranked.find((img) => !usedUrls.has(img.url)) || ranked[0] || null;
  }

  /**
   * Attach relevant images to image-capable slides.
   * @param {Array<object>} slides
   * @param {string} topic
   * @param {object} options
   * @returns {Promise<object>} Summary and updated slides
   */
  async attachImagesToSlides(slides, topic, options = {}) {
    const {
      force = false,
      minScore = 60,
      maxImagesPerQuery = 8,
      refresh = false,
    } = options;

    const imageSlideTypes = new Set(['content-image', 'content-fullimage']);
    const usedUrls = new Set(
      slides
        .map((slide) => slide.image_url)
        .filter((url) => typeof url === 'string' && url.trim().length > 0)
    );

    let attached = 0;
    let skipped = 0;

    for (const slide of slides) {
      if (!imageSlideTypes.has(slide.type)) continue;
      if (!force && slide.image_url) {
        skipped += 1;
        continue;
      }

      const selected = await this.fetchBestImageForSlide(topic, slide, {
        minScore,
        maxImagesPerQuery,
        usedUrls,
        refresh,
      });

      if (selected && selected.url) {
        slide.image_url = selected.url;
        usedUrls.add(selected.url);
        attached += 1;
      }
    }

    return {
      slides,
      summary: {
        attached,
        skipped,
      },
    };
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
    if (!image.alt && !image.title && !image.description) return 0.5;

    const alt = (image.alt || image.title || image.description || '').toLowerCase();
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
    const trustedSources = ['unsplash', 'pexels', 'wikimedia', 'pixabay'];
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
        source: img.source,
        alt: img.alt,
        title: img.title,
        description: img.description,
        width: img.width,
        height: img.height,
        type: img.type,
        tags: img.tags,
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
        pixabay: !!this.pixabayApiKey,
      },
      providers: getAvailableProviders(),
    };
  }
}

// Export as module
module.exports = ImageFetcher;
