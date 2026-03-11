'use strict';

/**
 * Wikimedia Commons Image Provider
 * Keyless API - no API key required
 */
class WikimediaProvider {
  constructor(options = {}) {
    this.baseUrl = 'https://commons.wikimedia.org/w/api.php';
    this.site = options.site || 'commons';
  }

  /**
   * Fetch images from Wikimedia Commons
   * @param {string} query - Search query
   * @param {number} limit - Maximum results
   * @param {object} options - Additional options
   * @returns {Promise<Array>} Array of image objects
   */
  async fetchImages(query, limit = 20, options = {}) {
    const { imageusage = 'all', prop = 'imageinfo' } = options;

    return new Promise((resolve, reject) => {
      // Build API URL
      const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: limit,
        srprop: 'imageinfo|snippet',
        iiprop: 'url|size|extmetadata|user|timestamp|license|url',
        iiurlwidth: 1080,
        iiurlheight: 1350,
        format: 'json',
      });

      const url = `${this.baseUrl}?${params.toString()}`;

      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const images = this.parseImages(response.query.search);
            resolve(images);
          } catch (error) {
            reject(new Error(`Wikimedia API parse error: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Wikimedia API error: ${error.message}`));
      });
    });
  }

  /**
   * Parse Wikimedia search results into standardized image objects
   * @param {Array} searchResults - Wikimedia search results
   * @returns {Array} Standardized image objects
   */
  parseImages(searchResults) {
    if (!Array.isArray(searchResults)) return [];

    return searchResults.map((result) => {
      // Find image info in the results
      const imageInfo = result.imageinfo ? result.imageinfo[0] : null;
      if (!imageInfo) {
        return null;
      }

      // Extract image metadata
      const { thumburl, width, height, extmetadata } = imageInfo;
      const url = thumburl || imageInfo.url;

      // Try to extract metadata
      let title = result.title.replace('File:', '').replace('Image:', '');
      let description = result.snippet.replace(/<\/?[^>]+>/g, '');

      // Get uploader info
      const user = imageInfo.user || 'Wikimedia User';

      // Extract license information
      let license = 'unknown';
      let licenseUrl = null;
      let copyrightHolder = null;

      if (extmetadata) {
        const licenseData = extmetadata.LicenseShortName || extmetadata.License;
        if (licenseData && licenseData.value) {
          license = licenseData.value;
        }

        const urlData = extmetadata.LicenseUrl;
        if (urlData && urlData.value) {
          licenseUrl = urlData.value;
        }

        const authorData = extmetadata.Artist;
        if (authorData && authorData.value) {
          copyrightHolder = authorData.value;
        }
      }

      // Extract Wikimedia category/namespace
      const namespace = result.title.startsWith('File:') ? 'file' :
                       result.title.startsWith('Category:') ? 'category' : 'other';

      return {
        url: url,
        full_url: imageInfo.url || url,
        source: 'wikimedia',
        photographer: user,
        photographer_url: `https://commons.wikimedia.org/wiki/Special:Contributions/${encodeURIComponent(user)}`,
        alt: title,
        source_url: `https://commons.wikimedia.org/wiki/File:${result.title.replace('File:', '').replace('Image:', '')}`,
        width: width,
        height: height,
        id: result.pageid,
        namespace: namespace,
        title: title,
        description: description,
        timestamp: imageInfo.timestamp,
        // Licensing information
        license: license,
        license_url: licenseUrl,
        timestamp: imageInfo.timestamp,
        // Wikimedia specific metadata
        thumburl: thumburl,
        iiurlwidth: width,
        iiurlheight: height,
        pageURL: `https://commons.wikimedia.org/wiki/${result.title}`,
        // Extract tags from title if available
        tags: this.extractTags(result.title),
      };
    }).filter(img => img !== null);
  }

  /**
   * Extract tags from file title
   * @param {string} title - File title
   * @returns {Array} Array of tags
   */
  extractTags(title) {
    // Remove file prefix and extension
    let cleanTitle = title.replace('File:', '').replace('Image:', '');
    cleanTitle = cleanTitle.replace(/\.[^/.]+$/, '');

    // Split by common separators
    return cleanTitle
      .split(/[_\s-,]+/)
      .filter(tag => tag.length > 2)
      .slice(0, 5); // Limit to 5 tags
  }

  /**
   * Get provider metadata
   * @returns {object} Provider information
   */
  getMetadata() {
    return {
      name: 'Wikimedia Commons',
      description: 'Free media repository with millions of images, illustrations, and more',
      source: 'commons.wikimedia.org',
      requires_api_key: false,
      license: 'Various (CC BY-SA, Public Domain, etc.)',
      orientation: 'any',
      supports_illustrations: true,
      supports_photos: true,
      supports_videos: false,
    };
  }

  /**
   * Test API connectivity
   * @returns {Promise<boolean>} True if API is accessible
   */
  async test() {
    try {
      // Make a simple test request
      const params = new URLSearchParams({
        action: 'query',
        list: 'random',
        rnnamespace: 6, // File namespace
        rnlimit: 1,
        format: 'json',
      });

      const url = `${this.baseUrl}?${params.toString()}`;

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
              resolve(!!response.query.random && response.query.random.length > 0);
            } catch (error) {
              reject(new Error('Failed to parse API response'));
            }
          });
        }).on('error', reject);
      });
    } catch (error) {
      console.error('Wikimedia test error:', error.message);
      return false;
    }
  }

  /**
   * Search by category instead of keyword
   * @param {string} category - Category name
   * @param {number} limit - Maximum results
   * @returns {Promise<Array>} Array of image objects
   */
  async fetchByCategory(category, limit = 20) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        action: 'query',
        list: 'categorymembers',
        cmtitle: `Category:${category}`,
        cmlimit: limit,
        cmtype: 'file',
        prop: 'imageinfo',
        iiprop: 'url|size|extmetadata|user|timestamp|license|url',
        iiurlwidth: 1080,
        iiurlheight: 1350,
        format: 'json',
      });

      const url = `${this.baseUrl}?${params.toString()}`;

      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const images = this.parseCategoryImages(response.query.categorymembers);
            resolve(images);
          } catch (error) {
            reject(new Error(`Wikimedia API parse error: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Wikimedia API error: ${error.message}`));
      });
    });
  }

  /**
   * Parse category members into image objects
   * @param {Array} categoryMembers - Category members
   * @returns {Array} Standardized image objects
   */
  parseCategoryImages(categoryMembers) {
    if (!Array.isArray(categoryMembers)) return [];

    return categoryMembers.map((member) => {
      const imageInfo = member.imageinfo ? member.imageinfo[0] : null;
      if (!imageInfo) {
        return null;
      }

      const { thumburl, width, height, extmetadata } = imageInfo;
      const url = thumburl || imageInfo.url;

      let title = member.title.replace('File:', '').replace('Image:', '');
      let description = member.title;

      const user = imageInfo.user || 'Wikimedia User';

      let license = 'unknown';
      let licenseUrl = null;
      let copyrightHolder = null;

      if (extmetadata) {
        const licenseData = extmetadata.LicenseShortName || extmetadata.License;
        if (licenseData && licenseData.value) {
          license = licenseData.value;
        }

        const urlData = extmetadata.LicenseUrl;
        if (urlData && urlData.value) {
          licenseUrl = urlData.value;
        }

        const authorData = extmetadata.Artist;
        if (authorData && authorData.value) {
          copyrightHolder = authorData.value;
        }
      }

      return {
        url: url,
        full_url: imageInfo.url || url,
        source: 'wikimedia',
        photographer: user,
        photographer_url: `https://commons.wikimedia.org/wiki/Special:Contributions/${encodeURIComponent(user)}`,
        alt: title,
        source_url: `https://commons.wikimedia.org/wiki/File:${member.title.replace('File:', '').replace('Image:', '')}`,
        width: width,
        height: height,
        id: member.pageid,
        namespace: 'category',
        title: title,
        description: description,
        timestamp: imageInfo.timestamp,
        license: license,
        license_url: licenseUrl,
        timestamp: imageInfo.timestamp,
        thumburl: thumburl,
        iiurlwidth: width,
        iiurlheight: height,
        pageURL: `https://commons.wikimedia.org/wiki/${member.title}`,
        tags: this.extractTags(member.title),
      };
    }).filter(img => img !== null);
  }
}

module.exports = WikimediaProvider;
