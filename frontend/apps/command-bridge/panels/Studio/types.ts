
export type WidgetType = 
  | 'GALLERY' 
  | 'STATS' 
  | 'INSPIRE' 
  | 'TEXT'
  | 'MEDIA'
  | 'PROJECTS' 
  | 'ACTIVITY' 
  | 'SIGNAL'   
  | 'HUB_FEED'
  | 'METRICS'
  | 'PROFILE'
  | 'ART_DISPLAY'
  | 'ECOSYSTEM'
  | 'SOCIAL_ACTIVITY';

export type AppView = 'home' | 'chats' | 'profile' | 'community' | 'community-hub' | 'portfolio' | 'ecosystem' | 'profile-editor' | 'studio-space';

export interface UserProfile {
  name: string;
  role: string;
  bio: string;
  manifesto?: string;
  avatar: string;
  location: string;
  timezone: string;
  coverImage?: string;
  axis?: any;
  publicIdentity?: any;
  studio?: any;
}

export interface WidgetData {
  id: string;
  type: WidgetType;
  title: string;
  colSpan: number; // 1 to 4
  rowSpan: number; // 1 to 4
  content?: any;
  settings?: Record<string, any>;
}

export interface DashboardTheme {
  name: string;
  accent: string;
  bgStyle: string; // CSS class for gradient/bg
}

export interface GalleryItem {
  id: string;
  url: string;
  title: string;
  type: 'image' | 'video';
}

export interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  description: string;
  image: string;
  year: string;
  tags: string[];
  stats?: {
      views: number;
      likes: number;
  };
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'other';
  timestamp: string;
  avatar?: string;
}

export interface ChatSession {
  id: string | number;
  title: string;
  image: string;
  members: string;
  messagesCount: string;
  status?: 'active' | 'hidden' | 'deleted';
  axisId?: string;
  lastMessage?: string;
  updatedAt?: number;
  online?: boolean;
  axisSource?: 'axis' | 'studio' | 'local';
  workspaceId?: string;
  unread?: number;
}

export interface IdentityProfile {
  id: string;
  name: string;
  handle?: string;
  avatar: string;
  role?: string;
  tagline?: string;
  status?: 'online' | 'offline' | 'away';
  location?: string;
  group?: string;
  favorite?: boolean;
  isSelf?: boolean;
  source?: 'studio' | 'axis' | 'community' | 'direct';
  recentActivity?: string;
  mutualSpaces?: string[];
  accentColor?: string;
  badge?: string;
  cardStyle?: 'glass' | 'void' | 'signal' | 'warm';
  visibleFields?: {
    handle?: boolean;
    role?: boolean;
    location?: boolean;
    activity?: boolean;
    spaces?: boolean;
  };
}

export interface Community {
  id: string;
  name: string;
  description: string;
  membersCount: number;
  image: string;
  isJoined: boolean;
  category: string;
  tags: string[];
  icon?: string;
  rules?: string;
  links?: string[];
  moderationTone?: string;
  role?: string;
  postsCount?: number;
  latestPostAt?: number;
  meritScore?: number;
  workspaceId?: string;
}

export interface CommunityPost {
  id: string;
  author: {
    name: string;
    avatar: string;
  };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  timestamp: string;
}
