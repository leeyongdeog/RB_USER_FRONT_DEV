# RANDOM DROP USER FRONT

React와 GSAP을 결합한 웹 네이티브 랜덤박스 사용자 프론트입니다.

## 사용자 흐름

```text
박스 선택 → 결제 → 서버 결과 확정 → GSAP 개봉 연출 → 인벤토리 보관
                                                      ├─ 트레이드
                                                      ├─ 배송 요청
                                                      └─ 포인트 전환
```

## 폴더 구조

```text
src/
├─ components/
│  └─ BoxRevealStage.tsx     # GSAP 기반 4단계 개봉 시퀀스
├─ services/
│  └─ api.ts                 # API 클라이언트와 개봉 API 계약
├─ App.tsx                   # 레이아웃, 라우트, 사용자 화면
├─ data.ts                   # 현재 UI용 샘플 데이터
├─ types.ts                  # 도메인 타입
├─ main.tsx                  # React/Query/Router 진입점
└─ styles.css                # 반응형 디자인 시스템과 개봉 파티클
```

백엔드 연동이 시작되면 `App.tsx`의 각 화면을 `features/boxes`, `features/trade`, `features/inventory`, `features/account` 단위로 분리하는 것을 권장합니다.

## 설치된 패키지

- `react`, `react-dom`: 사용자 UI
- `react-router-dom`: 홈, 박스, 개봉, 트레이드, 인벤토리 라우팅
- `gsap`, `@gsap/react`: 개봉 Timeline, 파티클 및 React 통합
- `@tanstack/react-query`: 주문·인벤토리·트레이드 서버 상태
- `axios`: API 통신과 인증 헤더
- `lucide-react`: UI 아이콘
- `clsx`: 조건부 클래스 조합

## 실행

```bash
yarn
yarn dev
yarn build
```

개봉 결과는 서버에서 먼저 확정하고 GSAP은 해당 결과를 표현하는 연출만 담당합니다.
