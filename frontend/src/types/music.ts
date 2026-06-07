export type Song = {
  id: string;
  title: string;
  description?: string | null;
  file_url: string;
  cover_url: string | null;
  duration_sec: number;
  play_count: number;
  likes_count?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  uploaded_by?: string | null;
  uploadedBy?: string | null;
  uploadedByUser?: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  artist: {
    id: string;
    name: string;
    display_name?: string | null;
    displayName?: string | null;
    bio?: string | null;
    avatar_url: string | null;
    avatarUrl?: string | null;
    user_id?: string | null;
    followers_count?: number;
    is_verified?: boolean;
  };
  album: {
    id: string;
    title: string;
    cover_url: string | null;
    release_date: string | null;
  } | null;
  genre: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type SongWaveform = {
  song_id: string;
  peaks: number[][] | null;
  duration: number | null;
  cached: boolean;
  updated_at?: string | null;
};

export type NotificationType =
  | "LIKE_SONG"
  | "FOLLOW_USER"
  | "UPLOAD_SUCCESS"
  | "NEW_SONG_FROM_FOLLOWING"
  | "PLAYLIST_ADD_SONG"
  | "SYSTEM"
  | "COMMENT_SONG"
  | "REPLY_COMMENT";

export type NotificationEntityType =
  | "song"
  | "user"
  | "artist"
  | "playlist"
  | "system";

export type UserNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: NotificationType;
  entity_type: NotificationEntityType | null;
  entity_id: string | null;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
};

export type LikedSong = Song & {
  like_id: string;
  liked_at: string;
};

export type RecentlyPlayedSong = Song & {
  recently_played_id?: string;
  played_at: string;
};

export type UserPlaylist = {
  id: string;
  user_id: string;
  name: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  custom_cover_url?: string | null;
  is_public: boolean;
  slug?: string | null;
  share_count?: number;
  share_url?: string | null;
  song_count: number;
  track_count: number;
  owner_name: string | null;
  is_owner?: boolean;
  created_at: string;
  updated_at: string;
};

export type PlaylistSong = Song & {
  playlist_song_id: string;
  position: number;
  added_at: string;
};

export type PlaylistDetail = UserPlaylist & {
  owner?: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
  songs: PlaylistSong[];
  tracks?: PlaylistSong[];
};

export type ChartPeriod = "today" | "week" | "month" | "all";

export type ChartTrack = {
  rank: number;
  id: string;
  title: string;
  artistName: string;
  coverUrl: string | null;
  fileUrl: string;
  playCount: number;
  totalPlayCount?: number;
  likeCount: number;
  commentCount: number;
  duration: number;
  createdAt: string;
};

export type TrendingTrack = Omit<ChartTrack, "rank"> & {
  score: number;
};

export type Pagination = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export type SongPagination = Pagination;

export type SearchResultType = "song" | "artist" | "playlist";

export type UniversalSearchItem = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  href: string;
  score?: number;
};

export type SearchHistoryItem = {
  id: string;
  query: string;
  normalizedQuery: string;
  createdAt: string;
};

export type UniversalSearchResponse = {
  query: string;
  normalizedQuery: string;
  topResult: UniversalSearchItem | null;
  songs: UniversalSearchItem[];
  artists: UniversalSearchItem[];
  playlists: UniversalSearchItem[];
  suggestions: string[];
  recentSearches?: SearchHistoryItem[];
  trendingSearches?: string[];
};

export type StudioOverview = {
  totalTracks: number;
  totalPlays: number;
  totalLikes: number;
  totalComments: number;
  followers: number;
  following: number;
};

export type StudioTrackSort = "newest" | "oldest" | "plays" | "likes" | "comments";

export type StudioTrack = {
  id: string;
  title: string;
  coverUrl?: string | null;
  artistName?: string | null;
  playCount: number;
  likeCount: number;
  commentCount: number;
  duration?: number | null;
  createdAt: string;
  isActive?: boolean;
  fileUrl?: string | null;
};

export type StudioActivity = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
};

export type ArtistRecord = {
  id: string;
  name: string;
  display_name?: string | null;
  displayName?: string | null;
  bio: string | null;
  avatar_url: string | null;
  avatarUrl?: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
  followers_count?: number;
  is_verified?: boolean;
};

export type AlbumRecord = {
  id: string;
  title: string;
  artist_id: string;
  cover_url: string | null;
  release_date: string | null;
  created_at: string;
  updated_at: string;
  artist: {
    id: string;
    name: string;
    display_name?: string | null;
    displayName?: string | null;
    bio?: string | null;
    avatar_url: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type GenreRecord = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type AdminUser = {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
  is_verified: boolean;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminUserOption = {
  id: string;
  username: string;
  email: string;
};

export type AdminNotificationTargetType = "all" | "selected";
export type AdminNotificationLogTargetType = AdminNotificationTargetType | "user";

export type AdminNotificationLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  target_type: AdminNotificationLogTargetType;
  target_user_id: string | null;
  target_user_ids: string[];
  target_user_name: string | null;
  target_user_email: string | null;
  target_label: string;
  title: string;
  message: string;
  sent_count: number;
  created_at: string;
};

export type AdminPlaylist = {
  id: string;
  user_id: string;
  title: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_public: boolean;
  track_count: number;
  song_count: number;
  owner_name: string;
  owner_email: string;
  created_at: string;
  updated_at: string;
};

export type AdminTopSong = {
  id: string;
  title: string;
  file_url: string;
  cover_url: string | null;
  duration_sec: number;
  play_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  artist: {
    id: string;
    name: string;
  };
  album: {
    id: string;
    title: string;
  } | null;
  genre: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export type AdminDashboard = {
  total_users: number;
  total_songs: number;
  total_artists: number;
  total_albums: number;
  total_genres: number;
  total_playlists: number;
  total_play_count: number;
  top_songs: AdminTopSong[];
  newest_users: AdminUser[];
};

export type SongWritePayload = {
  title: string;
  artist_id: string;
  album_id?: string | null;
  genre_id?: string | null;
  file_url: string;
  cover_url?: string | null;
  duration_sec: number;
  is_active?: boolean;
};

export type Artist = {
  id: string;
  name: string;
  monthlyListeners: string;
  bio: string;
};

export type Album = {
  id: string;
  title: string;
  artist: string;
  year: string;
  songCount: number;
};

export type Playlist = {
  id: string;
  name: string;
  description: string;
  songCount: number;
};

export type PublicUserProfile = {
  id: string;
  username: string;
  display_name: string;
  displayName?: string;
  bio: string | null;
  avatar_url: string | null;
  avatarUrl?: string | null;
  created_at: string;
  artist_id: string | null;
  artist_name: string | null;
  followers_count: number;
  following_count: number;
  track_count: number;
};

export type FollowedArtist = {
  user_id: string;
  username: string;
  display_name?: string | null;
  displayName?: string | null;
  email: string;
  artist_id: string | null;
  name: string;
  avatar_url: string | null;
  avatarUrl?: string | null;
  bio: string | null;
  followed_at: string;
};

export type SongComment = {
  id: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  isArtist: boolean;
  replies: SongComment[];
};
