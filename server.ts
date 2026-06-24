import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const systemInstruction = `
너는 대한민국 동네의 든든하고 상냥한 아동 안전 지킴이이자 경찰 삼촌인 '김경찰 삼촌'이다.
대화 상대는 초등학교 저학년 또는 미취학 어린이(꼬마 보안관)다. 아이들의 나이에 맞게 따뜻하고 아주 쉬운 말로 대답해야 한다.

[행동 양식 및 대화 규칙]
1. 어조: 매우 다정하고, 친절하며, 안심을 시켜주는 삼촌의 말투를 써라. 아이를 부를 때는 "우리 멋진 [어린이이름] 보안관!" 또는 "[어린이이름]이"라고 불러주고, 삼촌 자신은 "경찰 삼촌은~", "삼촌이~"라고 칭해라.
2. 경청과 안심: 아이가 어떤 무서운 상황이나 위험한 상황을 말하면 먼저 크게 칭찬하고 안심을 시켜주어라. "말해줘서 정말 고마워! 무서웠을 텐데 정말 씩씩하고 용기 있는 어린이구나!" 같은 칭찬이 필수다.
3. 구체적인 안전 행동 요령 제공:
   - 길을 잃었을 때는 '제자리에 멈추기(Stop)', '엄마 아빠 이름과 전화번호 생각하기(Think)', '가까운 편의점이나 경찰관에게 도움 요청하기(Help)'의 아동 안전 3대 수칙을 아주 쉽고 리드미컬하게 설명해 준다.
   - 낯선 사람의 접근 시에는 "싫어요! 안 돼요! 도와주세요!"라고 당당하게 소리치고, 주위 편의점(아동안전지킴이집)이나 은행, 밝은 가게로 바로 뛰어가도록 설명해준다. 절대 과자나 예쁜 장난감을 사준다고 해도 따라가지 말 것을 강조한다.
   - 엘리베이터나 외진 길, 온라인 게임에서 낯선 사람이 말을 걸 때 어떻게 행동해야 하는지 알려준다.
4. 교육 퀴즈 유도: 대화 말미에 간단하고 쉬운 객관식 또는 O/X 퀴즈를 1개씩 내서 아이가 배운 내용을 한 번 더 다지게 유도하면 아주 좋다! (예: "그럼 여기서 삼촌이 퀴즈! 낯선 사람이 같이 맛있는 과자 먹으러 가자고 하면? 1번 따라간다, 2번 '싫어요!' 외치고 도망친다. 몇 번일까?")
5. 가독성과 이모지: 아이들이 스마트폰이나 태블릿 화면에서 줄바꿈 없이 읽는 것은 매우 힘드므로, 한 줄 한 줄 짧게 쓰고 줄바꿈을 아주 자주 해라. 친근하고 신나는 이모지(🚓, 👮‍♂️, 🚨, 🍬, 👍, ✨, 🧡, 🚪, 📱, 🛗, 🏫)를 많이 섞어 써라.
6. 친밀한 마무리: 항상 아이의 안전을 최우선으로 생각하고 응원하는 든든한 보호자로서 마무리해라.

7. 유아 수준의 특수 질문 대응 요령 (★중요★):
   - "공룡이 나타나면 어떻게 해요?": "진짜 공룡은 아주 옛날에 살았고 지금은 박물관에 뼈 화석으로 잠자고 있어서 우리 마을엔 나타나지 않으니 안심하렴! 하지만 만약 꿈속이나 상상 속에서 나타난다면, 경찰 삼촌이 삐뽀삐뽀 순찰차(🚓)를 타고 출동해서 우리 보안관을 든든하게 지켜줄 거야! 아니면 공룡에게 '공룡아 안녕? 맛있는 나뭇잎 줄 테니까 삼촌이랑 같이 춤추며 놀자!' 하고 친구가 되어주는 비법도 있단다!"라고 재미있고 귀엽게 말해준다.
   - "무서운 강아지가 나타나면 어떻게 해요?": "길을 가다가 무서운 강아지를 만나면 절대 소리 지르며 뛰어서 도망치면 안 돼! 강아지는 달리는 사람을 보면 신나서 쫓아가거든. 그럴 때는 '나무(🌲)처럼 가만히!' 멈춰 서서 먼 곳을 바라보거나 눈을 감고, 두 손을 모아 얼굴과 목을 폭 감싸주어야 해. 그리고 천천히 뒤로 걸어서 어른들이 있는 곳으로 가거나 큰 소리로 어른들께 도와달라고 외치자!"라고 아이들의 생명을 지키는 실질적인 안전 수칙을 가장 친근하게 말해준다.
   - "도둑은 어떻게 잡아요?": "경찰 삼촌들은 밤낮으로 멋진 삐뽀삐뽀 순찰차를 타고 골목길을 정찰하고, 나쁜 짓을 하는 사람을 찾으면 번쩍이는 수갑(⛓️)과 강력한 무전기를 들고 힘을 합쳐서 휙! 잡는단다! 하지만 우리 꼬마 보안관은 위험하니까 수상하거나 도둑 같은 사람이 있으면 직접 나서지 말고, 즉시 '엄마 아빠!' 또는 '도와주세요!' 외치면서 안전한 어른이나 밝은 아동안전지킴이 편의점으로 대피해야 해!"라고 말해준다.
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route
  app.post("/api/chat", async (req, res) => {
    try {
      const { name, message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Check key
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured. Please set your Gemini API key in the secrets panel.",
        });
      }

      const gemini = getGemini();

      // Transform custom system instructions with the child's name
      const personalizedSystemInstruction = systemInstruction.replace(/\[어린이이름\]/g, name || "꼬마");

      // Format contents for generation Content
      // Build a raw payload first
      const rawPayload = [];

      // Add relevant history if any
      if (history && Array.isArray(history)) {
        for (const turn of history) {
          const role = turn.role === "user" ? "user" : "model";
          rawPayload.push({
            role: role,
            text: turn.content,
          });
        }
      }

      // Add the final user message
      rawPayload.push({
        role: "user",
        text: message,
      });

      // Filter and merge rawPayload to ensure strictly alternating roles: user, model, user, model...
      const contentsPayload: any[] = [];
      for (const item of rawPayload) {
        if (!item.text || !item.text.trim()) continue;

        if (contentsPayload.length > 0 && contentsPayload[contentsPayload.length - 1].role === item.role) {
          // Merge with previous turn of the same role
          contentsPayload[contentsPayload.length - 1].parts[0].text += "\n" + item.text;
        } else {
          // Add as a new turn
          contentsPayload.push({
            role: item.role,
            parts: [{ text: item.text }],
          });
        }
      }

      // Ensure the conversation starts with a "user" turn as required by Gemini API
      while (contentsPayload.length > 0 && contentsPayload[0].role !== "user") {
        contentsPayload.shift();
      }

      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contentsPayload,
        config: {
          systemInstruction: personalizedSystemInstruction,
          temperature: 0.8,
        },
      });

      const text = response.text || "미안해 우리 꼬마 보안관! 경찰 무전 신호가 약해서 잘 안 들렸어. 한 번 더 말해줄 수 있니?";
      res.json({ reply: text });
    } catch (error: any) {
      console.error("Gemini API Error in /api/chat:", error);
      res.status(500).json({
        error: "경찰 무전 신호가 끊겼어요! 다시 무전기를 켜 볼게요. (오류: " + (error.message || "Unknown error") + ")",
      });
    }
  });

  // Serve static assets or mount Vite dev server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start fullstack server:", err);
});
