#!/usr/bin/env node

/**
 * kimp-mcp: 김치 프리미엄 조회 MCP 서버 (Node.js)
 * Bithumb API와 Naver 환율 API를 사용하여 실시간 김프 계산
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

/**
 * Bithumb에서 암호화폐 가격 조회
 * @param {string} symbol - 암호화폐 심볼 (예: BTC, USDT, USDC)
 * @param {string} fiat - 법정화폐 (기본: KRW)
 * @returns {Promise<number>} 가격
 */
async function bithumbPrice(symbol = 'BTC', fiat = 'KRW') {
  const pair = `${symbol.toUpperCase()}_${fiat.toUpperCase()}`;
  const url = `https://api.bithumb.com/public/ticker/${pair}`;

  try {
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;

    if (data.status !== '0000') {
      throw new Error(`Bithumb error: ${JSON.stringify(data)}`);
    }

    const price = data.data.closing_price;
    return parseFloat(price);
  } catch (error) {
    throw new Error(`Bithumb API 오류: ${error.message}`);
  }
}

/**
 * Naver에서 USD/KRW 환율 조회
 * @returns {Promise<number>} 환율
 */
async function getExchangeRate() {
  const url =
    'https://m.search.naver.com/p/csearch/content/qapirender.nhn?key=calculator&pkid=141&q=%ED%99%98%EC%9C%A8&where=m&u1=keb&u6=standardUnit&u7=0&u3=USD&u4=KRW&u8=down&u2=1';

  try {
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;

    // 환율 값 추출 (콤마 제거)
    const krwValue = parseFloat(data.country[1].value.replace(/,/g, ''));
    return krwValue;
  } catch (error) {
    throw new Error(`환율 API 오류: ${error.message}`);
  }
}

/**
 * 김치 프리미엄 계산
 * @param {string} symbol - 암호화폐 심볼 (USDT, USDC, BTC 등)
 * @returns {Promise<Object>} 김프 정보
 */
async function calculateKimp(symbol = 'USDT') {
  try {
    // 1. Bithumb에서 KRW 가격 조회
    const krwPrice = await bithumbPrice(symbol, 'KRW');

    // 2. 환율 조회
    const exchangeRate = await getExchangeRate();

    // 3. 달러 기준 가격 계산 (KRW 가격 / 환율)
    const usdPrice = krwPrice / exchangeRate;

    // 4. 김치 프리미엄 계산
    // USDT/USDC는 1달러 기준, 다른 코인은 해외 거래소 가격 필요
    let kimp, kimchiPremium;
    
    if (symbol.toUpperCase() === 'USDT' || symbol.toUpperCase() === 'USDC') {
      // 스테이블코인: 1달러 대비 프리미엄
      kimp = ((usdPrice - 1) / 1) * 100;
      kimchiPremium = usdPrice - 1;
    } else {
      // 다른 코인: 해외 가격 정보 없이 환율 기준만 표시
      kimp = null;
      kimchiPremium = null;
    }

    return {
      success: true,
      symbol: symbol.toUpperCase(),
      krwPrice: krwPrice,
      exchangeRate: exchangeRate,
      usdPrice: usdPrice,
      kimp: kimp,
      kimchiPremium: kimchiPremium,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * MCP 서버 초기화 및 실행
 */
async function main() {
  const server = new Server(
    {
      name: 'kimp-server',
      version: '1.1.0',
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
            '김치 프리미엄(KIMP)을 계산합니다. Bithumb의 KRW 가격과 Naver 환율 정보를 사용하여 실시간 김프를 계산합니다. USDT, USDC 같은 스테이블코인의 김프를 확인할 수 있습니다.',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: '암호화폐 심볼 (예: USDT, USDC, BTC, ETH)',
                default: 'USDT',
              },
            },
            required: [],
          },
        },
        {
          name: 'get_exchange_rate',
          description: 'Naver에서 현재 USD/KRW 환율을 조회합니다.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_crypto_price',
          description: 'Bithumb에서 특정 암호화폐의 KRW 가격을 조회합니다.',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: '암호화폐 심볼 (예: BTC, ETH, USDT)',
                default: 'BTC',
              },
            },
            required: [],
          },
        },
      ],
    };
  });

  // 도구 실행 핸들러
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case 'get_kimp': {
          const symbol = args?.symbol || 'USDT';
          result = await calculateKimp(symbol);
          
          // 결과를 읽기 쉽게 포맷
          let text = `📊 ${result.symbol} 김치 프리미엄 분석\n\n`;
          
          if (result.success) {
            text += `💰 Bithumb 가격: ${result.krwPrice.toLocaleString('ko-KR')} KRW\n`;
            text += `💱 현재 환율: ${result.exchangeRate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KRW/USD\n`;
            text += `💵 달러 환산 가격: $${result.usdPrice.toFixed(4)}\n\n`;
            
            if (result.kimp !== null) {
              const kimpSign = result.kimp >= 0 ? '+' : '';
              text += `🔥 김치 프리미엄: ${kimpSign}${result.kimp.toFixed(2)}%\n`;
              text += `📈 차익: ${kimpSign}$${result.kimchiPremium.toFixed(4)}\n`;
            } else {
              text += `ℹ️ ${result.symbol}의 정확한 김프 계산을 위해서는 해외 거래소 가격이 필요합니다.\n`;
            }
            
            text += `\n⏰ 조회 시간: ${new Date(result.timestamp).toLocaleString('ko-KR')}`;
          } else {
            text += `❌ 오류: ${result.error}`;
          }
          
          return {
            content: [
              {
                type: 'text',
                text: text,
              },
            ],
          };
        }

        case 'get_exchange_rate': {
          const rate = await getExchangeRate();
          result = {
            success: true,
            exchangeRate: rate,
            timestamp: new Date().toISOString(),
          };
          
          return {
            content: [
              {
                type: 'text',
                text: `💱 현재 USD/KRW 환율\n\n${rate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 원\n\n⏰ ${new Date().toLocaleString('ko-KR')}`,
              },
            ],
          };
        }

        case 'get_crypto_price': {
          const symbol = args?.symbol || 'BTC';
          const price = await bithumbPrice(symbol, 'KRW');
          result = {
            success: true,
            symbol: symbol.toUpperCase(),
            price: price,
            timestamp: new Date().toISOString(),
          };
          
          return {
            content: [
              {
                type: 'text',
                text: `💰 ${symbol.toUpperCase()} 가격 (Bithumb)\n\n${price.toLocaleString('ko-KR')} KRW\n\n⏰ ${new Date().toLocaleString('ko-KR')}`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ 오류 발생: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
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