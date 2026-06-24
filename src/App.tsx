import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Trash2,
  Settings,
  Sparkles,
  BookOpen,
  X,
  AlertTriangle,
  Volume1,
  HelpCircle,
  Home,
  Check,
  Info,
} from "lucide-react";
import { Message, UserProfile, TTSConfig, SafetyScenario } from "./types";
import { SAFETY_SCENARIOS } from "./scenarios";

// Prevent garbage collection of SpeechSynthesisUtterance in Chrome/Safari/Edge, keeping Web Speech API live
let activeUtteranceHolder: any = null;

export default function App() {
  // --- States ---
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem("gim_police_profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [onboardName, setOnboardName] = useState("");
  const [onboardGender, setOnboardGender] = useState<"boy" | "girl" | "none">("none");

  const [inputMessage, setInputMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem("gim_police_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sound States (TTS) - Default to a warmer, deeper male pitch (0.75) and steady speed (0.95) matching the police uncle character
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>(() => {
    try {
      const saved = localStorage.getItem("gim_police_tts");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
    return { enabled: true, voiceName: "", speed: 0.95, pitch: 0.75 };
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Mic States (STT)
  const [isListening, setIsListening] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);

  // Settings & Deletion Confirmation modal States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0); // 0 = closed, 1 = warning, 2 = parent check
  const [parentQuizAnswer, setParentQuizAnswer] = useState("");
  const [parentQuizError, setParentQuizError] = useState(false);

  // Filter category for scenario cards
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Helper reference
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom uploaded character image
  const [customCharacterImage, setCustomCharacterImage] = useState<string | null>(() => {
    return localStorage.getItem("gim_custom_character");
  });

  // Custom uploaded start button image
  const [customStartBtnImage, setCustomStartBtnImage] = useState<string | null>(() => {
    return localStorage.getItem("gim_custom_start_btn_image");
  });

  // Fold or unfold the 12 safety cards
  const [isCardsFolded, setIsCardsFolded] = useState<boolean>(true);

  // Safety Board Modal for showing all 12 cards at once
  const [showSafetyBoardModal, setShowSafetyBoardModal] = useState<boolean>(false);

  // Handle custom image uploads for the character
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCustomCharacterImage(base64String);
        localStorage.setItem("gim_custom_character", base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetCharacter = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomCharacterImage(null);
    localStorage.removeItem("gim_custom_character");
  };

  // --- Voice Engine Logic (TTS) ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsIframe(window.self !== window.top);
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        // Look specifically for Korean language voices
        const koVoices = voices.filter((v) => v.lang.includes("ko") || v.lang.includes("KO"));
        setAvailableVoices(koVoices.length > 0 ? koVoices : voices);

        // Pre-select a pleasant voice matching the police officer character
        setTtsConfig((prev) => {
          const maleKeywords = ["injoon", "minsu", "junwoo", "subin", "shin", "male", "남성", "남자", "m0005", "yondae", "jinho", "seunghoon"];
          
          // If the current saved voice name is already a male voice, keep it
          const isCurrentVoiceMale = prev.voiceName && maleKeywords.some((kw) => prev.voiceName.toLowerCase().includes(kw));
          if (prev.voiceName && isCurrentVoiceMale) return prev;

          const koVoice = koVoices.find((v) => {
            const lName = v.name.toLowerCase();
            return maleKeywords.some((kw) => lName.includes(kw));
          }) || koVoices[0];
          
          return {
            ...prev,
            voiceName: koVoice ? koVoice.name : "",
            pitch: koVoice && maleKeywords.some((kw) => koVoice.name.toLowerCase().includes(kw)) ? 0.85 : 0.7, // Lower pitch if fallback
          };
        });
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      // Unblock/unlock browser speech on direct active gesture touch anywhere
      const handleGestureUnlock = () => {
        unlockSpeech();
        window.removeEventListener("click", handleGestureUnlock);
        window.removeEventListener("touchstart", handleGestureUnlock);
      };
      window.addEventListener("click", handleGestureUnlock);
      window.addEventListener("touchstart", handleGestureUnlock);

      return () => {
        window.removeEventListener("click", handleGestureUnlock);
        window.removeEventListener("touchstart", handleGestureUnlock);
      };
    }
  }, []);

  // Update localStorage when state changes
  useEffect(() => {
    if (profile) {
      localStorage.setItem("gim_police_profile", JSON.stringify(profile));
    } else {
      localStorage.removeItem("gim_police_profile");
    }
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("gim_police_history", JSON.stringify(chatHistory));
    scrollChat();
  }, [chatHistory]);

  useEffect(() => {
    localStorage.setItem("gim_police_tts", JSON.stringify(ttsConfig));
  }, [ttsConfig]);

  const scrollChat = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 60);
  };

  // Gesture-unlock SpeechSynthesis on mobile/tablet browsers
  const unlockSpeech = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.cancel();
        
        // Use a real syllable "아" instead of an empty space " " to prevent the Web Speech synthesis engine from hanging
        const u = new SpeechSynthesisUtterance("아");
        u.volume = 0.001; // nearly silent
        u.rate = 3.0; // speak extremely fast so it finishes immediately
        u.lang = "ko-KR";
        window.speechSynthesis.speak(u);
      } catch (err) {
        console.warn("SpeechSynthesis unlock failed:", err);
      }
    }
  };

  // Convert numbers (e.g., 1 -> 일, 2 -> 이, 112 -> 일일이) into Korean words for Speech Synthesis
  const convertNumbersToKoreanWords = (inputText: string): string => {
    let processed = inputText;
    
    // Explicit map for common emergency codes
    processed = processed.replace(/112/g, "일일이");
    processed = processed.replace(/119/g, "일일구");
    processed = processed.replace(/110/g, "일일영");
    
    // Replace all occurrences of numbers (digits sequence)
    processed = processed.replace(/\d+/g, (match) => {
      const num = parseInt(match, 10);
      if (isNaN(num)) return match;
      
      if (match.length === 1) {
        const singleDigits: { [key: string]: string } = {
          "0": "영", "1": "일", "2": "이", "3": "삼", "4": "사",
          "5": "오", "6": "육", "7": "칠", "8": "팔", "9": "구"
        };
        return singleDigits[match] || match;
      }
      
      return numToKorean(num);
    });
    
    return processed;
  };

  const numToKorean = (num: number): string => {
    if (num === 0) return "영";
    
    const units = ["", "십", "백", "천", "만"];
    const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    
    const numStr = num.toString();
    let result = "";
    const len = numStr.length;
    
    for (let i = 0; i < len; i++) {
      const d = parseInt(numStr[i], 10);
      const position = len - 1 - i;
      
      if (d !== 0) {
        if (d === 1 && position > 0) {
          result += units[position];
        } else {
          result += digits[d] + units[position];
        }
      }
    }
    
    return result;
  };

  // Perform TTS speech with self-healing fallback
  const readAloud = (text: string, isFallbackAttempt = false) => {
    if (!ttsConfig.enabled || typeof window === "undefined" || !window.speechSynthesis) return;

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel(); // Stop talking first
    } catch (_) {}

    // A small timeout to ensure the cancel operation completes and clears the queue before we speak the new utterance
    setTimeout(() => {
      try {
        // Clean text by COMPLETELY stripping all emojis, symbols, and markers for flawless TTS audio flow
        let cleanText = convertNumbersToKoreanWords(text);

        // Remove common unicode emoji blocks completely
        cleanText = cleanText.replace(/[\u1F600-\u1F64F]/gu, ""); // Emoticons
        cleanText = cleanText.replace(/[\u1F300-\u1F5FF]/gu, ""); // Misc Symbols and Pictographs
        cleanText = cleanText.replace(/[\u1F680-\u1F6FF]/gu, ""); // Transport and Map symbols
        cleanText = cleanText.replace(/[\u2600-\u26FF]/gu, "");   // Misc symbols
        cleanText = cleanText.replace(/[\u2700-\u27BF]/gu, "");   // Dingbats
        cleanText = cleanText.replace(/[\u1F900-\u1F9FF]/gu, ""); // Supplemental Symbols and Pictographs
        cleanText = cleanText.replace(/[\u1F1E0-\u1F1FF]/gu, ""); // Flags
        cleanText = cleanText.replace(/[\u2000-\u3300]/gu, "");   // Common symbol range
        cleanText = cleanText.replace(/[\ud83c-\ud83e][\ud000-\udfff]/g, ""); // Catch all remaining multi-byte emojis
        
        // Remove typical markdown and visual indicators so they are not read literally
        cleanText = cleanText.replace(/[\*\#\_\~`\[\]\(\)\{\}\-\+\=\|\:\;\"\'\<\>\?\/\\@%^&➡➔➜🎈🍭👮🚪🛗🛑🔥📱🥊🐕🩹🚔🌀🌟✨👍🚨]/g, " ");
        cleanText = cleanText.replace(/\s+/g, " ").trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = "ko-KR";
        utterance.rate = ttsConfig.speed;
        utterance.pitch = ttsConfig.pitch;

        // Try to use voice unless we are in fallback attempt
        if (!isFallbackAttempt) {
          const maleKeywords = ["injoon", "minsu", "junwoo", "subin", "shin", "male", "남성", "남자", "m0005", "yondae", "jinho", "seunghoon"];
          const koVoices = availableVoices.filter((v) => v.lang.includes("ko") || v.lang.includes("KO"));
          
          if (ttsConfig.voiceName) {
            const selectedVoice = availableVoices.find((v) => v.name === ttsConfig.voiceName);
            if (selectedVoice) {
              utterance.voice = selectedVoice;
            }
          } else {
            // Automatically search for a male voice among Korean voices
            const maleKoVoice = koVoices.find((v) => {
              const lName = v.name.toLowerCase();
              return maleKeywords.some((kw) => lName.includes(kw));
            });
            
            if (maleKoVoice) {
              utterance.voice = maleKoVoice;
            } else if (koVoices.length > 0) {
              utterance.voice = koVoices[0];
              // Since it fell back to a default voice (which might be female), make pitch lower (deeper male voice)
              utterance.pitch = 0.7; 
            }
          }
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        
        utterance.onerror = (evt) => {
          console.error("SpeechSynthesis utterance error:", evt);
          setIsSpeaking(false);
          
          if (!isFallbackAttempt && (ttsConfig.voiceName || availableVoices.length > 0)) {
            readAloud(text, true);
          }
        };

        activeUtteranceHolder = utterance; // Prevent garbage collection

        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error("SpeechSynthesis speak failed:", e);
        setIsSpeaking(false);
      }
    }, 80);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // --- Mic Engine Logic (STT) ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.lang = "ko-KR";
      rec.interimResults = false;

      rec.onstart = () => {
        setIsListening(true);
        setSttError(null);
        stopSpeaking();
      };

      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          setInputMessage((prev) => (prev ? prev + " " + transcript : transcript));
        }
      };

      rec.onerror = (e: any) => {
        console.error("STT Microphone Error:", e);
        if (e.error === "not-allowed") {
          setSttError("마이크 권한이 없어요. 브라우저 주소창 왼쪽의 자물쇠 버튼을 눌러 권한을 허락해 주세요!");
        } else {
          setSttError("소리를 잘 듣지 못했어요. 삼촌에게 한 번 더 크게 속삭여주세요!");
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setSttError("이 환경에서는 마이크 음성 인식이 지원되지 않아요. 아래 키보드로 입력해 주세요!");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start voice recognition:", err);
      }
    }
  };

  // --- Send Message to Core Gemini API ---
  const handleSendMessage = async (textToSend?: string) => {
    unlockSpeech();

    const text = (textToSend || inputMessage).trim();
    if (!text) return;
    if (!profile) return;

    stopSpeaking();

    if (!textToSend) {
      setInputMessage("");
    }

    const userMsg: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setIsAiLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          message: text,
          history: chatHistory.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "경찰 무전 신호가 불안정합니다.");
      }

      const data = await response.json();
      const botReply = data.reply;

      const assistantMsg: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: botReply,
        timestamp: new Date(),
      };

      setChatHistory((prev) => [...prev, assistantMsg]);

      // solved educational counters
      setProfile((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          solvedCount: prev.solvedCount + 1,
        };
      });

      setTimeout(() => {
        readAloud(botReply);
      }, 150);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "네트워크 수신이 지연되고 있어요. 다시 시도해 주세요.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- Onboarding Logic ---
  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    unlockSpeech();

    const formattedName = onboardName.trim();
    if (!formattedName) return;

    const newProfile: UserProfile = {
      name: formattedName,
      gender: onboardGender,
      avatarColor:
        onboardGender === "boy"
          ? "from-blue-400 to-indigo-500"
          : onboardGender === "girl"
          ? "from-pink-400 to-rose-400"
          : "from-amber-400 to-yellow-500",
      streakCount: 1,
      solvedCount: 0,
    };

    setProfile(newProfile);

    const initialGreeting = `안녕! 우리 씩씩한 ${formattedName} 꼬마 보안관 반가워요! 🚓✨
나는 우리 동네 안전을 지키는 친절한 삼촌, 김경찰이란다!👮‍♂️

길을 잃었거나, 낯선 사람을 만났을 때, 혹은 집에서 깜짝 놀랄 상황이 생기면 언제든지 삼촌에게 SOS를 보내줘요!
아래에 있는 '안전 수칙 카드'를 선택해 보거나, 마이크 단추를 눌러 삼촌과 직접 목소리로 대화하며 위기 대처 훈련을 해볼까? 👍`;

    setChatHistory([
      {
        id: "greeting",
        role: "assistant",
        content: initialGreeting,
        timestamp: new Date(),
      },
    ]);

    setTimeout(() => {
      readAloud(initialGreeting);
    }, 400);
  };

  const handleStartDelete = () => {
    setDeleteStep(1);
    setParentQuizAnswer("");
    setParentQuizError(false);
  };

  const handleVerifyParentQuiz = () => {
    // Parent safety check lock (7 + 5 = 12)
    if (parentQuizAnswer.trim() === "12") {
      stopSpeaking();
      localStorage.removeItem("gim_police_profile");
      localStorage.removeItem("gim_police_history");
      setProfile(null);
      setChatHistory([]);
      setShowSettingsModal(false);
      setDeleteStep(0);
    } else {
      setParentQuizError(true);
    }
  };

  const handleScenarioClick = (scenario: SafetyScenario) => {
    setInputMessage("");
    setIsCardsFolded(true); // Close drawer to focus on chat
    handleSendMessage(scenario.prompt);
  };

  const handleEmergencyAlert = () => {
    stopSpeaking();
    const emergencyMsg: Message = {
      id: Math.random().toString(36).substring(7),
      role: "assistant",
      content: `🚨 [김경찰 삼촌의 112 긴급 신고 대처 방법]
어린이 여러분! 진짜로 매우 위급하고 무서운 상황이 생기면 언제든지 주저하지 말고 이렇게 하세요!

1. 스마트폰에서 전화 버튼을 눌러요.
2. 숫자 버튼 1, 1, 2 세 개를 순서대로 누릅니다.
3. 통화 버튼을 누르고 경찰관 삼촌/이모에게 내가 어디에 있는지, 무슨 일이 생겼는지 침착하게 말해요!
4. 만약 스마트폰이 없으면 근처에 '아동 안전지킴이집' 스티커가 붙은 편의점이나 약국으로 씩씩하게 들어가서 도움을 외쳐요!`,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, emergencyMsg]);
    setTimeout(() => {
      readAloud(emergencyMsg.content);
    }, 100);
  };

  const formatTime = (dateObj: Date | string) => {
    try {
      const d = typeof dateObj === "string" ? new Date(dateObj) : dateObj;
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? "오후" : "오전";
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const minutesStr = minutes < 10 ? "0" + minutes : minutes;
      return `${ampm} ${hours}:${minutesStr}`;
    } catch {
      return "오후 2:30";
    }
  };

  return (
    <div
      id="app-root"
      className="h-screen max-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col relative overflow-hidden"
    >
      {/* Background Image - Styled to never get cut off (contain) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('https://i.ibb.co/wZ62gVnP/1.png')",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          opacity: 0.25, // Perfectly balanced to see the background illustration clearly while keeping the text highly legible
        }}
      />

      {/* --- Top Global Header Banner --- */}
      <header
        id="app-header"
        className="h-16 bg-[#1E293B] flex items-center justify-between px-4 sm:px-8 text-white shrink-0 shadow-md sticky top-0 z-40"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white/20 shadow-inner">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-sm sm:text-xl font-bold tracking-tight text-white block sm:inline">
              우리동네 챗봇 <span className="text-blue-400 font-extrabold">김경찰</span>
            </span>
            <p className="text-[10px] text-slate-300 hidden sm:block">어린이 안전 상황 대처 수호천사</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Connection status badge matching Design HTML */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
            <span className="text-xs font-medium text-green-100">실시간 치안센터 연결됨</span>
          </div>

          {/* SOS button */}
          <button
            onClick={handleEmergencyAlert}
            className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-bold shadow-lg shadow-red-900/20 uppercase cursor-pointer"
          >
            긴급 신고 (112)
          </button>

          {profile && (
            <button
              id="header-exit-btn"
              onClick={() => {
                stopSpeaking();
                setProfile(null);
              }}
              className="px-2.5 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1 cursor-pointer"
              title="메인 화면으로 가기"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden md:inline">처음으로</span>
            </button>
          )}

          {/* Quick Voice (TTS) Toggle Icon */}
          <button
            id="tts-toggle-btn"
            onClick={() => {
              setTtsConfig((prev) => {
                const next = { ...prev, enabled: !prev.enabled };
                if (!next.enabled) stopSpeaking();
                return next;
              });
            }}
            className={`p-2 rounded-md flex items-center justify-center transition-all cursor-pointer ${
              ttsConfig.enabled
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
            }`}
            title="목소리 읽어주기 기능 켜고 끄기"
          >
            {ttsConfig.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {profile && (
            <button
              id="header-safety-cards-btn"
              type="button"
              onClick={() => setShowSafetyBoardModal(true)}
              className="px-2.5 py-1.5 rounded-md text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-900 border border-amber-400 transition-all flex items-center gap-1 shadow cursor-pointer animate-pulse"
              title="12가지 안전 가이드 수칙 카드 목록 한눈에 보기"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden md:inline">12대 수칙판</span>
            </button>
          )}

          <button
            id="settings-modal-btn"
            onClick={() => {
              setShowSettingsModal(true);
              setDeleteStep(0);
            }}
            className="p-2 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            title="보호자 환경설정 및 데이터 삭제"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* --- Main Dashboard Container --- */}
      <main className={`flex-1 max-w-7xl w-full mx-auto p-2 sm:p-3 flex flex-col relative z-10 overflow-hidden ${!profile ? "items-center justify-center" : "items-stretch"}`}>
        <AnimatePresence mode="wait">
          {!profile ? (
            /* --- Onboarding Form Stage --- */
            <motion.div
              id="onboarding-view"
              key="onboarding"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-lg"
            >
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-[#1E293B]" />
                
                <div className="mx-auto w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-4xl mb-5 shadow-inner border border-blue-100 relative">
                  👮‍♂️
                  <span className="absolute -bottom-1 -right-1 text-sm bg-yellow-400 p-1 rounded-full shadow">🚓</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
                  안녕! 나는 골목길 치안 안전대장 <br />
                  <span className="text-blue-600 font-extrabold">김경찰 삼촌</span>이란다! 💙
                </h2>
                
                <p className="text-slate-500 text-xs sm:text-sm mb-6 leading-relaxed font-medium">
                  우리 씩씩한 꼬마 보안관님의 이름을 알려주면,<br />
                  삼촌이 이름을 다정하게 불러주며 맞춤 안전수칙을 가르쳐줄게요!
                </p>

                <form onSubmit={handleOnboardSubmit} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">
                      보안관의 이름을 알려주세요! (최대 8글자)
                    </label>
                    <input
                      required
                      type="text"
                      id="onboard-name-input"
                      maxLength={8}
                      value={onboardName}
                      onChange={(e) => setOnboardName(e.target.value)}
                      placeholder="예: 민우, 서윤"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-base font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">
                      성별을 선택해주면 삼촌이 더 다정하게 얘기할 수 있어요!
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        id="gender-boy-btn"
                        onClick={() => setOnboardGender("boy")}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          onboardGender === "boy"
                            ? "bg-blue-50 border-blue-400 shadow-sm text-blue-700 font-bold"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-2xl mb-1 block">👦</span>
                        <span className="text-xs font-bold">남자아이</span>
                      </button>

                      <button
                        type="button"
                        id="gender-girl-btn"
                        onClick={() => setOnboardGender("girl")}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          onboardGender === "girl"
                            ? "bg-pink-50 border-pink-400 shadow-sm text-pink-700 font-bold"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-2xl mb-1 block">👧</span>
                        <span className="text-xs font-bold">여자아이</span>
                      </button>

                      <button
                        type="button"
                        id="gender-none-btn"
                        onClick={() => setOnboardGender("none")}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          onboardGender === "none"
                            ? "bg-slate-100 border-slate-300 shadow-sm text-slate-700 font-bold"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <span className="text-2xl mb-1 block">⭐</span>
                        <span className="text-xs font-bold">비밀</span>
                      </button>
                    </div>
                  </div>

                  {customStartBtnImage ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      id="submit-onboard-btn"
                      className="w-full h-14 rounded-xl overflow-hidden relative shadow-lg group mt-3 border border-blue-300 flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={customStartBtnImage}
                        alt="대화 시작하기"
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-[#1E293B]/60 group-hover:bg-[#1E293B]/55 transition-all" />
                      <div className="absolute inset-0 flex items-center justify-center gap-1.5 text-white">
                        <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                        <span className="text-sm font-black tracking-wider drop-shadow">
                          대화 시작하기 ➔
                        </span>
                      </div>
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      id="submit-onboard-btn"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-4 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-1.5 mt-3 cursor-pointer"
                    >
                      <Sparkles className="w-4.5 h-4.5 text-yellow-300" />
                      경찰 삼촌과 안전 공부 시작하기
                    </motion.button>
                  )}
                </form>

                <div className="mt-5 pt-4 border-t border-slate-100 text-[10px] text-slate-400 flex items-start gap-1.5 text-left leading-normal">
                  <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span>우리 아이 대화 내역 및 기입한 이름 정보는 외부 웹서버가 아닌 사용자 기기 브라우저(localStorage)에만 안전하게 보관됩니다.</span>
                </div>
              </div>
            </motion.div>
          ) : (
            /* --- Interactive Main Game Playground (Active Dashboard View) --- */
            <div
              key="app-playground"
              id="app-playground"
              className="w-full flex-1 flex flex-col lg:flex-row gap-3 xl:gap-4 items-stretch overflow-hidden h-full lg:h-[calc(100vh-6.5rem)]"
            >
              
              {/* --- Sidebar: Dashboard/Alerts & Mascot --- */}
              <aside
                id="police-mirror-panel"
                className="w-full lg:w-80 bg-white border border-slate-200 shadow-sm rounded-2xl flex flex-col shrink-0 overflow-hidden lg:h-full lg:max-h-full"
              >
                {/* Location & Safety Index Block */}
                <div className="p-5 border-b border-slate-100">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">현재 보호 구역: 대전시 월평동</h2>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                    <p className="text-xs text-slate-600 mb-1 font-semibold flex items-center gap-1">
                      <span>우리동네 안전지수</span>
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">우수</span>
                    </p>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold text-slate-800">{Math.min(100, 94 + profile.solvedCount)}점</span>
                      <span className="text-xs font-medium text-green-600 pb-0.5">▲ {profile.solvedCount > 0 ? `${profile.solvedCount}% 향상` : "정상 수치"}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${Math.min(100, 94 + profile.solvedCount)}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Simulated Glass Lens Mascot Header */}
                <div className="px-5 py-2.5 border-b border-slate-100 flex flex-col items-center">
                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full font-bold tracking-wide flex items-center gap-1 shadow-xs mb-3.5 w-fit mx-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    안전 무전 거울 🛡️
                  </span>

                  {/* Character Custom Image Controls */}
                  <div className="flex items-center justify-center gap-1.5 mb-4">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[9px] bg-slate-150 hover:bg-slate-200 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      📷 다른 인형 올리기
                    </button>
                    {customCharacterImage && (
                      <button
                        onClick={handleResetCharacter}
                        className="text-[9px] bg-rose-50 text-rose-600 hover:bg-rose-100 px-2 py-1 rounded-lg font-bold border border-rose-100 transition-colors cursor-pointer"
                      >
                        삼촌 복원
                      </button>
                    )}
                  </div>

                  {/* Simulated Interactive Mascot Container (No Frame, Fully Blended, No Shaking) */}
                  <div
                    onClick={() => {
                      if (chatHistory.length > 0) {
                        const lastMsg = chatHistory[chatHistory.length - 1];
                        if (lastMsg.role === "assistant") {
                          readAloud(lastMsg.content);
                        } else {
                          readAloud(`우리 멋진 ${profile.name} 보안관! 아래 수칙 카드를 클릭해 삼촌과 이야기해 볼까요?`);
                        }
                      } else {
                        readAloud("반가워요! 나는 안전 요원 김경찰 삼촌이란다!");
                      }
                    }}
                    className="w-full bg-transparent flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer select-none transition-all duration-300"
                  >
                    {/* Dynamic Glowing Rings behind avatar based on audio */}
                    <AnimatePresence>
                      {isSpeaking && (
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.6 }}
                          animate={{ scale: 1.3, opacity: 0 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1.6 }}
                          className="absolute w-36 h-36 rounded-full border-4 border-blue-400/30 pointer-events-none"
                        />
                      )}
                      {isListening && (
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.6 }}
                          animate={{ scale: 1.3, opacity: 0 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1.2 }}
                          className="absolute w-36 h-36 rounded-full border-4 border-rose-400/40 pointer-events-none"
                        />
                      )}
                    </AnimatePresence>

                    {/* High Quality Custom CSS Police Avatar (No Frame, Blended, Fixed Parent to prevent any layout shaking) */}
                    <div className="w-36 h-36 flex items-center justify-center relative overflow-visible">
                      <motion.div
                        animate={
                          isSpeaking
                            ? {
                                scale: [1, 1.04, 0.96, 1.04, 1],
                                y: [0, -4, 1, -2, 0],
                                rotate: [0, -1.5, 1.5, -1, 0],
                              }
                            : {
                                y: [0, -1.5, 0],
                              }
                        }
                        transition={{
                          repeat: Infinity,
                          duration: isSpeaking ? 0.7 : 3,
                          ease: "easeInOut",
                        }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      >
                        <img
                          src={customCharacterImage || "https://i.ibb.co/V06q3y16/9.png"}
                          alt="경찰 삼촌 캐릭터"
                          className="w-32 h-32 object-contain pointer-events-none"
                          referrerPolicy="no-referrer"
                        />
                      </motion.div>
                    </div>

                    {/* Fixed-height feedback row to completely eliminate layout shifts or shaking */}
                    <div className="h-10 flex items-center justify-center mt-3 w-full overflow-hidden">
                      {isSpeaking && (
                        <div className="flex items-center gap-1 justify-center bg-blue-50/80 px-2.5 py-1 rounded-full border border-blue-100">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <motion.span
                              key={`equ-${i}`}
                              className="w-1 bg-blue-600 rounded-full"
                              animate={{ height: [6, 18, 4, 14, 6][i % 5] }}
                              transition={{ repeat: Infinity, duration: 0.3 + i * 0.08, ease: "easeInOut" }}
                            />
                          ))}
                        </div>
                      )}

                      {isListening && (
                        <div className="flex items-center gap-1 justify-center bg-rose-100 px-2.5 py-1 rounded-full animate-bounce border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                          <span className="text-[9px] text-red-700 font-bold">소리 듣는 중...</span>
                        </div>
                      )}

                      {!isSpeaking && !isListening && (
                        <p className="text-[11px] text-slate-400 font-bold text-center">
                          💡 터치하면 최근 대답을 다시 들려줍니다!
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent crime alerts & Neighborhood alerts */}
                <div className="p-4 sm:p-5 flex-1 overflow-y-auto flex flex-col justify-between gap-4 min-h-0">
                  <div className="space-y-4">
                    <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">실시간 범죄 예방 알림</h2>
                    
                    <div className="space-y-2.5">
                      <div className="p-3 hover:bg-slate-50 border border-slate-100 rounded-xl cursor-pointer transition-colors">
                        <p className="text-xs font-bold text-slate-800">최근 범죄 예방 교육</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed font-semibold">월평동 인근 낯선 사람이 말을 걸어올 때 대처하는 훈련 교실 상시 운용 중</p>
                      </div>

                      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                        <p className="text-xs font-bold text-blue-800">등하교 안전 수칙</p>
                        <p className="text-[10px] text-blue-600/80 mt-1 leading-relaxed font-semibold">스마트폰을 보며 걸으면 앞에 있는 위험한 인공물이나 구덩이를 보지 못해요.</p>
                      </div>

                      <div className="p-3 hover:bg-slate-50 border border-slate-100 rounded-xl cursor-pointer transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold text-slate-800">어린이 보호구역 단속</p>
                          <span className="px-1.5 py-0.5 bg-green-100 text-[8px] text-green-700 rounded font-black">정상 작동</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">학교 앞 안심 스쿨존 횡단보도 순찰 강화 조치 완료</p>
                      </div>
                    </div>
                  </div>

                  {/* Profile section at the bottom */}
                  <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${profile.avatarColor} border border-white flex items-center justify-center text-lg shadow-sm flex-shrink-0`}>
                      {profile.gender === "boy" ? "👦" : profile.gender === "girl" ? "👧" : "⭐"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{profile.name} 보안관</p>
                      <p className="text-xs text-slate-500 font-semibold">인증된 {profile.gender === "boy" ? "월평동 씩씩이" : profile.gender === "girl" ? "월평동 씩씩이" : "골목"} 꼬마 보안관</p>
                    </div>
                  </div>
                </div>
              </aside>

              {/* --- Main Chat Window --- */}
              <main
                id="chat-container-card"
                className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden self-stretch h-full lg:h-full lg:max-h-full min-h-[400px]"
              >
                {/* Chat Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-lg text-white border border-slate-700 shadow-inner">
                      👮
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">김경찰 삼촌 대화방</h4>
                      <p className="text-[10px] text-slate-500 font-semibold">목소리가 들리지 않으면 스피커 모양의 아이콘을 다시 터치하세요!</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        unlockSpeech();
                        readAloud("경찰 삼촌 목소리 테스트 중! 하나, 둘, 셋! 무전기 수신 아주 훌륭합니다!");
                      }}
                      className="text-[10px] bg-blue-600 hover:bg-blue-700 active:scale-95 font-bold text-white px-3 py-1.5 rounded-lg shadow-xs cursor-pointer transition-all"
                    >
                      🔊 삼촌 소리 테스트
                    </button>
                    {isSpeaking && (
                      <button
                        onClick={stopSpeaking}
                        className="text-[10px] bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 px-2.5 py-1.5 rounded-lg cursor-pointer"
                      >
                        말하기 멈춤
                      </button>
                    )}
                  </div>
                </div>

                {/* STT/Mic Error Notification */}
                {sttError && (
                  <div className="bg-amber-50 border-b border-amber-100 p-3 flex items-start gap-2 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <strong>음성인식 알림:</strong> {sttError}
                      <button
                        onClick={() => setSttError(null)}
                        className="block text-[10px] text-blue-600 font-bold underline mt-1 cursor-pointer"
                      >
                        닫기 [확인]
                      </button>
                    </div>
                  </div>
                )}

                {/* Iframe Speech Warning Banner */}
                {isIframe && (
                  <div className="bg-indigo-50 border-b border-indigo-100 p-2.5 sm:p-3 flex items-start gap-2 text-[10.5px] sm:text-xs text-indigo-900 leading-relaxed font-semibold">
                    <Volume2 className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5 animate-pulse" />
                    <div className="flex-1">
                      📢 <strong>김경찰 삼촌 목소리가 들리지 않으시나요?</strong> 현재 대화방이 '미리보기 창(iframe)'에서 보여지고 있어 브라우저 보안 규정상 소리가 차단될 수 있습니다. 오른쪽 상단 지구본 아이콘 뒤의 <strong>[새 창으로 열기]</strong> 또는 위 개발용 URL을 눌러 <strong>새 인터넷 탭</strong>에서 열어보시면 삼촌 목소리가 삐뽀삐뽀 우렁차게 아주 잘 들린답니다!
                    </div>
                  </div>
                )}

                {/* Active Chat Window Area */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 bg-slate-50/50">
                  {/* System Date Message */}
                  <div className="flex justify-center my-2">
                    <span className="px-3.5 py-1 bg-slate-200 text-slate-600 text-[10px] rounded-full uppercase tracking-tighter font-extrabold shadow-2xs">
                      오늘자 어린이 안전 무전 기록
                    </span>
                  </div>

                  {chatHistory.length === 0 ? (
                    <div className="text-center py-16 space-y-2.5">
                      <p className="text-4xl animate-bounce">🚓</p>
                      <p className="text-slate-400 text-xs font-bold">아래 '12대 안전 상황 무전 연습하기' 카드를 열어 대화를 즉시 시작해 보세요!</p>
                    </div>
                  ) : (
                    chatHistory.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-3.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.role !== "user" && (
                          <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-sm text-white shrink-0 border border-slate-700 shadow-xs">
                            👮
                          </div>
                        )}

                        <div className="max-w-[75%]">
                          <span className={`text-[10px] text-slate-400 font-bold mb-1.5 block px-1 ${
                            msg.role === "user" ? "text-right" : "text-left"
                          }`}>
                            {msg.role === "user" ? `${profile.name} 보안관` : "김경찰 삼촌"}
                          </span>

                          <div
                            onClick={() => {
                              if (msg.role === "assistant") {
                                readAloud(msg.content);
                              }
                            }}
                            className={`p-3.5 rounded-2xl text-xs sm:text-sm border relative leading-relaxed transition-all ${
                              msg.role === "user"
                                ? "bg-blue-600 text-white rounded-tr-none border-blue-500 shadow-md shadow-blue-200"
                                : "bg-white text-slate-800 rounded-tl-none border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50/80"
                            }`}
                          >
                            <p className="whitespace-pre-line font-medium leading-relaxed">{msg.content}</p>
                            
                            {msg.role === "assistant" && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[9px] text-blue-600 flex items-center gap-1 font-bold">
                                <Volume1 className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                                말풍선을 누르면 삼촌 목소리로 읽어줘요!
                              </div>
                            )}
                          </div>

                          <span className={`text-[9px] text-slate-400 mt-1 block ${
                            msg.role === "user" ? "text-right mr-1" : "text-left ml-1"
                          }`}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>

                        {msg.role === "user" && (
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${profile.avatarColor} text-white flex items-center justify-center text-sm border border-white/20 shadow-xs shrink-0`}>
                            {profile.gender === "boy" ? "👦" : profile.gender === "girl" ? "👧" : "⭐"}
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {isAiLoading && (
                    <div className="flex items-start gap-3.5 animate-pulse">
                      <div className="w-9 h-9 bg-slate-800 rounded-xl text-white flex items-center justify-center text-sm border border-slate-700 shadow-xs">
                        👮
                      </div>
                      <div className="max-w-[75%] space-y-1.5">
                        <span className="text-[10px] text-slate-400 font-bold ml-1">김경찰 삼촌</span>
                        <div className="bg-white border border-slate-200 p-3.5 rounded-2xl rounded-tl-none text-xs text-slate-600 flex items-center gap-2 shadow-sm">
                          <span className="animate-spin">🚓</span>
                          <span className="font-semibold">안전 무전 지침을 차분히 작성하는 중입니다...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="bg-rose-50 text-rose-800 text-xs p-4 rounded-xl border border-rose-200 shadow-inner flex items-start gap-2.5">
                      <span className="text-sm">🚨</span>
                      <div className="flex-1">
                        <strong>무전 송수신 지연:</strong> {errorMessage}
                        <button
                          onClick={() => handleSendMessage(chatHistory[chatHistory.length - 1]?.content)}
                          className="block text-rose-700 font-bold underline mt-1.5 text-[10px] cursor-pointer"
                        >
                          [여기를 눌러 무전기 재송신 시도]
                        </button>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* --- 12 Recommendation cards container (Inside Chat box as dynamic collapsible cards) --- */}
                <div className="border-t border-slate-200 p-4 bg-slate-50/50 space-y-3">
                  <div
                    onClick={() => setIsCardsFolded(!isCardsFolded)}
                    className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer select-none transition-all shadow-2xs"
                  >
                    <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <BookOpen className="w-4.5 h-4.5 text-blue-500" />
                      🚓 김경찰 삼촌과 안전 상황 무전 연습하기
                    </h4>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">
                      {isCardsFolded ? "안전 수칙카드 펼치기 ▾" : "수칙카드 접기 ▴"}
                    </span>
                  </div>

                  {!isCardsFolded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-3 max-h-[190px] overflow-y-auto pr-1"
                    >
                      {/* Interactive Scenario categories selector */}
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] font-bold text-slate-400 mr-1.5">상황별:</span>
                        {[
                          { id: "all", label: "전체보기" },
                          { id: "lost", label: "📍 길잃음" },
                          { id: "stranger", label: "🙅 낯선사람" },
                          { id: "home", label: "🏠 집안안전" },
                          { id: "daily", label: "🏫 일상수칙" },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`text-[10px] px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                              selectedCategory === cat.id
                                ? "bg-slate-800 border-slate-800 text-white"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {SAFETY_SCENARIOS.filter(
                          (s) => selectedCategory === "all" || s.category === selectedCategory
                        ).map((sc) => {
                          let cardStyle = "border-sky-100 bg-white hover:border-sky-300";
                          let labelColor = "bg-sky-50 text-sky-700";
                          if (sc.category === "lost") {
                            cardStyle = "border-orange-100 bg-white hover:border-orange-300";
                            labelColor = "bg-orange-50 text-orange-700";
                          } else if (sc.category === "stranger") {
                            cardStyle = "border-red-100 bg-white hover:border-red-300";
                            labelColor = "bg-red-50 text-red-700";
                          } else if (sc.category === "home") {
                            cardStyle = "border-amber-100 bg-white hover:border-amber-300";
                            labelColor = "bg-amber-50 text-amber-700";
                          }

                          return (
                            <div
                              key={sc.id}
                              onClick={() => handleScenarioClick(sc)}
                              className={`p-3 rounded-xl border shadow-xs flex flex-col justify-between cursor-pointer transition-all group hover:-translate-y-0.5 ${cardStyle}`}
                            >
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xl p-1 bg-slate-50 rounded-xl">{sc.icon}</span>
                                  <span className={`text-[8px] sm:text-[9px] px-1.5 py-0.5 rounded-lg font-black ${labelColor}`}>
                                    {sc.category === "lost" ? "길헤맴" : sc.category === "stranger" ? "낯선어른" : sc.category === "home" ? "안전대응" : "일상습관"}
                                  </span>
                                </div>
                                <h5 className="text-xs font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                                  {sc.title}
                                </h5>
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 leading-normal font-semibold">
                                  {sc.shortDesc}
                                </p>
                              </div>
                              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-end text-[9px] text-blue-600 font-extrabold group-hover:translate-x-1 transition-transform">
                                <span>무전 연습 시작 ➔</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Micro educational pills as requested by the design HTML */}
                <div className="px-4 pt-2 pb-1 bg-white border-t border-slate-150 flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                  {[
                    { label: "🚧 골목 불법주차 신고", text: "골목길에 자동차가 사람 다니는 길(인도)을 꽉 막고 세워져 있어서 차도로 걸어가야 해요. 부딪칠 것 같아 너무 무서워요!" },
                    { label: "💡 어두운 가로등 고장", text: "우리 집 앞 가로등 불빛이 깜빡거리다가 완전히 꺼져서 밤길이 너무 캄캄하고 길 가기 무서워요. 수리해주세요!" },
                    { label: "🚶 안심 귀가 신청", text: "학원이 늦게 끝났는데 밖이 너무 캄캄해요. 김경찰 삼촌, 안전하게 안심하고 집에 갈 수 있게 무전 동행해주세요!" },
                    { label: "🚔 공원 순찰 강화", text: "놀이터와 동네 공원 구석이 밤에 너무 어둡고 캄캄해서 조금 겁이 나요. 삼촌들이 순찰차로 여기 자주 확인해주세요!" },
                  ].map((pill) => (
                    <button
                      key={pill.label}
                      type="button"
                      onClick={() => {
                        setInputMessage("");
                        handleSendMessage(pill.text);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-full border border-slate-200 whitespace-nowrap transition-all cursor-pointer font-bold shrink-0"
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>

                {/* Main Interactive Controls: Mic / Input Box / Send button */}
                <div className="p-2 sm:p-3 bg-white border-t border-slate-150">
                  <div className="flex items-center gap-2 max-w-4xl mx-auto relative">
                    {/* Microphone Toggle Button */}
                    <button
                      id="mic-toggle-btn"
                      type="button"
                      onClick={toggleListening}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm flex-shrink-0 active:scale-95 cursor-pointer ${
                        isListening
                          ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/60"
                      }`}
                      title={isListening ? "음성 인식 중지" : "경찰 무전 마이크 말하기 시작"}
                    >
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    {/* Chat Text Input Field */}
                    <div className="flex-1 relative">
                      <input
                        id="chat-message-input"
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-4 pr-20 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs sm:text-sm font-bold text-slate-700 placeholder:text-slate-400 transition-all h-12"
                        placeholder="김경찰 삼촌에게 상황을 무전해 보세요... (마이크 터치도 좋아요)"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isAiLoading && inputMessage.trim()) {
                            handleSendMessage();
                          }
                        }}
                        disabled={isAiLoading}
                      />

                      {/* Send Button */}
                      <button
                        id="chat-send-submit"
                        type="button"
                        disabled={!inputMessage.trim() || isAiLoading}
                        onClick={() => handleSendMessage()}
                        className="absolute right-1 top-1 bottom-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white px-5 rounded-lg text-xs font-bold shadow-md shadow-blue-200 transition-all active:scale-95 cursor-pointer disabled:shadow-none"
                        title="삼촌에게 전송"
                      >
                        전송
                      </button>
                    </div>
                  </div>
                </div>

              </main> {/* Close chat-container-card */}
            </div> /* Close app-playground */
          )}
        </AnimatePresence>
      </main>

      {/* --- Parent Protection & TTS Customize Modal --- */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 select-none font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-sky-400" />
                  <span className="font-bold text-xs sm:text-sm">보호자 전용 설정판</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteStep(0);
                    setShowSettingsModal(false);
                  }}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5.5 h-5.5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 overflow-y-auto max-h-[75vh] space-y-4">
                {deleteStep === 0 && (
                  <>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-2">
                      <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-sky-500" />
                        개인정보 안전 가이드
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                        어린이의 안전을 위해 기입된 이름, 대화 통계 등 모든 정보는 서버에 저장되지 않고 <strong>로컬 기기 보안 저장소에만 완전히 비밀리에 저장</strong>됩니다. 브라우저 캐시를 지우면 데이터도 소멸됩니다.
                      </p>
                    </div>

                    {/* TTS Customizer pitch & rate sliders */}
                    <div className="border-t border-slate-100 pt-3.5 space-y-3">
                      <h5 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        🎤 삼촌 목소리 맞춤형 커스텀
                      </h5>

                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black text-slate-600">음성 엔진(TTS) 기능 사용</label>
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                            checked={ttsConfig.enabled}
                            onChange={(e) => setTtsConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                          />
                        </div>

                        {/* Speech Rate Speed */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                            <span>삼촌 말하기 속도</span>
                            <span className="font-extrabold text-sky-600">{ttsConfig.speed}x 속도</span>
                          </div>
                          <input
                            type="range"
                            min="0.6"
                            max="1.4"
                            step="0.05"
                            value={ttsConfig.speed}
                            onChange={(e) => setTtsConfig(p => ({ ...p, speed: parseFloat(e.target.value) }))}
                            className="w-full text-sky-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* Speech Tone Pitch */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                            <span>목소리 톤 높낮이 (낮을수록 저음 경찰 삼촌)</span>
                            <span className="font-extrabold text-indigo-600">{ttsConfig.pitch}x 피치</span>
                          </div>
                          <input
                            type="range"
                            min="0.6"
                            max="1.4"
                            step="0.05"
                            value={ttsConfig.pitch}
                            onChange={(e) => setTtsConfig(p => ({ ...p, pitch: parseFloat(e.target.value) }))}
                            className="w-full text-indigo-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        {/* Select Specific Korean Speech Synthesis Voice */}
                        {availableVoices.length > 0 && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 block">설치된 시스템 목소리 기기 변경</label>
                            <select
                              value={ttsConfig.voiceName}
                              onChange={(e) => setTtsConfig(p => ({ ...p, voiceName: e.target.value }))}
                              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                            >
                              {availableVoices.map((v) => (
                                <option key={v.name} value={v.name}>
                                  {v.name} ({v.lang})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Custom Button Image Upload option */}
                    <div className="border-t border-slate-100 pt-3.5 space-y-2.5">
                      <h5 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-sky-500" />
                        대화방 시작하기 버튼 뒷배경 이미지 바꾸기
                      </h5>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 space-y-2">
                        <p className="text-[10px] text-slate-500 leading-normal font-semibold">
                          처음 화면에 있는 <strong>'안전 공부 시작하기'</strong> 버튼의 뒷배경을 아이가 좋아하는 사진으로 자유롭게 올릴 수 있습니다.
                        </p>
                        
                        <div className="flex items-center gap-3">
                          {customStartBtnImage ? (
                            <div className="relative w-12 h-12 rounded-xl border border-slate-250 overflow-hidden shadow-sm flex-shrink-0">
                              <img src={customStartBtnImage} alt="Custom Background Button" className="w-[100%] h-[100%] object-cover" referrerPolicy="no-referrer" />
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomStartBtnImage(null);
                                  localStorage.removeItem("gim_custom_start_btn_image");
                                }}
                                className="absolute top-0.5 right-0.5 bg-slate-950 text-white rounded-full p-0.5 hover:bg-slate-900 transition-colors"
                                title="이미지 삭제"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-200 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-[9px] font-black flex-shrink-0">
                              기본 단추
                            </div>
                          )}
                          
                          <label className="flex-1">
                            <span className="inline-block bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition-all shadow-xs">
                              📁 내 컴퓨터 사진 등록
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const base64String = reader.result as string;
                                    setCustomStartBtnImage(base64String);
                                    localStorage.setItem("gim_custom_start_btn_image", base64String);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        id="start-deletion-step-one"
                        type="button"
                        onClick={handleStartDelete}
                        className="w-full bg-red-50 hover:bg-red-100/80 border border-red-200 py-3 rounded-2xl text-red-600 text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-4.5 h-4.5 animate-pulse" />
                        아이와의 모든 대화 기억 지우기 (전체 리셋)
                      </button>
                    </div>
                  </>
                )}

                {/* Deletion Step 1: Warning prompt */}
                {deleteStep === 1 && (
                  <div className="space-y-4 text-center">
                    <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xl shadow-inner animate-bounce">
                      ⚠️
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900">경찰 삼촌과의 모든 추억을 지울까요?</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1 font-semibold">
                        데이터를 지우면 보안관 어린이의 소중한 이름, 연습 통계와 이전에 주고받았던 정든 대화 말풍선들이 완전히 소멸되어 복구되지 않습니다.
                      </p>
                    </div>

                    <div className="flex space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setDeleteStep(0)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl text-slate-700 text-xs font-extrabold cursor-pointer"
                      >
                        아니요! 그냥 간직할래요
                      </button>
                      <button
                        id="confirm-delete-step-two"
                        type="button"
                        onClick={() => setDeleteStep(2)}
                        className="flex-1 bg-red-500 hover:bg-red-600 py-2.5 rounded-xl text-white text-xs font-extrabold cursor-pointer"
                      >
                        지우기 다음단계 진행
                      </button>
                    </div>
                  </div>
                )}

                {/* Deletion Step 2: Parent Lock Quiz */}
                {deleteStep === 2 && (
                  <div className="space-y-4">
                    <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200/80 text-[11px] text-amber-800 leading-relaxed font-semibold">
                      <strong className="block font-extrabold">🔒 [보호자용 안전 잠금장치]</strong>
                      우리 아이들이 대화를 실수로 다 지워버리지 않도록 마련된 보호자 퀴즈입니다. 퀴즈를 해결해야만 기억이 초기화됩니다.
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-600">
                        수식의 올바른 답을 기입해주세요: <span className="text-blue-700 font-extrabold text-sm ml-1.5">7 + 5는 무엇일까요?</span>
                      </label>
                      <input
                        type="number"
                        id="parent-answer-input"
                        placeholder="정답 숫자를 입력해 주세요"
                        value={parentQuizAnswer}
                        onChange={(e) => {
                          setParentQuizAnswer(e.target.value);
                          setParentQuizError(false);
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                        onKeyDown={(e) => e.key === "Enter" && handleVerifyParentQuiz()}
                      />
                      {parentQuizError && (
                        <p className="text-[10px] text-red-500 font-black animate-pulse">틀렸습니다! 정답을 다시 천천히 계산해보세요.</p>
                      )}
                    </div>

                    <div className="flex space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteStep(0);
                          setShowSettingsModal(false);
                        }}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl text-slate-700 text-xs font-extrabold cursor-pointer"
                      >
                        지우지 않고 닫기
                      </button>
                      <button
                        id="final-purge-btn"
                        type="button"
                        onClick={handleVerifyParentQuiz}
                        className="flex-1 bg-red-600 hover:bg-red-700 py-2.5 rounded-xl text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer shadow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        영구 삭제 승인
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- 12대 안전수칙판 모음 모달 (새로운 오버레이 창) --- */}
      <AnimatePresence>
        {showSafetyBoardModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 select-none font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-sky-600 to-sky-700 text-white p-4 sm:p-5 flex items-center justify-between shadow-md">
                <div className="flex items-center space-x-3">
                  <div className="bg-sky-500 p-2 rounded-2xl text-white shadow-inner">
                    <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                      🚨 김경찰 삼촌의 12대 안전 수칙 카드 목록 한눈에 보기
                    </h3>
                    <p className="text-[10px] sm:text-xs text-sky-100 mt-0.5 leading-normal font-semibold">
                      우리 멋진 꼬마 보안관들이 길을 가다 위급할 때 당황하지 않고 대처법을 학습할 수 있는 12가지 교실입니다.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSafetyBoardModal(false)}
                  className="bg-sky-500/20 hover:bg-sky-500/50 text-white p-2 rounded-xl transition-colors cursor-pointer"
                  title="수칙 카드 모음 닫기"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Category Tabs Header */}
              <div className="bg-slate-50 border-b border-slate-200/80 px-4 py-2.5 flex flex-wrap gap-1.5 items-center justify-between">
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] sm:text-xs font-black text-slate-500 mr-1">상황 카테고리:</span>
                  {[
                    { id: "all", label: "전체보기" },
                    { id: "lost", label: "📍 길헤맴" },
                    { id: "stranger", label: "🙅 낯선상대" },
                    { id: "home", label: "🏠 집안안전" },
                    { id: "daily", label: "🏫 일상수칙" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`text-[10px] sm:text-xs px-2.5 py-1.5 rounded-xl font-extrabold transition-all border cursor-pointer ${
                        selectedCategory === cat.id
                          ? "bg-slate-800 border-slate-800 text-white shadow"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 font-extrabold hidden md:inline">💡 카드를 누르면 즉시 무전 연습방에 입력됩니다.</span>
              </div>

              {/* Modal Body: Cards Grid */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {SAFETY_SCENARIOS.filter(
                    (s) => selectedCategory === "all" || s.category === selectedCategory
                  ).map((sc) => {
                    let cardBg = "border-sky-100 bg-white hover:border-sky-300";
                    let badgeColor = "bg-sky-50 text-sky-700";
                    let btnColor = "bg-sky-600 hover:bg-sky-700 text-white";
                    
                    if (sc.category === "lost") {
                      cardBg = "border-orange-100 bg-white hover:border-orange-300";
                      badgeColor = "bg-orange-50 text-orange-700";
                      btnColor = "bg-orange-500 hover:bg-orange-600 text-white";
                    } else if (sc.category === "stranger") {
                      cardBg = "border-red-100 bg-white hover:border-red-300";
                      badgeColor = "bg-red-50 text-red-700";
                      btnColor = "bg-red-600 hover:bg-red-700 text-white";
                    } else if (sc.category === "home") {
                      cardBg = "border-amber-100 bg-white hover:border-amber-300";
                      badgeColor = "bg-amber-50 text-amber-700";
                      btnColor = "bg-amber-500 hover:bg-amber-600 text-slate-900";
                    }

                    return (
                      <div
                        key={sc.id}
                        onClick={() => {
                          handleScenarioClick(sc);
                          setShowSafetyBoardModal(false);
                        }}
                        className={`p-4 rounded-2xl border-2 shadow-xs flex flex-col justify-between transition-all cursor-pointer group hover:-translate-y-1 hover:shadow-md ${cardBg}`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-3xl p-1 bg-slate-50 rounded-2xl shadow-inner group-hover:scale-110 transition-transform">
                              {sc.icon}
                            </span>
                            <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-lg font-black ${badgeColor}`}>
                              {sc.category === "lost" ? "길 잃음" : sc.category === "stranger" ? "낯선 상대" : sc.category === "home" ? "가정 안전" : "일상 수칙"}
                            </span>
                          </div>
                          
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 group-hover:text-sky-700 transition-colors">
                            {sc.title}
                          </h4>
                          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 leading-snug font-semibold">
                            {sc.shortDesc}
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-slate-400 mt-2 p-2 bg-slate-50 rounded-xl italic border border-slate-100 line-clamp-2 font-medium">
                            "{sc.prompt}"
                          </p>
                        </div>

                        <div className="mt-4">
                          <button
                            type="button"
                            className={`w-full py-2 rounded-xl text-[11px] font-black transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer ${btnColor}`}
                          >
                            <span>👮 무전 대화방 전송</span>
                            <span className="group-hover:translate-x-1 transition-transform">➔</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-white border-t border-slate-150 p-3 sm:p-4 flex justify-end">
                <button
                  onClick={() => setShowSafetyBoardModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  창 닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Responsive Footer --- */}
      <footer className="bg-slate-900 border-t border-slate-800 text-[9px] sm:text-[11px] text-slate-400 py-3.5 px-4 text-center">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1.5 leading-tight">
          <p>© 2026 우리동네 챗봇 - 김경찰 (어린이 안전교육 AI 수호대)</p>
          <p className="flex items-center gap-1 text-slate-500 font-semibold">
            <Info className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
            마이크 수신이나 Speech 합성 API 사용이 잠기면 우측 맨 위 자물쇠 옆 '새 창(새 탭)에서 보기' 버튼을 이용하세요!
          </p>
        </div>
      </footer>
    </div>
  );
}
