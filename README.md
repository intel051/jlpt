## OpenAI 뜻 번역 및 예문 생성
Vercel 환경변수에 OPENAI_API_KEY를 등록하고 재배포하세요. OPENAI_MODEL 기본값은 gpt-5.6-luna입니다.
새 단어는 일본어 표기, 읽기, 영어 뜻을 함께 보내 한국어로 번역합니다.
'기존 뜻 AI 재번역'은 직접 등록한 단어 및 OpenAI로 이미 번역한 단어를 제외하고 뜻을 업데이트합니다.
예문 생성은 OPENAI_API_KEY가 있으면 OpenAI를 사용하고, 없으면 기존 Gemini 설정을 사용합니다.
후리가나 토큰과 문장의 일치 여부를 서버에서 검증합니다. AI 번역과 읽기는 의미적으로 틀릴 수 있습니다.
결과는 현재 브라우저에 저장되며 재생성 버튼을 누르면 추가 API 호출이 발생합니다.
APP_ACCESS_TOKEN은 /api/translate 및 /api/example을 보호하는 선택 비밀번호입니다.
API 키는 클라이언트 HTML이나 GitHub에 넣지 마세요. 노출된 키는 폐기하고 새 키를 등록하세요.
실제 API 호출은 별도 사용 요금이 발생합니다.

# JLPT Master · Vercel + Gemini

## 배포
1. 이 폴더의 내용(public, api, package.json, vercel.json)을 GitHub 저장소 루트에 업로드합니다.
2. Vercel에서 저장소를 Import합니다. Framework Preset: Other, Output Directory: public. Build Command는 비웁니다.
3. Settings → Environment Variables에 GEMINI_API_KEY와 GEMINI_MODEL을 추가합니다. Production/Preview 환경을 원하는 범위로 선택합니다.
   - GEMINI_API_KEY: Google AI Studio에서 발급받은 키. 브라우저 코드나 GitHub에 넣지 않습니다.
   - GEMINI_MODEL: 본인 프로젝트에서 사용 가능한 generateContent 및 structured JSON 출력 지원 모델의 정확한 ID. models/ 접두사는 제외합니다.
   - APP_ACCESS_TOKEN: 선택 사항. 개인용 사이트라면 긴 임의 문자열을 설정하세요. 앱에서 401 응답을 받으면 비밀번호 입력창을 표시합니다. 입력값은 메모리에만 보관합니다.
4. Deploy합니다. 환경변수 변경 후에는 Redeploy합니다.
5. 단어를 추가하고 카드 뒷면에서 'AI 예문 + 후리가나 만들기'를 누릅니다.

## 작동 방식
브라우저 → POST /api/example → Gemini → 서버 형식 검증 → ruby/rt 렌더링 → 기존 단어 localStorage 저장.
API 키는 서버에서만 사용합니다. 문장을 토큰 배열로 받아 한자에 후리가나를 표시하며 AI의 HTML을 삽입하지 않습니다.
다시 만들기는 버튼을 눌렀을 때만 호출하며, 실패하면 이전 예문을 유지합니다.
API에서 읽기/뜻을 제공하지 않을 때도 모델 추정이 개입할 수 있으므로 AI 생성 표시를 유지합니다.
AI의 읽기와 내용은 틀릴 수 있습니다. 형식 검증이 언어적 정확성을 보장하지 않습니다.

## 데이터와 제한
데이터는 기기·브라우저·도메인별로 저장됩니다. 기존 chatgpt.site 데이터는 새 Vercel 도메인으로 자동 이동하지 않습니다.
서버 DB나 계정 동기화는 없습니다. 서버 재시작과 무관하게 같은 브라우저에 저장한 예문은 재사용합니다.
APP_ACCESS_TOKEN을 설정하지 않으면 예문 생성 API는 공개입니다. 공개 운영 시 인증, Vercel Firewall 요청 제한, Google 프로젝트 할당량을 구성하세요. Origin 검사는 인증을 대체하지 않습니다.
React/Tailwind/Babel CDN 구조는 기존 앱을 유지했습니다. HTML 파일을 직접 열면 서버 API는 작동하지 않습니다.
키가 제공되지 않아 실제 Gemini 호출·Vercel 배포는 검증하지 못했습니다.

## 검증
Node.js 22 이상에서 npm test.
Google 문서: https://ai.google.dev/api/generate-content
Vercel 문서: https://vercel.com/docs/functions/runtimes/node-js

## 기존 화면과 데이터 보존
/legacy: 기존 단어장과 jlpt_v6_folders 폴더·통계
/dict: 기존 사전
/auth: Firebase 로그인 학습 화면
메인 새 단어장은 jlpt_words_v2를 사용합니다. 기존 데이터는 /legacy에서 계속 이용할 수 있습니다. Firebase 데이터는 수정하지 않았습니다.

## 정리 내역
미사용 test.html, 전용 api/generate.js, HTML에 키를 삽입하던 GitHub Pages workflow를 제거했습니다. Git 이력에서 복구 가능합니다. 과거 Pages 배포에 실제 키가 포함되었다면 Google에서 키를 교체하세요. 과거 배포는 이번 커밋으로 삭제되지 않습니다.
기존 api/vocab.js와 api/dictionary.js는 보존했습니다. APP_ACCESS_TOKEN은 새 /api/example에만 적용됩니다.

