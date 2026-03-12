'use strict';

const fs = require('fs');
const path = require('path');
const ImageFetcher = require('./image-fetcher');

const configPath = path.join(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function inferTopicFromSlides(slides) {
  const cover = slides.find((slide) => slide.type === 'cover');
  if (cover && cover.headline) return cover.headline;

  const firstHeadline = slides.find((slide) => slide.headline);
  return firstHeadline ? firstHeadline.headline : '카드뉴스';
}

function loadDiscussionContext(discussionPath) {
  if (!discussionPath) return '';
  if (!fs.existsSync(discussionPath)) return '';
  return fs.readFileSync(discussionPath, 'utf8');
}

async function enrichSlidesWithImages(opts = {}) {
  const slidesPath = opts.slidesPath || path.join(process.cwd(), config.workspace_dir, 'slides.json');
  const discussionPath = opts.discussionPath || path.join(process.cwd(), config.workspace_dir, 'discussion.md');
  const minScore = Number.isFinite(Number(opts.minScore)) ? Number(opts.minScore) : 60;
  const maxImagesPerQuery = Number.isFinite(Number(opts.maxImagesPerQuery)) ? Number(opts.maxImagesPerQuery) : 8;
  const force = !!opts.force;
  const refresh = !!opts.refresh;
  const pinterestOnly = opts.pinterestOnly !== false;
  const unsplashOnly = !!opts.unsplashOnly;
  const write = opts.write !== false;

  if (!fs.existsSync(slidesPath)) {
    throw new Error(`slides.json not found at: ${slidesPath}`);
  }

  const slides = JSON.parse(fs.readFileSync(slidesPath, 'utf8'));
  const topic = opts.topic || inferTopicFromSlides(slides);
  const discussionContext = loadDiscussionContext(discussionPath);
  const fetcher = new ImageFetcher({
    maxImages: Math.max(maxImagesPerQuery, 6),
  });

  console.log(`🧠 Enriching slides with topic-aware images`);
  console.log(`   topic: "${topic}"`);
  if (discussionContext) {
    console.log(`   discussion context loaded: ${discussionPath}`);
  }
  console.log(`   minScore: ${minScore}, maxImagesPerQuery: ${maxImagesPerQuery}, force: ${force}`);
  console.log(`   pinterestOnly: ${pinterestOnly}`);
  console.log(`   unsplashOnly: ${unsplashOnly}`);

  const result = await fetcher.attachImagesToSlides(slides, topic, {
    force,
    minScore,
    maxImagesPerQuery,
    discussionContext,
    pinterestOnly,
    unsplashOnly,
    refresh,
  });

  if (write) {
    fs.writeFileSync(slidesPath, JSON.stringify(result.slides, null, 2), 'utf8');
    console.log(`✓ Updated slides written to: ${slidesPath}`);
  }

  console.log(`✓ Image enrichment done (attached=${result.summary.attached}, skipped=${result.summary.skipped})`);
  return result;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i += 1) {
    switch (args[i]) {
      case '--slides':
        opts.slidesPath = args[++i];
        break;
      case '--topic':
        opts.topic = args[++i];
        break;
      case '--discussion-file':
        opts.discussionPath = args[++i];
        break;
      case '--min-score':
        opts.minScore = Number(args[++i]);
        break;
      case '--max-per-query':
        opts.maxImagesPerQuery = Number(args[++i]);
        break;
      case '--force':
        opts.force = true;
        break;
      case '--refresh':
        opts.refresh = true;
        break;
      case '--dry-run':
        opts.write = false;
        break;
      case '--unsplash-only':
        opts.unsplashOnly = true;
        opts.pinterestOnly = false;
        break;
      case '--pinterest-only':
        opts.pinterestOnly = true;
        opts.unsplashOnly = false;
        break;
      case '--allow-multi-provider':
        opts.pinterestOnly = false;
        opts.unsplashOnly = false;
        break;
      default:
        console.warn(`Unknown argument: ${args[i]}`);
    }
  }

  return opts;
}

if (require.main === module) {
  const opts = parseArgs(process.argv);
  enrichSlidesWithImages(opts).catch((error) => {
    console.error('Image enrichment failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  enrichSlidesWithImages,
  inferTopicFromSlides,
};
