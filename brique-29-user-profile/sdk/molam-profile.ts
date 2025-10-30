// brique-29-user-profile/sdk/molam-profile.ts
// Universal Profile SDK for Web, Mobile, Desktop, HarmonyOS

import axios, { AxiosInstance } from 'axios';

// =====================================================
// TYPES
// =====================================================

export type Language = 'fr' | 'en' | 'wo' | 'ar' | 'es';
export type Currency = 'XOF' | 'USD' | 'EUR' | 'GNF' | 'CHF' | string;
export type VisibilityLevel = 'public' | 'contacts' | 'private';
export type MediaType = 'avatar' | 'banner' | 'attachment';

export interface UserProfile {
  profile_id: string;
  user_id: string;
  display_name?: string;
  bio?: string;
  country_code?: string;
  city?: string;
  avatar_url?: string;
  banner_url?: string;
  avatar_asset_id?: string;
  banner_asset_id?: string;
  preferred_language: Language;
  preferred_currency: Currency;
  visibility_level: VisibilityLevel;
  badge_count: number;
  activity_count: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileDTO {
  display_name?: string;
  bio?: string;
  country_code?: string;
  city?: string;
  preferred_language?: Language;
  preferred_currency?: Currency;
  visibility_level?: VisibilityLevel;
}

export interface Badge {
  badge_id: string;
  badge_key: string;
  badge_name: string;
  description?: string;
  icon_url?: string;
  color?: string;
  assigned_at: string;
}

export interface Activity {
  activity_id: string;
  activity_type: string;
  activity_title: string;
  activity_subtitle?: string;
  subsidiary_id?: string;
  created_at: string;
}

export interface PrivacySettings {
  privacy_id: string;
  user_id: string;
  visibility_display_name: VisibilityLevel;
  visibility_bio: VisibilityLevel;
  visibility_location: VisibilityLevel;
  visibility_avatar: VisibilityLevel;
  visibility_banner: VisibilityLevel;
  visibility_badges: VisibilityLevel;
  visibility_activity: VisibilityLevel;
  allow_activity_tracking: boolean;
  allow_profile_indexing: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdatePrivacyDTO {
  visibility_display_name?: VisibilityLevel;
  visibility_bio?: VisibilityLevel;
  visibility_location?: VisibilityLevel;
  visibility_avatar?: VisibilityLevel;
  visibility_banner?: VisibilityLevel;
  visibility_badges?: VisibilityLevel;
  visibility_activity?: VisibilityLevel;
  allow_activity_tracking?: boolean;
  allow_profile_indexing?: boolean;
}

export interface MediaAsset {
  asset_id: string;
  user_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  media_type: MediaType;
  processing_status: string;
  moderation_status: string;
  signed_url?: string;
  signed_url_expires_at?: string;
  created_at: string;
}

export interface UploadMediaOptions {
  file: File | Blob;
  mediaType: MediaType;
  onProgress?: (progress: number) => void;
}

export interface MolamProfileConfig {
  apiBaseUrl: string;
  authToken?: string;
  onAuthError?: () => void;
}

// =====================================================
// MOLAM PROFILE SDK
// =====================================================

export class MolamProfile {
  private apiBaseUrl: string;
  private authToken?: string;
  private onAuthError?: () => void;
  private client: AxiosInstance;

  constructor(config: MolamProfileConfig) {
    this.apiBaseUrl = config.apiBaseUrl;
    this.authToken = config.authToken;
    this.onAuthError = config.onAuthError;

    this.client = axios.create({
      baseURL: this.apiBaseUrl,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (this.authToken) {
        config.headers.Authorization = `Bearer ${this.authToken}`;
      }
      return config;
    });

    // Response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && this.onAuthError) {
          this.onAuthError();
        }
        return Promise.reject(error);
      }
    );
  }

  // =====================================================
  // AUTHENTICATION
  // =====================================================

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  clearAuthToken(): void {
    this.authToken = undefined;
  }

  // =====================================================
  // PROFILE OPERATIONS
  // =====================================================

  async getProfile(userId: string): Promise<UserProfile> {
    const response = await this.client.get(`/api/profile/${userId}`);
    return response.data;
  }

  async getMyProfile(): Promise<UserProfile> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    // Extract userId from token or use a separate endpoint
    // For simplicity, we'll use a dedicated endpoint
    const response = await this.client.get('/api/profile/me');
    return response.data;
  }

  async updateProfile(dto: UpdateProfileDTO): Promise<UserProfile> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.client.put('/api/profile', dto);
    return response.data;
  }

  async exportData(): Promise<any> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.client.get('/api/profile/export');
    return response.data;
  }

  // =====================================================
  // MEDIA OPERATIONS
  // =====================================================

  async uploadMedia(options: UploadMediaOptions): Promise<MediaAsset> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const formData = new FormData();
    formData.append('file', options.file);
    formData.append('media_type', options.mediaType);

    const response = await this.client.post('/api/profile/media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (options.onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(progress);
        }
      }
    });

    return response.data.asset;
  }

  async getSignedMediaUrl(assetId: string, expiresIn: number = 3600): Promise<string> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.client.get(`/api/profile/media/${assetId}/signed-url`, {
      params: { expires_in: expiresIn }
    });

    return response.data.signed_url;
  }

  async deleteMedia(assetId: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    await this.client.delete(`/api/profile/media/${assetId}`);
  }

  /**
   * Upload avatar and update profile
   */
  async uploadAvatar(file: File | Blob, onProgress?: (progress: number) => void): Promise<MediaAsset> {
    const asset = await this.uploadMedia({
      file,
      mediaType: 'avatar',
      onProgress
    });

    return asset;
  }

  /**
   * Upload banner and update profile
   */
  async uploadBanner(file: File | Blob, onProgress?: (progress: number) => void): Promise<MediaAsset> {
    const asset = await this.uploadMedia({
      file,
      mediaType: 'banner',
      onProgress
    });

    return asset;
  }

  // =====================================================
  // BADGE OPERATIONS
  // =====================================================

  async getUserBadges(userId: string): Promise<Badge[]> {
    const response = await this.client.get(`/api/profile/${userId}/badges`);
    return response.data.badges;
  }

  async getMyBadges(): Promise<Badge[]> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    // Extract userId from token or use a dedicated endpoint
    const response = await this.client.get('/api/profile/me/badges');
    return response.data.badges;
  }

  // =====================================================
  // ACTIVITY OPERATIONS
  // =====================================================

  async getUserActivity(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ activities: Activity[]; pagination: any }> {
    const response = await this.client.get(`/api/profile/${userId}/activity`, {
      params: {
        limit: options?.limit || 20,
        offset: options?.offset || 0
      }
    });

    return response.data;
  }

  async getMyActivity(options?: { limit?: number; offset?: number }): Promise<{ activities: Activity[]; pagination: any }> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.client.get('/api/profile/me/activity', {
      params: {
        limit: options?.limit || 20,
        offset: options?.offset || 0
      }
    });

    return response.data;
  }

  async deleteActivity(activityId: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    await this.client.delete(`/api/profile/activity/${activityId}`);
  }

  // =====================================================
  // PRIVACY OPERATIONS
  // =====================================================

  async getPrivacySettings(): Promise<PrivacySettings> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.client.get('/api/profile/privacy');
    return response.data;
  }

  async updatePrivacySettings(dto: UpdatePrivacyDTO): Promise<PrivacySettings> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.client.put('/api/profile/privacy', dto);
    return response.data;
  }

  // =====================================================
  // ADMIN OPERATIONS (requires appropriate role)
  // =====================================================

  async assignBadge(userId: string, badgeId: string, reason?: string): Promise<{ user_badge_id: string }> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.client.post('/api/admin/profile/badges/assign', {
      user_id: userId,
      badge_id: badgeId,
      reason
    });

    return response.data;
  }

  async revokeBadge(userBadgeId: string, reason?: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    await this.client.post('/api/admin/profile/badges/revoke', {
      user_badge_id: userBadgeId,
      reason
    });
  }

  async getBadgeStatistics(): Promise<any[]> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.client.get('/api/admin/profile/badges/statistics');
    return response.data.statistics;
  }

  async moderateMedia(assetId: string, status: 'approved' | 'rejected', reason?: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    await this.client.post(`/api/admin/profile/media/${assetId}/moderate`, {
      status,
      reason
    });
  }

  async getProfileStatistics(): Promise<any> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    const response = await this.client.get('/api/admin/profile/statistics');
    return response.data;
  }

  async deleteUserProfile(userId: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('Authentication required');
    }

    await this.client.delete(`/api/admin/profile/${userId}`);
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File, maxSizeMB: number = 10): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
    };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit.`
    };
  }

  return { valid: true };
}

/**
 * Get badge color CSS class
 */
export function getBadgeColorClass(color?: string): string {
  const colorMap: Record<string, string> = {
    '#10B981': 'bg-emerald-500',
    '#3B82F6': 'bg-blue-500',
    '#F97316': 'bg-orange-500',
    '#A855F7': 'bg-purple-500',
    '#EAB308': 'bg-yellow-500',
    '#EC4899': 'bg-pink-500'
  };

  return color ? colorMap[color] || 'bg-gray-500' : 'bg-gray-500';
}

/**
 * Format activity time (relative)
 */
export function formatActivityTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

// =====================================================
// EXAMPLE USAGE
// =====================================================

/*
// Initialize SDK
const profile = new MolamProfile({
  apiBaseUrl: 'http://localhost:3000',
  authToken: 'your-jwt-token',
  onAuthError: () => {
    console.log('Auth error, redirect to login');
  }
});

// Get user profile
const userProfile = await profile.getProfile('user-id-123');
console.log(userProfile.display_name);

// Update profile
await profile.updateProfile({
  display_name: 'John Doe',
  bio: 'Software engineer from Dakar',
  preferred_language: 'fr'
});

// Upload avatar
const file = document.querySelector('input[type="file"]').files[0];
const validation = validateImageFile(file);

if (validation.valid) {
  const asset = await profile.uploadAvatar(file, (progress) => {
    console.log(`Upload progress: ${progress}%`);
  });
  console.log('Avatar uploaded:', asset.asset_id);
}

// Get user badges
const badges = await profile.getUserBadges('user-id-123');
badges.forEach((badge) => {
  console.log(`${badge.badge_name}: ${badge.description}`);
});

// Update privacy settings
await profile.updatePrivacySettings({
  visibility_display_name: 'public',
  visibility_bio: 'contacts',
  visibility_activity: 'private'
});

// Export data (GDPR)
const data = await profile.exportData();
console.log('Exported data:', data);
*/
