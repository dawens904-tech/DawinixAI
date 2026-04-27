export type CommandType = "/ai" | "/code" | "/image" | "/help" | "/start" | "text";
export type MessageRole = "user" | "bot";
export type UserStatus = "active" | "idle" | "blocked";
export type BotStatus = "online" | "offline" | "degraded";
export type Language = "en" | "fr" | "ht";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  command?: CommandType;
  imageUrl?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  userName: string;
  phone: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: Date;
  messageCount: number;
  language: Language;
  messages: ChatMessage[];
  isOnline: boolean;
  commandsUsed: CommandType[];
}

export interface WhatsAppUser {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  status: UserStatus;
  firstSeen: Date;
  lastSeen: Date;
  totalMessages: number;
  commandsUsed: number;
  language: Language;
  rateLimit: number; // messages remaining in window
  memoryEnabled: boolean;
}

export interface StatCard {
  label: string;
  value: string | number;
  change: string;
  positive: boolean;
  icon: string;
}

export interface ActivityLog {
  id: string;
  type: "message" | "command" | "error" | "webhook" | "config";
  message: string;
  timestamp: Date;
  severity: "info" | "success" | "warning" | "error";
}

export interface BotConfig {
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken: string;
  webhookUrl: string;
  aiModel: string;
  imageModel: string;
  maxContextMessages: number;
  rateLimit: number;
  enabledCommands: CommandType[];
  supportedLanguages: Language[];
  systemPrompt: string;
  botName: string;
  fallbackMessage: string;
}

export interface AnalyticsData {
  date: string;
  messages: number;
  aiCommands: number;
  codeCommands: number;
  imageCommands: number;
  activeUsers: number;
}
