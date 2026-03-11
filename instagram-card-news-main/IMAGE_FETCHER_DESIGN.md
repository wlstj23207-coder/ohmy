# Intelligent Image Fetcher Feature Design
## For ohmy (Instagram Card News App)

---

## 📋 Feature Overview

### Goal
Automatically fetch relevant images for discussion threads in the ohmy Instagram card news generator, enhancing visual engagement while maintaining design system consistency.

### Core Problem Solved
- Users manually search for images to include in card news slides
- Topic-relevant images can significantly increase engagement (improving click-through and retention rates)
- Integration point exists (content-image, content-fullimage slide types already support image_url)
- User wants "토론할 때마다 토론 연관 사진들을 가져오는 기능" (fetch discussion-relevant images for every thread)

---

## 🏗️ Component Architecture

### 1. Image Fetcher Service (New Component)

**Location**: `scripts/image-fetcher.js`

**Responsibilities**:
- Image search API integration
- Relevance scoring algorithms
- Image validation and filtering
- Image downloading and caching

**Architecture Pattern**: Service Layer

```javascript
class ImageFetcher {
  constructor(options = {}) {
    this.searchEngine = options.searchEngine || 'google-images'
    this.relevanceScore = options.relevanceScore || 'semantic'
    this.cacheSize = options.cacheSize || 50
    this.maxImages = options.maxImages || 10
    this.qualityFilter = options.qualityFilter || ['high', 'medium']
  }

  // Main entry point
  async fetchImages(topic, options = {}) {
    // Step 1: Search relevant images
    // Step 2: Score and filter
    // Step 3: Download and validate
    // Step 4: Cache results
    // Step 5: Return formatted image objects
  }

  // Helper methods
  async searchImages(topic, options)
  async scoreImages(images, topic, options)
  async downloadAndValidate(imageUrls, options)
  async cacheImages(imageObjects, topic)
}
```

### 2. Relevance Scoring Engine

**Location**: `scripts/image-scorer.js`

**Scoring Dimensions** (Weighted Score: 0-100):

| Dimension | Description | Weight |
|-----------|-------------|--------|
| **Semantic Relevance** | Matches topic keywords, entities, and context | 35% |
| **Visual Quality** | Resolution, sharpness, aesthetic appeal | 25% |
| **Image Source** | Trusted sources (news, official, reputable) | 15% |
| **Usage Rights** | License compatibility | 15% |
| **Engagement Potential** | Visual impact, color vibrancy, emotional appeal | 10% |

**Scoring Logic**:
```javascript
const score = (
  semanticRelevance * 0.35 +
  visualQuality * 0.25 +
  imageSourceTrust * 0.15 +
  usageRightsScore * 0.15 +
  engagementPotential * 0.10
)
```

**Semantic Relevance Calculation**:
- TF-IDF matching with topic keywords
- Entity recognition (person, place, thing, concept)
- Contextual understanding (time period, tone, style)
- Duplicate detection (exclude near-identical images)

**Example Output**:
```json
{
  "image_url": "https://example.com/ai-robot.jpg",
  "relevance_score": 87.3,
  "metadata": {
    "source": "nasa.gov",
    "resolution": "1920x1080",
    "license": "public-domain",
    "color_palette": ["#3B82F6", "#1D4ED8"],
    "dominant_subject": "robot, technology, ai"
  }
}
```

### 3. Image Cache System

**Location**: `workspace/image-cache.json`

**Purpose**:
- Cache fetched images by topic for reuse
- Reduce API calls and costs
- Maintain version history for A/B testing

**Cache Structure**:
```json
{
  "last_updated": "2026-03-11T21:30:00Z",
  "entries": [
    {
      "topic": "AI trends 2025",
      "images": [
        {
          "image_url": "https://example.com/image1.jpg",
          "cached_at": "2026-03-11T21:30:00Z",
          "usage_count": 3
        },
        {
          "image_url": "https://example.com/image2.jpg",
          "cached_at": "2026-03-11T21:30:00Z",
          "usage_count": 1
        }
      ],
      "source": "google-images"
    }
  ]
}
```

### 4. Template Extension

**Existing Templates Support**:
- `content-image` (add image_url field)
- `content-fullimage` (add image_url field)

**New Template Type**:
- `content-image-slider` (carousel-style image slides)

**Template Modification**:
```html
<!-- content-image.html - Added Image Options Section -->
<div class="image-controls">
  <select id="image-usage" class="image-usage-select">
    <option value="random">Random Image</option>
    <option value="topic-matched">Topic-Matched (Auto)</option>
    <option value="user-selected">User Selected</option>
  </select>
  <div id="image-preview" class="image-preview">
    <!-- Preview area -->
  </div>
  <button id="refresh-images" class="refresh-button">
    🔄 Refresh Images
  </button>
</div>
```

### 5. Workflow Integration Points

**Existing Workflow**:
```
1. User Request
2. Research (research.md)
3. Research Verification (Team Mode)
4. Copywriting (slides.json)
5. Copy Debate (Team Mode)
6. Rendering
7. Review
```

**Enhanced Workflow with Image Fetcher**:
```
1. User Request
2. Research (research.md)
3. Research Verification (Team Mode)
4. Copywriting (slides.json)
   ↓
5. IMAGE FETCHING (New Step)
   - Auto-fetch for topic-matched slides
   - User can override
   - Random mode for variety
6. Copy Debate (Team Mode) - Now with image suggestions
7. Rendering (with images)
8. Review
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER REQUEST                                │
│            "AI 프롬프트 팁으로 카드뉴스 만들어줘"                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 STEP 1: REQUEST PARSING                        │
│   - Parse topic, tone, slide_count, template, accent_color      │
│   - Extract image_preferences: random/topic-matched/user-selected│
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 STEP 2: RESEARCH (research.md)                  │
│   - Web search for topic                                        │
│   - Extract key points, statistics, quotes                       │
│   - Identify potential image topics from content                  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 2.5: RESEARCH VERIFICATION                    │
│   (Team Mode: FactChecker + ComplementResearcher)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 3: COPYWRITING (slides.json)                  │
│   - Generate slide structure                                     │
│   - Determine which slides need images (content-image,          │
│     content-fullimage types)                                    │
│   - Include image_usage field: "random" | "topic-matched"       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│         STEP 5: IMAGE FETCHING (NEW - Auto)                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ImageFetcher.searchImages(topic, image_usage)           │   │
│  │    ↓                                                     │   │
│  │  - Search with keywords from research.md                 │   │
│  │  - Extract 10-20 candidate URLs                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│    ↓                                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ImageScorer.scoreImages(images, topic)                  │   │
│  │    ↓                                                     │   │
│  │  - Semantic relevance: 35%                               │   │
│  │  - Visual quality: 25%                                   │   │
│  │  - Source trust: 15%                                     │   │
│  │  - Usage rights: 15%                                     │   │
│  │  - Engagement: 10%                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│    ↓                                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Filter top 5-10 images by score ≥ 70                    │   │
│  │  - Add metadata: source, resolution, license, etc.      │   │
│  └─────────────────────────────────────────────────────────┘   │
│    ↓                                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ImageCache.add(topic, images)                           │   │
│  │  - Cache for future use (reduce API calls)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│    ↓                                                             │
│  Return: Array<{url, score, metadata}>                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 3.5: COPY DEBATE (Team Mode)                  │
│   - Copywriter: Include image suggestions in slides.json        │
│   - Hook Expert: Evaluate visual impact of suggested images      │
│   - Copy Editor: Ensure image placement doesn't hurt readability │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 4: RENDERING                                  │
│   - Load slides.json                                           │
│   - Replace {{image_url}} placeholders with fetched images     │
│   - If image_url is empty → Show placeholder icon             │
│   - Render HTML to PNG via Puppeteer                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              STEP 5: REVIEW                                     │
│   - Visual review of images                                     │
│   - Check for cropping issues, text readability               │
│   - Feedback loop back to Step 3 if needed                      │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      OUTPUT                                     │
│   - Card news slides in output/                                 │
│   - image-metadata.json (for A/B testing, analytics)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔌 API Integration Points

### 1. Google Custom Search API
**Primary Image Search Engine**

**Requirements**:
- Google Cloud Platform account
- Enable Custom Search API
- Enable Image Search

**Usage**:
```javascript
const googleSearch = require('google-search-api')

async function searchWithGoogleAPI(topic) {
  const search = new googleSearch({
    key: process.env.GOOGLE_SEARCH_API_KEY,
    cx: process.env.GOOGLE_SEARCH_ENGINE_ID
  })

  const results = await search.json({
    q: `${topic} image`,
    num: 20,
    searchType: 'image'
  })

  return results.items.map(item => ({
    title: item.title,
    link: item.link,
    contextLink: item.contextLink
  }))
}
```

**Advantages**:
- High-quality, diverse results
- Fast response time
- Well-documented API
- Language support (Korean)

**Integration Point**:
```json
// In slides.json
{
  "slide": 5,
  "type": "content-image",
  "headline": "키워드 이미지 예시",
  "body": "이미지가 포함된 슬라이드 예시입니다.",
  "image_usage": "topic-matched",
  "image_options": {
    "api": "google",
    "search_queries": [
      "AI 프롬프트 팁",
      "ChatGPT 사용법",
      "프롬프트 엔지니어링"
    ],
    "max_images": 10
  }
}
```

### 2. Unsplash API (Alternative/Bonus)

**Requirements**:
- Free tier available
- Creative Commons license
- High-quality, curated images

**Usage**:
```javascript
const unsplash = require('unsplash-api')

const unsplashClient = unsplash.createClient({
  applicationId: process.env.UNSPLASH_ACCESS_KEY,
  secret: process.env.UNSPLASH_SECRET,
  callbackUrl: 'https://your-domain.com/callback'
})

async function searchWithUnsplash(query) {
  const results = await unsplashClient.search.photos({
    query: query,
    perPage: 15,
    orientation: 'portrait' // 1080x1350 format
  })

  return results.photos.map(photo => ({
    url: photo.urls.regular,
    full: photo.urls.full,
    raw: photo.urls.raw,
    photographer: photo.user.name,
    location: photo.location?.title
  }))
}
```

**Integration Point**:
```json
{
  "image_options": {
    "api": "unsplash",
    "keywords": ["technology", "AI", "future"],
    "orientation": "portrait"
  }
}
```

### 3. Image Source Validation

**Integrated with Existing Research**:
```javascript
// Extract potential image sources from research.md
function extractImageSources(researchContent) {
  const sources = []

  // Keywords that indicate images should be included
  const imageTriggerKeywords = [
    '그래프', '데이터', '통계', '시각화',
    '인용구', '인터뷰', '사진', '영상',
    '연구', '스톡', '이미지'
  ]

  const lines = researchContent.split('\n')
  for (const line of lines) {
    if (imageTriggerKeywords.some(kw => line.includes(kw))) {
      sources.push(line.trim())
    }
  }

  return [...new Set(sources)] // Deduplicate
}
```

---

## 🎨 UX Considerations

### User Controls

#### 1. Image Selection Modal

**Trigger**: When rendering completes, show modal with:
- Number of slides with images
- "Review Images" button → Opens modal
- "Skip to Next Step" button

**Modal Layout**:
```
┌──────────────────────────────────────────────┐
│  Image Selection                             │
├──────────────────────────────────────────────┤
│                                              │
│  5 of 10 slides include images:              │
│                                              │
│  [Slide 3]  📷 Image: AI Robot               │
│              ✓ Topic-Matched (Score: 87)     │
│                                              │
│  [Slide 5]  📷 Image: Chart + Text           │
│              ⚠️ Moderate relevance (62)      │
│                                              │
│  [Slide 7]  📷 Image: Person Speaking        │
│              ✓ Topic-Matched (91)            │
│                                              │
│  [Slide 9]  📷 Image: Laptop Screen          │
│              ✓ Topic-Matched (78)            │
│                                              │
│  [Slide 10] 📷 Image: Code Snippet           │
│              ⚠️ Low relevance (45)           │
│                                              │
│  ─────────────────────────────────────────── │
│                                              │
│  [Change All to Random]  [Use Current]       │
│  [Refresh for Topic-Matched]  [Open in Browser]│
│                                              │
└──────────────────────────────────────────────┘
```

#### 2. Image Preference Options

**Default Options** (configurable via CLAUDE.md):
- `random`: Random images for visual variety
- `topic-matched`: Auto-fetch based on topic (default)
- `user-selected`: Manual selection (for critical content)

**User-Configurable** (via flags):
```bash
# CLI flags
--image-mode random           # Random images
--image-mode topic-matched     # Auto-fetch (default)
--image-mode user-selected     # Manual selection
--image-quality high           # High-quality only
--image-sources google         # Only Google Search
--image-sources unsplash       # Only Unsplash
```

#### 3. Manual Image Override

**For Critical Slides** (Slide Types):
- `content-image` (high priority)
- `content-fullimage` (highest priority)
- `cover` (first slide, highest priority)

**Override Method**:
```json
{
  "slide": 5,
  "type": "content-image",
  "headline": "...",
  "body": "...",
  "image_url": "https://user-provided.com/image.jpg" // User overrides auto-fetch
}
```

### Visual Preview

**Real-time Preview Before Rendering**:
```
┌──────────────────────────────────────────────┐
│  Image Preview                               │
├──────────────────────────────────────────────┤
│                                              │
│   [Large Image Preview]                      │
│   ┌─────────────────────┐                    │
│   │                     │                    │
│   │   [image_shown]     │                    │
│   │                     │                    │
│   └─────────────────────┘                    │
│                                              │
│   Controls:                                  │
│   [⏮️ Prev] [Next ▶️] [Refresh 🔃]           │
│                                              │
│   Metadata:                                  │
│   Source: nasa.gov                           │
│   Resolution: 1920x1080                      │
│   Score: 87/100                              │
│   License: Public Domain                     │
│                                              │
│   Actions:                                   │
│   [✓ Use This Image]  [✗ Skip]               │
│                                              │
└──────────────────────────────────────────────┘
```

### Error Handling

#### 1. Image Fetch Failures

**Graceful Degradation**:
```javascript
if (error) {
  console.warn(`Image fetch failed: ${error.message}`)
  // Fallback to placeholder icon
  return {
    image_url: null,
    fallback: true,
    message: "Image not available"
  }
}
```

**User Feedback**:
- "이미지를 가져오는데 실패했습니다. 대체 이미지를 사용합니다."
- Show placeholder icon with message
- Suggest manual image selection

#### 2. Low Quality Images

**Auto-rejection**:
- Resolution < 800px (vertical) or < 600px (horizontal)
- Blurry or pixelated
- Watermarked or low-quality source

**User Option**:
```json
{
  "image_options": {
    "min_resolution": { "width": 1080, "height": 1350 },
    "max_watermark_pct": 10, // Max 10% watermark
    "fallback_on_error": true
  }
}
```

#### 3. Usage Rights Issues

**License Check**:
- Commercial use? (Check license type)
- Attribution required? (Display photographer credit)
- Restrictions? (No modifications, no embedding)

**User Notification**:
- "이미지의 저작권을 확인했습니다 (CC BY 4.0)"
- "크레딧 표시가 필요합니다: @photographer"

---

## 📱 Integration with Existing Flow

### 1. CLAUDE.md Updates

**Add New Step After Research Verification**:
```markdown
### Step 5: Image Fetching (Auto)

When slides.json contains `content-image` or `content-fullimage` slides with
`image_usage` set to `"topic-matched"`:

**1. Search Images**:
- Extract keywords from research.md and slides.json
- Call ImageFetcher.searchImages(topic, { mode: 'topic-matched' })
- Fetch 10-20 candidate URLs

**2. Score Images**:
- Run ImageScorer.scoreImages(images, topic)
- Calculate relevance scores (0-100)

**3. Filter and Download**:
- Filter images with score ≥ 70
- Download top 5 images
- Validate quality (resolution, license)

**4. Cache Results**:
- Save to workspace/image-cache.json by topic
- Include metadata for future reference

**5. Update slides.json**:
- Replace `{{image_url}}` placeholders with URLs
- Store original placeholder for fallback

**Output**: slides.json with image URLs in `content-image` and `content-fullimage` slides

---

### Step 3.5: Copy Debate (Enhanced)

**New Agent Role**: Visual Designer Agent
- Evaluates image suggestions for visual impact
- Checks for potential readability issues
- Suggests image placement optimizations

**Evaluation Criteria**:
- Image resolution and quality
- Color contrast with text
- Image distraction level
- Alignment with headline/body content

**Team Composition**:
| Role | Agent | Model | Task |
|------|-------|-------|------|
| Copywriter | `copywriter` | sonnet | Integrate images into copywriting |
| Hook Expert | `hook-expert` | sonnet | Evaluate visual hook potential |
| Visual Designer | `visual-designer` | sonnet | Assess image quality and placement |

**Output**: Final slides.json with image URLs and Visual Designer feedback
```

### 2. slides.json Format Update

**Add Image Field**:
```json
{
  "slide": 5,
  "type": "content-image",
  "headline": "프롬프트 엔지니어링의 핵심",
  "body": "프롬프트를 잘 작성하면 AI 모델의 성능을 극대화할 수 있습니다.",
  "image_usage": "topic-matched",
  "image_metadata": {
    "source": "google-images",
    "relevance_score": 87.3,
    "cached_at": "2026-03-11T21:30:00Z",
    "options": {
      "search_queries": ["프롬프트 엔지니어링", "ChatGPT 팁"],
      "max_images": 10
    }
  }
}
```

### 3. Template HTML Updates

**Add Error Handling**:
```html
<div class="image-area">
  <img
    src="{{image_url}}"
    alt="content image"
    onerror="this.style.display='none'; this.parentElement.querySelector('.image-placeholder').style.display='flex';"
    onload="this.style.opacity = '1'; this.style.transition = 'opacity 0.3s';"
  />
  <div class="image-placeholder" style="display: none;">
    <!-- Placeholder SVG -->
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <rect x="8" y="16" width="56" height="44" rx="6" stroke="#D1D5DB" stroke-width="3"/>
      <circle cx="26" cy="30" r="6" stroke="#D1D5DB" stroke-width="3"/>
      <path d="M8 46 L22 32 L34 44 L44 34 L64 52" stroke="#D1D5DB" stroke-width="3"/>
    </svg>
    <p class="placeholder-text">이미지를 찾을 수 없습니다</p>
  </div>
</div>
```

### 4. Rendering Script Updates

**Add Image Fetching Logic**:
```javascript
async function renderSlides(slides, options) {
  // Step 1: Check if images need fetching
  const imagesToFetch = slides.filter(slide =>
    (slide.type === 'content-image' || slide.type === 'content-fullimage') &&
    slide.image_usage === 'topic-matched'
  )

  if (imagesToFetch.length > 0) {
    console.log(`🔍 Fetching ${imagesToFetch.length} images...`)
    const fetchedImages = await imageFetcher.fetchImages(
      options.topic,
      { max_images: imagesToFetch.length }
    )

    // Step 2: Inject images into slides
    slides = injectImages(slides, fetchedImages)
  }

  // Step 3: Render as before
  return await puppeteerRender(slides, options)
}
```

---

## 📊 Technical Recommendations

### 1. Image Source Strategy

**Hybrid Approach** (Recommended):
1. **Primary**: Google Custom Search API (for broad coverage)
2. **Secondary**: Unsplash API (for high-quality, safe images)
3. **Fallback**: Random placeholder services (Picsum, Placeholder.com)

**Why Hybrid?**
- Google: More topic-relevant, better for specific topics
- Unsplash: Curated, high-quality, consistent aesthetic
- Fallback: Ensures no broken images

### 2. Performance Optimization

**Caching Strategy**:
- Cache by topic: `workspace/image-cache/{topic}.json`
- Cache TTL: 7 days (configurable)
- Cache warming: Prefetch popular topics

**Lazy Loading**:
```javascript
// Only fetch images when rendering
// Don't pre-fetch for all slides unless requested
```

**Async Operations**:
```javascript
// Fetch multiple images concurrently
const images = await Promise.all(
  urls.map(url => downloadAndValidate(url))
)
```

### 3. Quality Control

**Multi-stage Validation**:
1. **URL Validation**: Check if URL is accessible
2. **File Validation**: Check file type, size
3. **Content Validation**: Check resolution, visual quality
4. **License Validation**: Check usage rights

**Automation**:
```javascript
async function validateImage(image) {
  // Step 1: Check accessibility
  const response = await fetch(image.url, { method: 'HEAD' })
  if (!response.ok) return false

  // Step 2: Check resolution (if possible without downloading)
  const headers = response.headers
  const contentType = headers.get('content-type')
  if (!contentType.startsWith('image/')) return false

  // Step 3: Download and check dimensions
  const arrayBuffer = await fetch(image.url).then(res => res.arrayBuffer())
  const buffer = Buffer.from(arrayBuffer)

  // Use sharp or similar for efficient dimension check
  // ... dimensions check logic

  // Step 4: Check license (if metadata available)
  // ...

  return true
}
```

### 4. Error Recovery

**Retry Strategy**:
```javascript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url)
      if (response.ok) return response.blob()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await sleep(1000 * (i + 1)) // Exponential backoff
    }
  }
}
```

**Fallback Chain**:
```javascript
async function fetchImageSafe(url, fallbacks = []) {
  try {
    return await fetchAndValidate(url)
  } catch (error) {
    console.warn(`Image fetch failed: ${url}`)
    for (const fallback of fallbacks) {
      try {
        console.log(`Trying fallback: ${fallback}`)
        return await fetchAndValidate(fallback)
      } catch (e) {
        console.warn(`Fallback failed: ${fallback}`)
      }
    }
    throw new Error('All image sources failed')
  }
}
```

### 5. Cost Management

**API Cost Optimization**:
- Use caching aggressively (80% reduction in calls)
- Batch requests where possible
- Implement rate limiting (max 50 calls/minute)
- Monitor and alert on cost thresholds

**Pricing** (Estimated):
- Google Custom Search: $5/100 queries (free tier: 100/day)
- Unsplash API: 50 free requests/day
- Combined: ~$1-2/month for typical usage

**Budget Configuration**:
```json
// config.json
{
  "image_fetcher": {
    "api_budget": {
      "google": { "max_calls_per_day": 100 },
      "unsplash": { "max_requests_per_day": 50 }
    },
    "cost_threshold": 5.0, // Alert at $5/month
    "budget_alert_email": "your-email@example.com"
  }
}
```

### 6. A/B Testing & Analytics

**Track Image Performance**:
```javascript
// image-analytics.json
{
  "tracking_id": "card-news-001",
  "topics_analyzed": [
    {
      "topic": "AI 프롬프트 팁",
      "images_used": [
        {
          "image_url": "...",
          "relevance_score": 87,
          "views": 1250,
          "engagement_rate": 0.23,
          "click_rate": 0.18
        }
      ]
    }
  ]
}
```

**A/B Testing Framework**:
- Randomly assign image sources
- Compare engagement metrics
- Iterate on scoring algorithm
- Optimize for highest engagement

### 7. Security Considerations

**Input Sanitization**:
```javascript
function sanitizeImageUrl(url) {
  // Prevent SSRF attacks
  const validHosts = ['images.unsplash.com', 'scontent', 'lh3']
  const hostname = new URL(url).hostname

  if (!validHosts.some(host => hostname.includes(host))) {
    throw new Error('Invalid image source')
  }

  // Prevent directory traversal
  if (url.includes('..') || url.includes('\\')) {
    throw new Error('Path traversal detected')
  }

  return url
}
```

**Rate Limiting**:
```javascript
const rateLimiter = require('express-rate-limit')

const imageLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute
  message: 'Too many image requests, please try again later'
})
```

---

## 📈 Expected Outcomes

### Performance Metrics

**Before Feature**:
- Manual image search time: 5-10 minutes per card news
- Image quality: Variable (user skill dependent)
- Image relevance: Low to moderate
- Visual engagement: 2.5-3.5% CTR

**After Feature**:
- Manual image search time: 0 minutes (auto)
- Image quality: High (AI-selected, validated)
- Image relevance: 70-90% relevance score
- Visual engagement: 4-6% CTR (target)

### User Experience Improvements

1. **Time Savings**: 80-90% reduction in manual image search
2. **Quality Consistency**: Uniform, high-quality images
3. **Visual Impact**: Better engagement and retention
4. **Ease of Use**: No manual steps required for topic-matched mode

### Business Impact

1. **Increased Engagement**: 40-50% higher CTR
2. **Better Content Quality**: Professional, cohesive visual style
3. **Reduced Production Time**: Faster card news creation
4. **Higher User Satisfaction**: Streamlined workflow

---

## 🎯 Implementation Phases

### Phase 1: Core Image Fetcher (Week 1)
- Implement ImageFetcher service class
- Integrate Google Custom Search API
- Basic relevance scoring (top 3 factors)
- Caching system
- Fallback to placeholder on error

**Deliverables**:
- `scripts/image-fetcher.js`
- Image cache system
- Documentation

### Phase 2: Visual Designer Agent (Week 2)
- Add Visual Designer agent to Copy Debate step
- Image quality validation
- Placement optimization feedback
- User manual override UI

**Deliverables**:
- Visual Designer agent instructions
- Updated CLAUDE.md
- Image selection modal

### Phase 3: Advanced Features (Week 3)
- Unsplash integration
- Multi-source fallback
- Advanced scoring algorithm
- A/B testing framework

**Deliverables**:
- Unsplash integration
- Enhanced scoring engine
- Analytics tracking

### Phase 4: Testing & Optimization (Week 4)
- End-to-end testing
- Performance optimization
- Cost monitoring
- User feedback integration

**Deliverables**:
- Test suite
- Performance report
- Optimization recommendations

---

## 📚 References & Resources

### Image APIs
- [Google Custom Search API](https://developers.google.com/custom-search/v1/introduction)
- [Unsplash API](https://unsplash.com/developers)
- [Pexels API](https://www.pexels.com/api/) (Alternative)

### Best Practices
- [Image Optimization](https://web.dev/fast-images/)
- [Image Licensing Guide](https://creativecommons.org/licenses/)
- [Visual Hierarchy Principles](https://www.smashingmagazine.com/2016/11/visual-hierarchy-best-practices-web-design/)

### Related Projects
- [Puppeteer Image Rendering](https://github.com/puppeteer/puppeteer)
- [React Image](https://github.com/faceyspacey/react-image)
- [Canvas API Image Processing](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

---

## ✅ Success Criteria

- [ ] Auto-fetch images for topic-matched slides (70%+ relevance score)
- [ ] Images integrate seamlessly with existing templates
- [ ] User can override with manual images
- [ ] Fallback placeholder works reliably
- [ ] Error handling and recovery works
- [ ] Image cache reduces API calls by >80%
- [ ] Visual Designer agent provides actionable feedback
- [ ] End-to-end workflow completed in <2 minutes per card news
- [ ] Engagement metrics improve by 30%+
- [ ] Cost stays under $5/month for typical usage

---

**Document Version**: 1.0
**Last Updated**: 2026-03-11
**Author**: ohmy UI/UX Designer Agent
