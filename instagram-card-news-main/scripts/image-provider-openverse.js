'use strict';

const https = require('https');

/**
 * Openverse Image Provider (keyless)
 * API: https://api.openverse.org/v1/images
 */
class OpenverseProvider {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://api.openverse.engineering/v1/images/';
  }

  /**
   * Fetch images from Openverse.
   * @param {string} query
   * @param {number} limit
   * @param {object} options
   * @returns {Promise<Array>}
   */
  async fetchImages(query, limit = 20, options = {}) {
    const {
      orientation = 'vertical',
      licenseType = 'commercial',
      mature = false,
    } = options;

    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        q: query,
        page_size: String(limit),
        orientation,
        license_type: licenseType,
        mature: mature ? 'true' : 'false',
      });

      const url = `${this.baseUrl}?${params.toString()}`;

      https.get(url, {
        headers: {
          'User-Agent': 'instagram-card-news/1.0',
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`Openverse API HTTP ${res.statusCode}: ${data.slice(0, 160)}`));
              return;
            }
            if (!data || !data.trim()) {
              reject(new Error('Openverse API returned empty body'));
              return;
            }
            const response = JSON.parse(data);
            const images = this.parseImages(response.results || []);
            resolve(images);
          } catch (error) {
            reject(new Error(`Openverse API parse error: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Openverse API error: ${error.message}`));
      });
    });
  }

  /**
   * Normalize Openverse results.
   * @param {Array} results
   * @returns {Array}
   */
  parseImages(results) {
    if (!Array.isArray(results)) return [];

    return results
      .filter((item) => item.url)
      .map((item) => ({
        url: item.thumbnail || item.url,
        full_url: item.url,
        source: 'openverse',
        photographer: item.creator || 'Unknown',
        photographer_url: item.creator_url || null,
        alt: item.title || item.foreign_landing_url || '',
        source_url: item.foreign_landing_url || item.url,
        width: item.width || null,
        height: item.height || null,
        id: item.id || item.identifier || null,
        title: item.title || '',
        description: item.caption || '',
        license: item.license || '',
        license_url: item.license_url || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
      }));
  }

  getMetadata() {
    return {
      name: 'Openverse',
      description: 'Openly-licensed images with rich license metadata',
      source: 'openverse.org',
      requires_api_key: false,
      license: 'various open licenses',
      orientation: 'vertical',
      supports_illustrations: true,
      supports_photos: true,
      supports_videos: false,
    };
  }

  async test() {
    try {
      const result = await this.fetchImages('technology', 1);
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }
}

module.exports = OpenverseProvider;
