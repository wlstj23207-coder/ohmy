# Instagram Card News Generator

Claude Code에 **한 줄만 입력**하면 Instagram 카드뉴스가 자동으로 만들어집니다.

```
카드뉴스 만들어줘: AI 트렌드 2025
```

리서치 → 팩트체크 → 카피 토론(Team 모드) → 렌더링 → 시각 검토까지 전체 파이프라인이 자동 실행됩니다.

**출력**: `output/` 디렉토리에 1080x1350px PNG 이미지 (Instagram 세로형)

---

## 시작하기

### 방법 1: 기존 프로젝트 클론

```bash
git clone https://github.com/junghwaYang/instagram-card-news.git
cd instagram-card-news
npm install
```

Claude Code를 실행하고 카드뉴스를 요청하세요:

```bash
claude
```

```
카드뉴스 만들어줘: 2025 디지털 마케팅 트렌드
```

### 방법 2: 빈 폴더에서 스킬로 세팅

Claude Code 스킬을 설치하면 빈 폴더에서 프로젝트 전체를 자동 생성할 수 있습니다.

**스킬 설치 (택 1)**:

```bash
# curl
curl -sSL https://raw.githubusercontent.com/junghwaYang/card-news-setup/main/install.sh | bash

# 또는 수동
mkdir -p ~/.claude/skills/card-news-setup
curl -sSL https://raw.githubusercontent.com/junghwaYang/card-news-setup/main/SKILL.md \
  -o ~/.claude/skills/card-news-setup/SKILL.md
```

**사용법**:

```bash
mkdir my-card-news && cd my-card-news
claude
```

```
/card-news-setup
```

스킬이 프로젝트 구조, 템플릿, 스크립트, CLAUDE.md를 모두 생성합니다.

---

## 사용 예시

```
카드뉴스 만들어줘: AI 트렌드 2025
```
```
볼드 스타일로 "성공하는 아침 루틴" 카드뉴스 5장
```
```
"ChatGPT 활용법" 카드뉴스, 엘레건트, 10장, 악센트 #FF6B6B
```
```
미니멀 스타일로 투자 기초 지식 카드뉴스, @finance_tips 계정
```

### 파라미터

| 파라미터 | 기본값 | 설명 |
|---|---|---|
| 주제 | (필수) | 카드뉴스 주제 |
| 톤 | `professional` | professional / casual / energetic |
| 템플릿 | `clean` | 템플릿 스타일 (아래 8종 참고) |
| 슬라이드 수 | `7` | 5~12장 |
| 악센트 색상 | `#8BC34A` | hex 코드 |
| 계정명 | `jinseo` | Instagram 계정명 (항상 고정) |

---

## 자동 생성 파이프라인

Claude Code가 아래 단계를 순서대로 실행합니다:

```
Step 1  요청 파싱 — 주제, 톤, 스타일, 슬라이드 수 추출
  ↓
Step 2  리서치 — 웹 검색으로 핵심 포인트, 통계, 인용구 수집
  ↓
Step 2.5  리서치 검증 — 팩트체커 + 보완 리서처 (병렬 실행, 교차 검증)
  ↓
Step 3.5  카피 토론 (Team 모드) — 카피 작가 + 후킹 전문가가 실시간 토론
           → 후킹 점수 7점 이상 + 양측 합의까지 최대 3라운드
  ↓
Step 4  렌더링 — Puppeteer로 HTML → PNG 변환 (1080x1350px)
  ↓
Step 5  시각 검토 — 가독성, 텍스트 잘림, 흐름, CTA 명확성 확인
```

### Team 모드 카피 토론 (Step 3.5)

카피라이팅과 품질 검증이 하나의 Team 모드로 통합되어 있습니다:

- **카피 작가** (`copywriter`): 리서치 기반으로 slides.json 초안 작성
- **후킹 전문가** (`hook-expert`): 스크롤 스톱 파워, 호기심 유발, CTA 클릭 유도력 평가

두 에이전트가 `SendMessage`로 실시간 피드백을 주고받으며 합의에 도달합니다.

---

## 🖼️ 이미지 풀러 기능 (강화됨)

이미지 풀러는 **Pollinations AI + Openverse + Pixabay + Wikimedia Commons**를 포함해 지능형 주제 기반 라우팅을 지원합니다.

### 이미지 소스

| 소스 | API 키 필요 | 특징 |
|---|---|---|
| **Pollinations AI** | ❌ 필요 없음 (키리스) | 프롬프트 기반 AI 이미지 생성 (슬라이드 자동 채움) |
| **Openverse** | ❌ 필요 없음 (키리스) | 오픈 라이선스 이미지 + 메타데이터 풍부 |
| **Pexels** | ✅ 필요 | 고화질 무료 사진 및 비디오 |
| **Pixabay** | ✅ 필요 | 무료 사진, 일러스트, 벡터 |
| **Unsplash** | ✅ 필요 | 고품질 크리에이티브 사진 |
| **Wikimedia Commons** | ❌ 필요 없음 (키리스) | 1,000만 개 이상의 무료 미디어 리포지토리 |

### 주제 분류

시스템은 주제를 세 가지 유형으로 자동 분류합니다:

| 분류 유형 | 한글 라벨 | 설명 | 예시 |
|---|---|---|---|
| `abstract_explainer` | 이론/개념 설명 | 추상적인 개념, 이론, 원리 | 'AI 기초', '머신러닝 이해하기', '웹 프레임워크 비교' |
| `factual_entity` | 사물/명사 지식 | 사실적 지식, 사물, 명사 | 'Apple iPhone 15', '카카오톡 소개', '우리나라 시민권' |
| `current_news` | 실시간 뉴스 | 현재 뉴스, 트렌드, 핫 이슈 | 'AI 트렌드 2025', '과학 기술 뉴스', '비트코인 가격 업데이트' |

### 라우팅 규칙

분류된 주제 유형에 따라 이미지 소스 우선순위가 결정됩니다:

```
abstract_explainer (이론/개념 설명)
  → Pollinations AI → Openverse → Pexels → Pixabay → Unsplash → Wikimedia Commons

factual_entity (사물/명사 지식)
  → Wikimedia Commons → Pollinations AI → Openverse → Pexels → Pixabay → Unsplash
  (Wikimedia/Openverse 키리스 우선)

current_news (실시간 뉴스)
  → Wikimedia Commons → Pollinations AI → Openverse → Pixabay → Pexels → Unsplash
```

### 라우팅 동작

```javascript
// 이미지 풀러는 자동으로 주제를 분류하고 라우팅을 수행합니다
const fetcher = new ImageFetcher({
  useRouting: true,  // 기본값
});

const images = await fetcher.fetchImages('AI 기초');
// → 주제 분류: abstract_explainer
// → 라우팅: Pexels → Pixabay → Unsplash → Wikimedia
// → 첫 번째 성공한 소스의 이미지를 사용
```

### 라우팅 테스트

```bash
node scripts/fetch-images.test.js
```

### 라우팅 분석

```javascript
const analysis = fetcher.analyzeTopic('AI 기초');
console.log(analysis.classification.label);
// → "이론/개념 설명"

console.log(analysis.provider_priorities);
// → ['pexels', 'pixabay', 'unsplash', 'wikimedia']
```

---

## 템플릿 스타일 (8종)

| 스타일 | 설명 | 기본 악센트 | 배경 |
|---|---|---|---|
| **clean** | 클린 에디토리얼형 | `#8BC34A` 라임그린 | 라이트그레이 |
| **minimal** | 깔끔한 정보 전달형 | `#2D63E2` 블루 | 화이트 |
| **bold** | 강렬한 임팩트형 | `#6C5CE7` 퍼플 | 그라디언트 |
| **elegant** | 고급스러운 감성형 | `#D4AF37` 골드 | 다크 |
| **premium** | 다크 프리미엄형 | `#A855F7` 바이올렛 | 딥 다크 |
| **toss** | 토스 스타일 미니멀 | `#3182F6` 블루 | 다크 플랫 |
| **magazine** | 매거진/SNS형 | `#3B82F6` 블루 | 포토+화이트 |
| **gorp** | 고프코어 레퍼런스형 | `#9CA3AF` 쿨그레이 | 포토+다크오버레이 |
| **blueprint** | 블루프린트 프레젠테이션형 | `#7BA7CC` 소프트블루 | 라이트블루그레이 |

---

## 슬라이드 타입 (14종)

| 타입 | 용도 | 주요 필드 |
|---|---|---|
| `cover` | 표지 (항상 첫 번째) | `headline`, `subtext`, `headline_label` |
| `content` | 일반 내용 | `headline`, `body` |
| `content-badge` | 카테고리 태그 | `badge_text`, `headline`, `body` |
| `content-stat` | 숫자/통계 강조 | `headline`, `emphasis`, `body` |
| `content-quote` | 인용구/명언 | `headline`(출처), `body`(인용문) |
| `content-image` | 이미지+텍스트 | `headline`, `body`, `image_url` |
| `content-steps` | 3단계 프로세스 | `headline`, `step1~3` |
| `content-list` | 항목 나열 (최대 5개) | `headline`, `item1~5` |
| `content-split` | 비교/대조 | `headline`, `left/right_title`, `left/right_body` |
| `content-highlight` | 핵심 강조 박스 | `headline`, `emphasis`, `body` |
| `content-grid` | 2x2 그리드 | `headline`, `grid1~4_icon/title/desc` |
| `content-bigdata` | 대형 숫자 강조 | `headline`, `bigdata_number`, `bigdata_unit`, `body` |
| `content-fullimage` | 풀 배경 이미지 오버레이 | `headline`, `badge_text`, `body`, `badge2_text`, `body2`, `image_url` |
| `cta` | 행동 유도 (항상 마지막) | `headline`, `cta_text`, `tag1~3` |

---

## 수동 렌더링

slides.json을 직접 작성하고 렌더링만 실행할 수도 있습니다:

```bash
node scripts/render.js \
  --slides workspace/slides.json \
  --style magazine \
  --output output/ \
  --topic "주제"
```

기본 정책(항상 적용):
- `magazine` 스타일
- Unsplash 주제 연관 배경 자동 주입 (`unsplash-only`)
- 계정명 `@jinseo` 고정

### 슬라이드 문맥 기반 이미지 자동 주입 + 렌더링

`content-image`, `content-fullimage` 슬라이드에 대해 **주제 + 슬라이드 텍스트 문맥**으로 이미지를 자동 선택해 `slides.json`에 반영합니다.

```bash
node scripts/render.js \
  --slides workspace/slides.json \
  --style clean \
  --output output/ \
  --topic "AI 트렌드 2025" \
  --discussion-file workspace/discussion.md \
  --auto-images \
  --unsplash-only \
  --min-image-score 60 \
  --max-images-per-query 8
```

이미지 주입만 먼저 실행하려면:

```bash
npm run enrich-images -- \
  --slides workspace/slides.json \
  --topic "AI 트렌드 2025" \
  --discussion-file workspace/discussion.md \
  --unsplash-only \
  --min-score 60
```

### 샘플 생성

13개 슬라이드 타입을 모두 포함하는 샘플을 렌더링합니다:

```bash
node scripts/generate-samples.js
```

결과: `sample-output/clean/` 디렉토리

---

## API 키 설정

이미지 풀러를 사용하려면 다음 API 키 중 하나 이상을 설정해야 합니다:

### 환경 변수 방식

```bash
# .env 파일 또는 시스템 환경 변수
PEXELS_API_KEY=your_pexels_api_key
PIXABAY_API_KEY=your_pixabay_api_key
UNSPLASH_API_KEY=your_unsplash_api_key
```

### 프로젝트 설정 방식

```json
// config.json
{
  "defaults": {
    "pexelsApiKey": "your_pexels_api_key",
    "pixabayApiKey": "your_pixabay_api_key",
    "unsplashApiKey": "your_unsplash_api_key"
  }
}
```

### API 키 획득

- **Pexels**: https://www.pexels.com/api/
- **Pixabay**: https://pixabay.com/api/docs/
- **Unsplash**: https://unsplash.com/developers

**참고**: Wikimedia Commons는 API 키가 필요 없습니다.

---

## 텍스트 하이라이트

headline이나 body에 `<span class='highlight'>텍스트</span>`를 사용하면 형광펜 마커 스타일이 적용됩니다.

```json
{
  "headline": "2025 <span class='highlight'>디지털 마케팅</span> 트렌드"
}
```

---

## 설정 (config.json)

```json
{
  "defaults": {
    "template": "clean",
    "accent_color": "#8BC34A",
    "account_name": "my_account",
    "slide_count": 7,
    "imageFetcher": {
      "maxImages": 10,
      "cacheSize": 50,
      "useRouting": true,
      "minScore": 70
    }
  }
}
```

---

## 프로젝트 구조

```
instagram-card-news/
├── templates/           # HTML 템플릿 (8 스타일 x 14 타입)
│   ├── clean/
│   ├── minimal/
│   ├── bold/
│   ├── elegant/
│   ├── premium/
│   ├── toss/
│   ├── magazine/
│   └── blueprint/
├── scripts/
│   ├── render.js        # Puppeteer HTML → PNG 렌더러
│   ├── generate-samples.js
│   ├── image-fetcher.js          # 메인 이미지 풀러 (업데이트됨)
│   ├── image-provider-pixabay.js # Pixabay 제공자
│   ├── image-provider-wikimedia.js # Wikimedia Commons 제공자
│   ├── image-topic-router.js      # 주제 분류 및 라우팅
│   └── fetch-images.test.js       # 테스트 스위트
├── skill-package/       # Claude Code 스킬 배포 패키지
├── workspace/           # 슬라이드 JSON 작업 공간
├── output/              # 최종 PNG 출력
├── config.json          # 기본 설정
├── CLAUDE.md            # Claude Code 파이프라인 오케스트레이터 문서
└── README.md            # 이 문서
```

---

## 라이선스

MIT
