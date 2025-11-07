# KIMP MCP Server

김치 프리미엄(KIMP, Kimchi Premium) 데이터를 조회하는 MCP 서버입니다.

## 설치

### npx로 바로 사용 (권장)
```json
{
  "mcpServers": {
    "kimp": {
      "command": "npx",
      "args": ["-y", "@drfirst/kimp-mcp"]
    }
  }
}
```

### 로컬 설치
```bash
npm install -g @drfirst/kimp-mcp
```

## Claude Desktop 설정

`claude_desktop_config.json` 파일에 추가:
```json
{
  "mcpServers": {
    "kimp": {
      "command": "npx",
      "args": ["-y", "@drfirst/kimp-mcp"]
    }
  }
}
```

## 사용 가능한 도구

### get_kimp

암호화폐의 김치 프리미엄 데이터를 조회합니다.

**파라미터:**
- `symbol` (string, 선택): 암호화폐 심볼 (기본값: "BTC")
- `currency` (string, 선택): 기준 통화 (기본값: "KRW")

**예시:**

Claude에게 다음과 같이 요청할 수 있습니다:
- "비트코인 김치프리미엄 알려줘"
- "이더리움 KIMP 확인해줘"
- "BTC의 한국 프리미엄은?"

## 개발

### 로컬 테스트
```bash
# 의존성 설치
npm install

# 서버 실행
npm start
```

### 배포
```bash
# npm 로그인
npm login

# 배포
npm publish --access public
```

## 라이선스

MIT
```

## 프로젝트 구조
```
kimp-mcp/
├── package.json
├── index.js
├── README.md
└── .gitignore
```

## .gitignore
```
node_modules/
*.log
.DS_Store
dist/