export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string | Date;
}

export interface UserProfile {
  name: string;
  gender: "boy" | "girl" | "none";
  avatarColor: string;
  streakCount: number;
  solvedCount: number;
}

export interface TTSConfig {
  enabled: boolean;
  voiceName: string;
  speed: number;
  pitch: number;
}

export interface SafetyScenario {
  id: string;
  category: "lost" | "stranger" | "home" | "daily";
  title: string;
  shortDesc: string;
  icon: string;
  prompt: string;
}
