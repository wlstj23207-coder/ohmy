'use strict';

const https = require('https');

/**
 * Pixabay Image Provider
 * Keyless API - ready to use with API key from environment or options
 */
class PixabayProvider {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.PIXABAY_API_KEY;
    this.baseUrl = 'https://pixabay.com/api/';
  }

  /**
   * Fetch images from Pixabay
   * @param {string} query - Search query
   * @param {number} limit - Maximum results
   * @param {object} options - Additional options
   * @returns {Promise<Array>} Array of image objects
   */
  async fetchImages(query, limit = 20, options = {}) {
    if (!this.apiKey) {
      throw new Error('Pixabay API key not configured');
    }

    const { orientation = 'portrait', category = 'all' } = options;

    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}?key=${this.apiKey}&q=${encodeURIComponent(query)}&per_page=${limit}&orientation=${orientation}&category=${category}`;

      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const images = this.parseImages(response.hits);
            resolve(images);
          } catch (error) {
            reject(new Error(`Pixabay API parse error: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Pixabay API error: ${error.message}`));
      });
    });
  }

  /**
   * Parse Pixabay response into standardized image objects
   * @param {Array} hits - Pixabay hits array
   * @returns {Array} Standardized image objects
   */
  parseImages(hits) {
    if (!Array.isArray(hits)) return [];

    return hits.map((hit, index) => {
      // Determine which image size to use based on orientation
      let imageUrl;
      if (hit.type === 'photo') {
        imageUrl = hit.webformatURL;
      } else {
        imageUrl = hit.webformatURL || hit.previewURL;
      }

      return {
        url: imageUrl,
        full_url: hit.largeImageURL || hit.largeURL || imageUrl,
        source: 'pixabay',
        photographer: hit.user,
        photographer_url: hit.user ? `https://pixabay.com/users/${hit.user}-${hit.user_id}` : null,
        alt: hit.tags || '',
        source_url: `https://pixabay.com/photos/${hit.id}-${hit.type === 'illustration' ? 'illustration' : 'photo'}`,
        width: hit.webformatWidth,
        height: hit.webformatHeight,
        id: hit.id,
        type: hit.type, // 'photo' or 'illustration'
        preview: {
          thumbnail: hit.previewURL,
          small: hit.smallImageURL,
          medium: hit.mediumImageURL,
        },
        // Licensing information
        license: 'pixabay-license',
        license_url: 'https://pixabay.com/license/',
        tags: hit.tags ? hit.tags.split(', ') : [],
        pageURL: `https://pixabay.com/photos/${hit.id}-${hit.type === 'illustration' ? 'illustration' : 'photo'}`,
      };
    });
  }

  /**
   * Get provider metadata
   * @returns {object} Provider information
   */
  getMetadata() {
    return {
      name: 'Pixabay',
      description: 'Free stock photos and illustrations with generous licensing',
      source: 'pixabay.com',
      requires_api_key: true,
      license: 'Pixabay License',
      license_url: 'https://pixabay.com/license/',
      orientation: 'portrait',
      supports_illustrations: true,
    };
  }

  /**
   * Test API connectivity
   * @returns {Promise<boolean>} True if API is accessible
   */
  async test() {
    try {
      if (!this.apiKey) {
        throw new Error('API key not configured');
      }

      // Make a simple test request
      const url = `${this.baseUrl}?key=${this.apiKey}&q=technology&per_page=1`;

      return new Promise((resolve, reject) => {
        https.get(url, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`API returned status ${res.statusCode}`));
            return;
          }
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              resolve(!!response.hits && response.hits.length > 0);
            } catch (error) {
              reject(new Error('Failed to parse API response'));
            }
          });
        }).on('error', reject);
      });
    } catch (error) {
      console.error('Pixabay test error:', error.message);
      return false;
    }
  }
}

module.exports = PixabayProvider;
