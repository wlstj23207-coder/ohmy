'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const PixabayProvider = require('./image-provider-pixabay');
const WikimediaProvider = require('./image-provider-wikimedia');
const OpenverseProvider = require('./image-provider-openverse');
const PollinationsProvider = require('./image-provider-pollinations');
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
    this.loadLocalEnv();
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
    this.openverseProvider = new OpenverseProvider();
    this.pollinationsProvider = new PollinationsProvider();
  }

  /**
   * Load .env files without external dependencies.
   */
  loadLocalEnv() {
    const candidates = [
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), '..', '.env'),
    ];

    for (const envPath of candidates) {
      if (!fs.existsSync(envPath)) continue;
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx <= 0) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
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
    const normalizedMinScore = minScore > 1 ? (minScore / 100) : minScore;

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
      const priorities = [...routingInfo.provider_priorities];
      const providers = getAvailableProviders();

      // If Unsplash key is configured, prioritize Unsplash first for richer fashion photos.
      if (this.unsplashApiKey) {
        const idx = priorities.indexOf('unsplash');
        if (idx > -1) {
          priorities.splice(idx, 1);
          priorities.unshift('unsplash');
        }
      }

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
          } else if (providerName === 'openverse') {
            images = await this.openverseProvider.fetchImages(topic, maxImages * 2);
          } else if (providerName === 'pollinations') {
            images = await this.pollinationsProvider.fetchImages(topic, maxImages);
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
    const filteredImages = scoredImages.filter(img => img.score >= normalizedMinScore);

    // Limit to max images
    const selectedImages = filteredImages.slice(0, maxImages);

    // Sort by score
    selectedImages.sort((a, b) => b.score - a.score);

    console.log(`✓ Selected ${selectedImages.length} images with score >= ${normalizedMinScore}`);

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
      case 'openverse':
        return await this.openverseProvider.fetchImages(topic, limit);
      case 'pollinations':
        return await this.pollinationsProvider.fetchImages(topic, limit);
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
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=portrait&content_filter=high&order_by=relevant`;

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
        } else if (name === 'openverse') {
          results[name] = await this.openverseProvider.test();
        } else if (name === 'pollinations') {
          results[name] = await this.pollinationsProvider.test();
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
  buildSlideQuery(topic, slide, discussionContext = '') {
    const parts = [
      topic,
      discussionContext,
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

    const metaNoise = new Set([
      'team', 'discussion', 'round', 'slide', 'slides', 'content',
      'topic', 'headline', 'body', 'summary', 'insight', 'trend', 'trends',
    ]);

    const tokens = this.extractKeywords(parts.join(' '))
      .filter((word) => !metaNoise.has(word))
      .slice(0, 12);

    // Keep query compact and keyword-focused for provider APIs.
    return tokens.join(' ').slice(0, 120);
  }

  /**
   * Build Unsplash-friendly queries by mixing Korean topic terms with English visual hints.
   * @param {string} topic
   * @param {object} slide
   * @param {string} discussionSnippet
   * @returns {Array<string>}
   */
  buildUnsplashQueries(topic, slide, discussionSnippet = '') {
    const base = this.buildSlideQuery(topic, slide, discussionSnippet);
    const fallback = [topic, slide.headline].filter(Boolean).join(' ').trim();

    const signal = `${topic || ''} ${slide.headline || ''} ${slide.body || ''} ${slide.emphasis || ''}`.toLowerCase();
    const englishHints = [];
    const categoryHints = [];
    const visualBriefByType = {
      cover: 'hero shot editorial magazine background negative space',
      content: 'editorial product shot natural light shallow depth of field',
      'content-badge': 'product closeup convenience store shelf portrait framing',
      'content-stat': 'nutrition label product closeup clean commercial photography',
      'content-image': 'lifestyle shot person holding product in store aisle',
      'content-fullimage': 'cinematic lifestyle photo dramatic composition',
      cta: 'checkout counter shopping basket product arrangement',
    };
    const visualBrief = visualBriefByType[slide.type] || 'editorial commercial photo';

    if (signal.includes('편의점')) englishHints.push('convenience store', 'korea');
    if (signal.includes('디저트')) englishHints.push('dessert', 'sweet snack');
    if (signal.includes('딸기')) englishHints.push('strawberry');
    if (signal.includes('감귤')) englishHints.push('citrus');
    if (signal.includes('말차')) englishHints.push('matcha');
    if (signal.includes('저당')) englishHints.push('low sugar');
    if (signal.includes('고단백')) englishHints.push('high protein');
    if (signal.includes('콜라보')) englishHints.push('collaboration packaging');
    if (signal.includes('패키지')) englishHints.push('product packaging');
    if (signal.includes('디저트') || signal.includes('dessert')) {
      categoryHints.push('dessert', 'bakery', 'pastry', 'sweet food');
    }
    if (signal.includes('편의점') || signal.includes('convenience')) {
      categoryHints.push('convenience store snack', 'retail shelf');
    }

    if (!englishHints.length) {
      englishHints.push('editorial photo', 'magazine style');
    }

    const englishQuery = [...new Set([...englishHints, ...categoryHints])].join(' ');
    const compactTopic = this.extractKeywords(topic || '').slice(0, 5).join(' ');
    const compactSlide = this.extractKeywords(`${slide.headline || ''} ${slide.body || ''}`).slice(0, 5).join(' ');
    const sceneQuery = `${englishQuery} ${visualBrief}`.trim();

    return [...new Set([
      `${sceneQuery} ${compactTopic}`.trim(),
      `${sceneQuery} ${compactSlide}`.trim(),
      base,
      fallback,
      topic,
    ].filter(Boolean))];
  }

  /**
   * Build no-key fallback image URL (Unsplash Source endpoint).
   * @param {string} query
   * @param {number} salt
   * @returns {string}
   */
  buildFallbackImageUrl(query, salt = 1) {
    const normalized = (query || 'fashion style')
      .replace(/\s+/g, ' ')
      .trim();
    const prompt = `${normalized}, editorial fashion photo, gorpcore look, urban style, portrait composition`;
    const params = new URLSearchParams({
      width: '1080',
      height: '1350',
      model: 'flux',
      seed: String(2000 + salt),
      nologo: 'true',
      safe: 'true',
      enhance: 'true',
    });
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
  }

  /**
   * Normalize URL to asset identity (strip query/hash).
   * @param {string} url
   * @returns {string}
   */
  getAssetKey(url) {
    if (!url || typeof url !== 'string') return '';
    return url.split('?')[0].split('#')[0];
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
   * Extract concise keyword signal from discussion text.
   * @param {string} discussionContext
   * @param {number} limit
   * @returns {Array<string>}
   */
  extractDiscussionKeywords(discussionContext, limit = 10) {
    if (!discussionContext || typeof discussionContext !== 'string') return [];
    const cleanedDiscussion = discussionContext
      .replace(/^#{1,6}\s+/gm, ' ')
      .replace(/^\s*[-*]\s+/gm, ' ')
      .replace(/\b(round|team|discussion)\b/gi, ' ');
    const keywords = this.extractKeywords(cleanedDiscussion);
    return keywords.slice(0, limit);
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
      usedAssetKeys = new Set(),
      usedSources = new Map(),
      discussionContext = '',
      allowSourceFallback = true,
      unsplashOnly = false,
      refresh = false,
    } = options;

    const discussionKeywords = this.extractDiscussionKeywords(discussionContext);
    const discussionSnippet = discussionKeywords.join(' ');
    const slideQuery = this.buildSlideQuery(topic, slide, discussionSnippet);
    const fallbackQuery = [topic, slide.headline].filter(Boolean).join(' ').trim();
    const queries = unsplashOnly
      ? this.buildUnsplashQueries(topic, slide, discussionSnippet)
      : [...new Set([slideQuery, fallbackQuery, topic].filter(Boolean))];

    // Explicit Unsplash-only mode for consistent photo style across all slides.
    if (unsplashOnly) {
      for (const query of queries) {
        try {
          const images = await this.fetchFromUnsplash(query, Math.max(5, maxImagesPerQuery));
          if (images && images.length > 0) {
            const pick = images.find((img) => {
              if (!img.url || usedUrls.has(img.url)) return false;
              const assetKey = this.getAssetKey(img.url);
              if (!assetKey) return false;
              return !usedAssetKeys.has(assetKey);
            });
            if (pick && pick.url) {
              return { ...pick, final_score: 999 };
            }
          }
        } catch (_) {
          // Keep trying with next query.
        }
      }

      if (allowSourceFallback) {
        const q = `${topic} ${(slide.headline || '')}`.trim();
        const safe = encodeURIComponent(`gorpcore fashion outfit street style ${q}`.trim());
        const url = `https://source.unsplash.com/1080x1350/?${safe}&sig=${usedUrls.size + 1}`;
        return {
          url,
          full_url: url,
          source: 'unsplash-source-fallback',
          alt: q,
          score: 0.58,
          final_score: 0.58,
        };
      }
      return null;
    }

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

    if (!candidates.length) {
      if (!allowSourceFallback) return null;
      const fallbackQuery = [topic, slide.headline, slide.body, 'gorpcore fashion streetwear outfit']
        .filter(Boolean)
        .join(' ');
      const fallbackUrl = this.buildFallbackImageUrl(fallbackQuery, usedUrls.size + 1);
      return {
        url: fallbackUrl,
        full_url: fallbackUrl,
        source: 'unsplash-source-fallback',
        alt: fallbackQuery,
        score: 58,
        final_score: 58,
      };
    }

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
      const duplicateAssetPenalty = usedAssetKeys.has(this.getAssetKey(image.url)) ? 26 : 0;
      const sourceName = image.source || 'unknown';
      const usedCount = usedSources.get(sourceName) || 0;
      const sourceDiversityPenalty = Math.min(usedCount * 4, 16);
      const unsplashBonus = (this.unsplashApiKey && sourceName === 'unsplash') ? 18 : 0;
      return {
        ...image,
        final_score: Math.round((base + context + unsplashBonus - duplicatePenalty - duplicateAssetPenalty - sourceDiversityPenalty) * 100) / 100,
      };
    });

    ranked.sort((a, b) => b.final_score - a.final_score);
    return ranked.find((img) => {
      if (!img.url || usedUrls.has(img.url)) return false;
      const assetKey = this.getAssetKey(img.url);
      return assetKey && !usedAssetKeys.has(assetKey);
    }) || ranked.find((img) => !usedUrls.has(img.url)) || ranked[0] || null;
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
      discussionContext = '',
      unsplashOnly = false,
      refresh = false,
    } = options;

    const imageSlideTypes = new Set([
      'cover',
      'content',
      'content-badge',
      'content-stat',
      'content-image',
      'content-split',
      'content-fullimage',
      'cta',
    ]);
    const usedUrls = new Set(
      slides
        .map((slide) => slide.image_url)
        .filter((url) => typeof url === 'string' && url.trim().length > 0)
    );
    const usedAssetKeys = new Set(
      [...usedUrls].map((url) => this.getAssetKey(url)).filter(Boolean)
    );
    const usedSources = new Map();

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
        usedAssetKeys,
        usedSources,
        discussionContext,
        unsplashOnly,
        allowSourceFallback: true,
        refresh,
      });

      if (selected && selected.url) {
        slide.image_url = selected.url;
        usedUrls.add(selected.url);
        const assetKey = this.getAssetKey(selected.url);
        if (assetKey) usedAssetKeys.add(assetKey);
        if (selected.source) {
          usedSources.set(selected.source, (usedSources.get(selected.source) || 0) + 1);
        }
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
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'as', 'into',
      'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once',
      'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
      '의', '는', '이', '가', '을', '를', '와', '과', '하고', '의해', '에서', '에', '대해', '해서',
      '트렌드', '주제', '내용', '슬라이드', '카드뉴스', '라운드', '팀', '토론', '신상', '지금', '이번', '먼저',
    ]);

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
    const trustedSources = ['unsplash', 'pexels', 'wikimedia', 'pixabay', 'openverse', 'pollinations-ai'];
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
