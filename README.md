# JLPT Master — Gemini 번역·후리가나 예문

Vercel 환경변수:
- GEMINI_API_KEY: Google AI Studio에서 발급한 키
- GEMINI_MODEL: 기본값 gemini-3.5-flash-lite. 기존 gemini-3.8-flash 설정도 사용 가능.
- APP_ACCESS_TOKEN: 선택 사항. 번역·예문 요청을 보호하는 비밀번호.

환경변수 저장 후 재배포하세요. OpenAI 환경변수는 사용하지 않습니다.
무료 사용을 원하면 Google AI Studio에서 해당 프로젝트가 무료 등급인지 확인하세요.
모델 이름만으로 무료 과금이 보장되지는 않습니다. 무료 사용량은 모델·프로젝트별 한도에 따릅니다.

새 단어의 일본어 표기·읽기·영어 뜻을 함께 전달하여 한국어 뜻을 번역합니다.
예문 생성 버튼은 일본어 예문, 한국어 해석, 후리가나를 생성합니다.
번역은 한 단어씩 순차 요청하고 호출 사이에 1.5초를 둡니다. 429 응답 시 중단합니다.
기존 뜻 AI 재번역은 직접 등록한 단어와 Gemini/OpenAI 번역 완료 단어를 제외합니다.
성공한 결과와 학습 기록은 브라우저에 저장하며 실패해도 기존 뜻을 유지합니다.
후리가나 토큰과 문장의 일치를 검증하지만 의미와 읽기의 정확성까지 보장하지는 않습니다.

API 키는 서버 환경변수에만 등록하세요. GitHub나 HTML에 넣지 마세요.
기존 화면은 /legacy, 사전은 /dict입니다. 기존 HSK 화면 /auth의 링크는 제거됐습니다.
기존 보조 API와 HSK 프록시는 별도 유지되며 APP_ACCESS_TOKEN 보호 대상은 /api/translate와 /api/example입니다.

검증: node --test tests/*.test.js (모의 응답 테스트)
