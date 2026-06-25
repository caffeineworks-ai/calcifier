import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  MY_KV: KVNamespace;
}

interface LampState {
  tentSize: string;
  power: boolean;
  battery: number;
  brightness: number;
  colorTemp: number;
  mode: string;
  volume: number;
}

const DEFAULT_STATE: LampState = {
  tentSize: "1인용",
  power: true,
  battery: 80.0,
  brightness: 40,
  colorTemp: 2700,
  mode: "일반",
  volume: 30,
};

export class CalcifierMCP extends McpAgent {
  server = new McpServer({ name: "calcifier", version: "1.0.0" });

  async init() {
    const getState = async (): Promise<LampState> => {
      const raw = await (this.env as Env).MY_KV.get("state");
      return raw ? JSON.parse(raw) : { ...DEFAULT_STATE };
    };

    const saveState = async (state: LampState) => {
      await (this.env as Env).MY_KV.put("state", JSON.stringify(state));
    };

    // ── 제품 소개 ──────────────────────────────────────────────
    this.server.tool(
      "get_product_info",
      "Calcifer 오일램프의 제품 컨셉, 기능, 사용 방법을 설명합니다. 사용자가 제품에 대해 물어볼 때 호출하세요.",
      {},
      async () => {
        return {
          content: [
            {
              type: "text",
              text: `🔥 Calcifer — 실내 캠핑용 스마트 걸이 램프

【제품 컨셉】
텐트 천장에 거는 LED 걸이 램프로, 장작 타는 감성 오디오와 결합해 실내 캠핑 분위기를 완성합니다.
Claude와의 대화로 자연어 명령을 내릴 수 있으며, 함께 구매한 텐트 크기에 따라 최적 밝기와 색온도를 자동 추천합니다.

【주요 기능】
• 밝기 조절 (0~100%)
• 색온도 선택: 2700K(전구) / 5500K(주백) / 6000K(주광)
• 모드: 일반 / 취침 / 독서 / 기상
• 장작 모닥불 사운드 볼륨 조절 (sound.mp3)
• 배터리 잔량 실시간 모니터링 (밝기에 따라 소모 속도 가변)
• 텐트 크기에 따른 밝기 자동 조정

【자연어 명령 예시】
"잘게." → 취침 모드 (밝기 10%, 2700K)
"영화 볼게." → 밝기 20%
"책 읽을게." → 독서 모드 (밝기 80%, 5500K)
"꺼줘." → 전원 OFF
"켜줘." → 전원 ON
"충전해줘." → 배터리 100% 충전`,
            },
          ],
        };
      }
    );

    // ── 상태 조회 ──────────────────────────────────────────────
    this.server.tool(
      "get_lamp_state",
      "Calcifer 램프의 현재 상태(전원·밝기·색온도·모드·볼륨·배터리·텐트크기)를 조회합니다.",
      {},
      async () => {
        const state = await getState();
        return {
          content: [
            {
              type: "text",
              text: `🔥 Calcifer 현재 상태
• 전원: ${state.power ? "ON ✅" : "OFF ❌"}
• 배터리: ${state.battery.toFixed(1)}%${state.battery <= 20 ? " ⚠️ 배터리 부족" : ""}
• 밝기: ${state.brightness}%
• 색온도: ${state.colorTemp}K
• 모드: ${state.mode}
• 장작 사운드 볼륨: ${state.volume}%
• 텐트 크기: ${state.tentSize}`,
            },
          ],
        };
      }
    );

    // ── 전원 ──────────────────────────────────────────────────
    this.server.tool(
      "set_power",
      "Calcifer 램프의 전원을 켜거나 끕니다. 전원을 끄면 조명과 사운드가 모두 정지됩니다.",
      { on: z.boolean().describe("true = 전원 ON, false = 전원 OFF") },
      async ({ on }) => {
        const state = await getState();
        state.power = on;
        await saveState(state);
        return {
          content: [
            {
              type: "text",
              text: on
                ? "🔥 Calcifer 전원을 켰습니다."
                : "🌙 Calcifer 전원을 껐습니다.",
            },
          ],
        };
      }
    );

    // ── 밝기 ──────────────────────────────────────────────────
    this.server.tool(
      "set_brightness",
      "Calcifer 램프의 밝기를 설정합니다. 0(소등)~100(최대) 사이의 값을 지정하세요.",
      {
        brightness: z.number().int().min(0).max(100).describe("밝기 값 (0~100)"),
      },
      async ({ brightness }) => {
        const state = await getState();
        state.brightness = brightness;
        await saveState(state);
        return {
          content: [
            {
              type: "text",
              text: `💡 밝기를 ${brightness}%로 설정했습니다.`,
            },
          ],
        };
      }
    );

    // ── 색온도 ────────────────────────────────────────────────
    this.server.tool(
      "set_color_temp",
      "Calcifer 램프의 색온도를 설정합니다. 2700K(따뜻한 전구색), 5500K(중간 주백색), 6000K(차가운 주광색) 중 선택하세요.",
      {
        colorTemp: z.number().int().describe("색온도 값: 2700 | 5500 | 6000"),
      },
      async ({ colorTemp }) => {
        const validTemps = [2700, 5500, 6000];
        if (!validTemps.includes(colorTemp)) {
          return {
            content: [
              {
                type: "text",
                text: "❌ 지원하는 색온도: 2700K(전구색), 5500K(주백색), 6000K(주광색)",
              },
            ],
          };
        }
        const state = await getState();
        state.colorTemp = colorTemp;
        await saveState(state);
        const label =
          colorTemp === 2700 ? "전구색 (따뜻함)" :
          colorTemp === 5500 ? "주백색 (중간)" : "주광색 (차가움)";
        return {
          content: [
            {
              type: "text",
              text: `🌡️ 색온도를 ${colorTemp}K (${label})로 설정했습니다.`,
            },
          ],
        };
      }
    );

    // ── 모드 ──────────────────────────────────────────────────
    this.server.tool(
      "set_mode",
      "Calcifer 램프의 모드를 설정합니다. 일반/취침/독서/기상 중 하나를 선택하세요. 각 모드는 밝기와 색온도를 자동으로 조정합니다.",
      {
        mode: z.enum(["일반", "취침", "독서", "기상"]).describe("모드: 일반 | 취침 | 독서 | 기상"),
      },
      async ({ mode }) => {
        const state = await getState();
        state.mode = mode;

        if (mode === "취침") {
          state.brightness = 10;
          state.colorTemp = 2700;
          state.volume = 10;
        } else if (mode === "독서") {
          state.brightness = 80;
          state.colorTemp = 5500;
        } else if (mode === "기상") {
          state.brightness = 95;
          state.colorTemp = 6000;
          state.volume = 0;
        }

        await saveState(state);

        const modeDesc: Record<string, string> = {
          일반: "🌟 일반 모드로 전환했습니다.",
          취침: "🌙 취침 모드로 전환했습니다. (밝기 10%, 2700K, 볼륨 10%)",
          독서: "📖 독서 모드로 전환했습니다. (밝기 80%, 5500K)",
          기상: "☀️ 기상 모드로 전환했습니다. (밝기 95%, 6000K, 볼륨 0%)",
        };

        return {
          content: [{ type: "text", text: modeDesc[mode] }],
        };
      }
    );

    // ── 볼륨 ──────────────────────────────────────────────────
    this.server.tool(
      "set_volume",
      "Calcifer 램프의 장작 모닥불 사운드 볼륨을 설정합니다. 0(무음)~100(최대) 사이의 값을 지정하세요.",
      {
        volume: z.number().int().min(0).max(100).describe("볼륨 값 (0~100)"),
      },
      async ({ volume }) => {
        const state = await getState();
        state.volume = volume;
        await saveState(state);
        return {
          content: [
            {
              type: "text",
              text:
                volume === 0
                  ? "🔇 장작 사운드를 무음으로 설정했습니다."
                  : `🔊 장작 사운드 볼륨을 ${volume}%로 설정했습니다.`,
            },
          ],
        };
      }
    );

    // ── 텐트 크기 ─────────────────────────────────────────────
    this.server.tool(
      "set_tent_size",
      "텐트 크기를 설정합니다. 크기에 따라 기본 밝기가 자동으로 조정됩니다. (1인용→25%, 2인용→50%, 3~4인용→75%, 5인 이상→100%)",
      {
        tentSize: z
          .enum(["1인용", "2인용", "3~4인용", "5인 이상"])
          .describe("텐트 크기: 1인용 | 2인용 | 3~4인용 | 5인 이상"),
      },
      async ({ tentSize }) => {
        const state = await getState();
        state.tentSize = tentSize;

        if (tentSize === "1인용")        state.brightness = 25;
        else if (tentSize === "2인용")   state.brightness = 50;
        else if (tentSize === "3~4인용") state.brightness = 75;
        else if (tentSize === "5인 이상") state.brightness = 100;

        await saveState(state);
        return {
          content: [
            {
              type: "text",
              text: `⛺ 텐트 크기를 ${tentSize}로 설정했습니다. 밝기가 ${state.brightness}%로 자동 조정되었습니다.`,
            },
          ],
        };
      }
    );

    // ── 배터리 완충 ───────────────────────────────────────────
    this.server.tool(
      "charge_battery",
      "Calcifer 램프의 배터리를 100%로 완전 충전합니다.",
      {},
      async () => {
        const state = await getState();
        state.battery = 100.0;
        await saveState(state);
        return {
          content: [
            {
              type: "text",
              text: "⚡ 배터리를 100%로 완전 충전했습니다.",
            },
          ],
        };
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return CalcifierMCP.serve("/mcp").fetch(request, env, ctx);
    }

    if (url.pathname === "/state" && request.method === "GET") {
      return env.MY_KV.get("state").then((val) =>
        new Response(val ?? "{}", {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        })
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
