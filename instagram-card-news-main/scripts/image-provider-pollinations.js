'use strict';

/**
 * Pollinations AI Image Provider (keyless)
 * Generates topic-aligned AI image URLs directly from prompts.
 */
class PollinationsProvider {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://image.pollinations.ai/prompt/';
    this.width = options.width || 1080;
    this.height = options.height || 1350;
    this.model = options.model || 'flux';
  }

  /**
   * Build a Pollinations URL from prompt and seed.
   * @param {string} prompt
   * @param {number} seed
   * @returns {string}
   */
  buildUrl(prompt, seed) {
    const encodedPrompt = encodeURIComponent(prompt);
    const params = new URLSearchParams({
      width: String(this.width),
      height: String(this.height),
      model: this.model,
      seed: String(seed),
      nologo: 'true',
      enhance: 'true',
      safe: 'true',
    });
    return `${this.baseUrl}${encodedPrompt}?${params.toString()}`;
  }

  /**
   * Return synthetic AI image candidates (no API key required).
   * @param {string} query
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async fetchImages(query, limit = 8) {
    const styleBase = `${query}, editorial fashion photo, gorpcore outfit, urban street style, high detail, natural lighting`;
    const count = Math.max(1, Math.min(limit, 10));
    const images = [];

    for (let i = 0; i < count; i += 1) {
      const seed = 1000 + i;
      const prompt = `${styleBase}, variant ${i + 1}`;
      const url = this.buildUrl(prompt, seed);
      images.push({
        url,
        full_url: url,
        source: 'pollinations-ai',
        photographer: 'AI Generated',
        photographer_url: null,
        alt: query,
        source_url: url,
        width: this.width,
        height: this.height,
        id: `pollinations-${seed}`,
        title: query,
        description: prompt,
        tags: ['ai', 'generated', 'fashion', 'gorpcore'],
        type: 'photo',
      });
    }

    return images;
  }

  getMetadata() {
    return {
      name: 'Pollinations AI',
      description: 'Keyless AI image generation from text prompts',
      source: 'pollinations.ai',
      requires_api_key: false,
      license: 'platform terms',
      orientation: 'vertical',
      supports_illustrations: true,
      supports_photos: true,
      supports_videos: false,
    };
  }

  async test() {
    return true;
  }
}

module.exports = PollinationsProvider;
