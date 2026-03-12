'use strict';

/**
 * Image Topic Router
 * Handles topic classification and provider routing for intelligent image selection
 */

/**
 * Topic Classification Types
 */
const TOPIC_TYPES = {
  ABSTRACT_EXPLAINER: 'abstract_explainer',  // 이론/개념 설명
  FACTUAL_ENTITY: 'factual_entity',         // 사물/명사 지식
  CURRENT_NEWS: 'current_news',             // 실시간 뉴스
};

/**
 * Topic Classification Criteria and Examples
 */
const TOPIC_CRITERIA = {
  [TOPIC_TYPES.ABSTRACT_EXPLAINER]: {
    label: '이론/개념 설명',
    description: 'Abstract explanations, concepts, theories',
    keywords: [
      // Abstract concepts
      '개념', '이론', '원리', '메커니즘', '작동 원리', '구조',
      '설명', '해설', '정의', '특징', '특성', '분석',
      'AI', '인공지능', '머신러닝', '딥러닝', '데이터', '알고리즘',
      '효율', '최적화', '프로세스', '워크플로우', '프레임워크', '스택',
      '기술', '기술적', '기술적 관점', '기술적 특징',
      '도메인', '분야', '영역', '제도', '시스템', '플랫폼',
      '사례', '사례 분석', '사례 연구', '사례 시리즈',
      '알아보기', '이해하기', '학습', '가이드', '가이드라인',
      'guide', 'tutorial', 'explanation', 'mechanism', 'theory', 'principle',
      'how it works', 'how it works', 'understanding', 'learn', 'tutorial',
      'foundation', 'basics', 'intro', 'introductory',
      // Topic keywords
      '스타트', '기초', '입문', '시작', '여정', '여정 가이드',
      '초보자', '입문자', '학습자', '개발자', '디자이너',
    ],
    examples: [
      'AI 기초',
      '머신러닝 이해하기',
      '자바스크립트 개념',
      '웹 프레임워크 비교',
      '알고리즘 원리',
      '데이터 구조 설명',
      '효율성 최적화 이론',
      '채용 스펙 가이드',
      '클라우드 컴퓨팅 개념',
      '블록체인 원리',
    ],
  },

  [TOPIC_TYPES.FACTUAL_ENTITY]: {
    label: '사물/명사 지식',
    description: 'Factual knowledge about objects, entities, places',
    keywords: [
      // Factual terms
      '소개', '소개합니다', '특징', '특징 소개',
      '정보', '상세 정보', '정보 페이지',
      '정의', '참고', '참고 문헌',
      '에디션', '버전', '스펙', '사양',
      '종류', '종류 소개', '분류', '분류 소개',
      '유형', '유형 소개',
      '구분', '구분 기준',
      '명칭', '명칭 소개',
      '상세', '상세 페이지',
      '데이터', '정보', '스펙',
      'what is', 'what is', 'introduction', 'features', 'specifications',
      'type', 'types', 'categories', 'classification',
      'definition', 'definitions', 'reference',
      'guide', 'overview', 'summary',
      'showcase', 'examples', 'showcase',
      // Korean context
      '시민권', '제도', '요건', '요구사항',
      '자격', '조건', '조건 소개',
      '역할', '역할 소개',
      '종류 소개', '종류 소개',
      '정보 페이지', '정보 페이지',
      '상세 페이지', '상세 페이지',
      '정부', '정부 제도', '공공 기관',
      '인증', '인증 종류',
      '기술 표준', '사양',
      '화폐', '화폐 종류',
      '인물', '인물 소개',
      '국가', '국가 시민권',
      '경관', '자연경관', '세계 7대',
    ],
    examples: [
      'Apple iPhone 15',
      '카카오톡 소개',
      '우리나라 시민권',
      '세계 7대 자연경관',
      '법적 요건 소개',
      '정부 제도 소개',
      '인증 종류 소개',
      '기술 표준 종류',
      '화폐 종류 소개',
      '인물 소개',
    ],
  },

  [TOPIC_TYPES.CURRENT_NEWS]: {
    label: '실시간 뉴스',
    description: 'Current news, trending topics, breaking news',
    keywords: [
      // News terms
      '뉴스', '속보', '지금', '최신', '오늘',
      '트렌드', '화제', '핫', '주목',
      '최신', '최신화제',
      '업데이트', '업데이트 소식',
      '발표', '발표 소식',
      '발생', '발생 소식',
      '소식', '소식 공유',
      '공지', '공지사항',
      '진행', '진행 소식',
      '시작', '시작 소식',
      '종료', '종료 소식',
      '리뷰', '리뷰 화제',
      '실시간', '실시간 소식',
      '빠른', '빠른 소식',
      '바로', '바로 보기',
      '빠르게', '빠르게 보기',
      '지금 확인', '지금 확인하기',
      'news', 'breaking', 'trending', 'hot', 'updates',
      'latest', 'new', 'now',
      'today', 'today',
      'update', 'updates',
      'announcement', 'announcements',
      'progress', 'progress updates',
      'start', 'starts',
      'end', 'ends',
      'review', 'reviewing',
      'live', 'live updates',
      'quick', 'quick view',
      'right now', 'check now',
      'rapidly', 'rapidly view',
    ],
    examples: [
      'AI 트렌드 2025',
      '과학 기술 뉴스',
      '비트코인 가격 업데이트',
      '드라마 실시간 반응',
      '애플 공식 발표',
      '방송 심야 방송',
      '새로운 기능 출시',
      '현장 소식',
      '최신 뉴스 핫이슈',
      '업데이트 소식 공유',
    ],
  },
};

/**
 * Map of topic types to provider priorities
 * Higher index = higher priority
 */
const PROVIDER_PRIORITIES = {
  [TOPIC_TYPES.ABSTRACT_EXPLAINER]: [
    'pollinations',
    'openverse',
    'pexels',
    'pixabay',
    'unsplash',
    'wikimedia',
  ],
  [TOPIC_TYPES.FACTUAL_ENTITY]: [
    'wikimedia',  // Wikimedia is keyless, prioritize for factual topics
    'pollinations',
    'openverse',
    'pexels',
    'pixabay',
    'unsplash',
  ],
  [TOPIC_TYPES.CURRENT_NEWS]: [
    'wikimedia',  // Good for current events coverage
    'pollinations',
    'openverse',
    'pixabay',
    'pexels',
    'unsplash',
  ],
};

/**
 * Classify topic into one of the three types
 * @param {string} topic - The topic to classify
 * @returns {object} Classification result with type, confidence, and reasons
 */
function classifyTopic(topic) {
  if (!topic || typeof topic !== 'string') {
    return {
      type: TOPIC_TYPES.ABSTRACT_EXPLAINER, // Default
      confidence: 0.5,
      reasons: ['Invalid or empty topic, defaulting to abstract_explainer'],
      keywords_found: [],
    };
  }

  const normalizedTopic = topic.toLowerCase().trim();
  const typeScores = {};

  // Score each topic type
  for (const [type, criteria] of Object.entries(TOPIC_CRITERIA)) {
    let score = 0;
    let matchedKeywords = [];

    // Check keyword matches
    for (const keyword of criteria.keywords) {
      if (normalizedTopic.includes(keyword.toLowerCase())) {
        score += 0.5; // High weight for keyword matches
        matchedKeywords.push(keyword);
      }
    }

    // Count exact matches (title matches)
    for (const example of criteria.examples) {
      if (normalizedTopic === example.toLowerCase().trim()) {
        score += 0.3; // Even higher weight for exact title matches
        matchedKeywords.push(`exact_match:${example}`);
      }
    }

    // Penalize common news terms if not in news type
    if (type !== TOPIC_TYPES.CURRENT_NEWS) {
      const currentNewsKeywords = TOPIC_CRITERIA[TOPIC_TYPES.CURRENT_NEWS].keywords;
      for (const keyword of currentNewsKeywords) {
        if (normalizedTopic.includes(keyword.toLowerCase())) {
          score -= 0.3; // Penalty for having news keywords
        }
      }
    }

    // Minimum score threshold
    if (score > 0.5) {
      typeScores[type] = score;
    }
  }

  // Determine best type
  let bestType = TOPIC_TYPES.ABSTRACT_EXPLAINER;
  let bestScore = 0;

  for (const [type, score] of Object.entries(typeScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Get criteria for best type
  const criteria = TOPIC_CRITERIA[bestType];
  const matchedKeywords = [];

  // Collect matched keywords
  for (const keyword of criteria.keywords) {
    if (normalizedTopic.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    }
  }

  return {
    type: bestType,
    confidence: Math.min(bestScore * 100, 100),
    label: criteria.label,
    description: criteria.description,
    reasons: matchedKeywords.slice(0, 5),
    keywords_found: matchedKeywords.slice(0, 5),
    original_topic: topic,
  };
}

/**
 * Get provider priority list for a topic type
 * @param {string} topicType - The topic type (from classifyTopic)
 * @returns {Array<string>} Sorted array of provider names (highest first)
 */
function routeProviders(topicType) {
  const priorities = PROVIDER_PRIORITIES[topicType];

  if (!priorities) {
    console.warn(`Unknown topic type: ${topicType}, using default priorities`);
    return [
      'pollinations',
      'openverse',
      'pexels',
      'pixabay',
      'unsplash',
      'wikimedia',
    ];
  }

  return priorities;
}

/**
 * Get all available providers
 * @returns {object} Object with provider metadata
 */
function getAvailableProviders() {
  return {
    pexels: {
      name: 'Pexels',
      requires_api_key: true,
      description: 'Free stock photos and videos',
      keyless: false,
    },
    openverse: {
      name: 'Openverse',
      requires_api_key: false,
      description: 'Openly licensed images with rich attribution metadata',
      keyless: true,
    },
    pollinations: {
      name: 'Pollinations AI',
      requires_api_key: false,
      description: 'Keyless AI image generation from text prompts',
      keyless: true,
    },
    pixabay: {
      name: 'Pixabay',
      requires_api_key: true,
      description: 'Free stock photos, illustrations, and vectors',
      keyless: false,
    },
    unsplash: {
      name: 'Unsplash',
      requires_api_key: true,
      description: 'High-quality creative photos',
      keyless: false,
    },
    wikimedia: {
      name: 'Wikimedia Commons',
      requires_api_key: false,
      description: 'Free media repository with millions of images',
      keyless: true,
    },
  };
}

/**
 * Analyze topic for routing recommendations
 * @param {string} topic - The topic to analyze
 * @returns {object} Routing analysis with topic type and provider suggestions
 */
function analyzeTopic(topic) {
  const classification = classifyTopic(topic);
  const priorities = routeProviders(classification.type);
  const providers = getAvailableProviders();

  // Generate provider suggestions based on API key availability
  const suggestions = priorities.map(providerName => ({
    provider: providerName,
    available: true,
    requires_key: providers[providerName]?.requires_api_key || false,
    recommended: providerName === priorities[0],
  }));

  return {
    classification,
    provider_priorities: priorities,
    provider_suggestions: suggestions,
    all_providers: providers,
  };
}

module.exports = {
  TOPIC_TYPES,
  classifyTopic,
  routeProviders,
  analyzeTopic,
  getAvailableProviders,
  TOPIC_CRITERIA,
};
