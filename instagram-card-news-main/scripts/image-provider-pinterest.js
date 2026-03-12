'use strict';

const https = require('https');

/**
 * Pinterest Image Provider (keyless, HTML scrape)
 * Note: This relies on publicly available search pages.
 */
class PinterestProvider {
  async fetchImages(query, limit = 20) {
    return new Promise((resolve, reject) => {
      const q = encodeURIComponent(query);
      const url = `https://www.pinterest.com/search/pins/?q=${q}`;

      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`Pinterest HTTP ${res.statusCode}`));
              return;
            }

            const urls = this.extractPinimgUrls(data, limit);
            const images = urls.map((u, i) => ({
              url: u,
              full_url: u,
              source: 'pinterest',
              alt: query,
              title: query,
              description: query,
              source_url: `https://www.pinterest.com/search/pins/?q=${q}`,
              id: `pin-${i + 1}`,
              width: null,
              height: null,
              tags: query.split(/\s+/).filter(Boolean),
            }));

            resolve(images);
          } catch (error) {
            reject(new Error(`Pinterest parse error: ${error.message}`));
          }
        });
      }).on('error', (error) => {
        reject(new Error(`Pinterest error: ${error.message}`));
      });
    });
  }

  extractPinimgUrls(html, limit = 20) {
    const out = new Set();
    if (!html || typeof html !== 'string') return [];

    const patterns = [
      /https:\\\/\\\/i\.pinimg\.com\\\/[^"'\\\s]+/g,
      /https:\/\/i\.pinimg\.com\/[^"'\s<)]+/g,
    ];

    for (const pattern of patterns) {
      const matches = html.match(pattern) || [];
      for (const raw of matches) {
        const normalized = raw
          .replace(/\\u002F/g, '/')
          .replace(/\\\//g, '/')
          .replace(/\\/g, '');

        if (!normalized.startsWith('https://i.pinimg.com/')) continue;
        const upgraded = normalized.replace(/\/(\d+)x\//, '/736x/');
        out.add(upgraded);
        if (out.size >= limit) break;
      }
      if (out.size >= limit) break;
    }

    return [...out];
  }
}

module.exports = PinterestProvider;

