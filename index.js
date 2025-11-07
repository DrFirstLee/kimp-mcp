#!/usr/bin/env node

/**
 * kimp-mcp: 김치 프리미엄 조회 MCP 서버 (Node.js)
 * 
 * 프로젝트 구조:
 * kimp-mcp/
 * ├── package.json
 * ├── index.js (이 파일)
 * └── README.md
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import axiosRetry from 'axios-retry';

// API URL (실제 엔드포인트로 변경 필요)
const URL = 'https://api.example.com/kimp';

/**
 * 김치 프리미엄 데이터 조회
 * @param {Object} params - 쿼리 파라미터 (예: {symbol: 'BTC', currency: 'KRW'})
 * @param {number} timeout - 타임아웃 (밀리초)
 * @returns {Promise<Object>} API 응답 또는 에러 객체
 */
async function getKimp(params = {}, timeout = 5000) {
  // axios 인스턴스 생성
  const client = axios.create({
    timeout,
    headers: {
      'Accept': 'application/json, text/plain;q=0.9, */*;q=0.8',
      'User-Agent': 'kimp-client/1.0 (+node-axios)',
    },
  });

  // 재시도 정책 설정
  axiosRetry(client, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      // 연결 오류, 타임아웃, 5xx, 429 에러 시 재시도
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        (error.response && [429, 500, 502, 503, 504].includes(error.response.status))
      );
    },
    onRetry: (retryCount, error, requestConfig) => {
      console.error(`[Retry ${retryCount}] ${error.message}`);
    },
  });

  try {
    const response = await client.get(URL, { params });
    return response.data;
  } catch (error) {
    // 에러 처리
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      console.error('[Timeout] 서버 응답 지연');
      return { error: 'Timeout', details: '서버 응답 지연' };
    }

    if (error.response) {
      // 서버가 오류 코드 응답
      console.error(`[HTTP ${error.response.status}] ${error.message}`);
      console.error('Response text:', JSON.stringify(error.response.data).substring(0, 500));
      return {
        error: `HTTP ${error.response.status}`,
        details: error.response.data,
      };
    }

    // 네트워크/연결 등 기타 예외
    console.error('[RequestException]', error.message);
    return { error: 'RequestException', details: error.message };
  }
}

/**
 * MCP 서버 초기화 및 실행
 */
async function main() {
  // MCP 서버 생성
  const server = new Server(
    {
      name: 'kimp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 도구 목록 핸들러
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_kimp',
          description:
            '김치 프리미엄(KIMP) 데이터를 조회합니다. 암호화폐의 한국과 해외 거래소 간 가격 차이를 확인할 수 있습니다.',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: '암호화폐 심볼 (예: BTC, ETH)',
                default: 'BTC',
              },
              currency: {
                type: 'string',
                description: '기준 통화 (예: KRW, USD)',
                default: 'KRW',
              },
            },
          },
        },
      ],
    };
  });

  // 도구 실행 핸들러
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name !== 'get_kimp') {
      throw new Error(`Unknown tool: ${name}`);
    }

    // 파라미터 추출
    const params = {
      symbol: args?.symbol || 'BTC',
      currency: args?.currency || 'KRW',
    };

    // API 호출
    const result = await getKimp(params);

    // 결과 반환
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  // Transport 생성 및 서버 연결
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('KIMP MCP Server running on stdio');
}

// 에러 처리 및 실행
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});