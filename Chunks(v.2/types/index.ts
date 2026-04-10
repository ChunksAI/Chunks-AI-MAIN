// ─── Navigation ──────────────────────────────────────────────────────────────

export type NavItem = {
  id: string;
  label: string;
  icon: string; // SVG path data or component key
  badge?: { text: string; variant: 'ai' | 'pro' };
};

export type RecentItem = {
  id: string;
  title: string;
  color: string;
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export type TabId = 'chat' | 'workspace' | 'reviewer' | 'notes';

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type MessageRole = 'ai' | 'user';

export type PerformanceBar = {
  label: string;
  pct: number;
  color: string;
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  memoryRecall?: string;
  performanceBars?: PerformanceBar[];
  actions?: { label: string; actionKey: string }[];
};

// ─── Workspace ────────────────────────────────────────────────────────────────

export type CardType = 'flashcards' | 'quiz' | 'summary' | 'mindmap';

export type WorkspaceCard = {
  id: string;
  type: CardType;
  title: string;
  meta: string;
  stats?: { label: string; danger?: boolean }[];
};

export type WorkspaceSection = {
  title: string;
  cards: WorkspaceCard[];
};

// ─── Reviewer ─────────────────────────────────────────────────────────────────

export type TopicChip = {
  label: string;
  variant: 'success' | 'danger' | 'warning' | 'info';
};

export type WeakTopic = {
  icon: string;
  name: string;
  score: string;
  pct: number;
  iconBg: string;
};
