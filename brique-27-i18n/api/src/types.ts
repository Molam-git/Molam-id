// api/src/types.ts
// Type definitions for Brique 27 - i18n

export type Language = 'fr' | 'en' | 'wo' | 'ar' | 'es';

export interface Translation {
  id: string;
  key: string;
  lang: Language;
  value: string;
  category?: string;
  platform?: 'all' | 'web' | 'mobile' | 'desktop';
  notes?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface TranslationBundle {
  lang: Language;
  translations: Record<string, string>;
  version: string;
  generated_at: Date;
}

export interface UserLanguagePref {
  user_id: string;
  preferred_lang: Language;
  fallback_lang: Language;
  auto_detect: boolean;
  detected_lang?: Language;
  detection_source?: 'geo' | 'browser' | 'phone' | 'history';
  last_changed_at: Date;
}

export interface TranslationHistory {
  id: string;
  translation_id: string;
  key: string;
  lang: Language;
  old_value?: string;
  new_value: string;
  changed_by: string;
  change_type: 'create' | 'update' | 'delete';
  changed_at: Date;
  ip_address?: string;
  user_agent?: string;
}

export interface TranslationStats {
  lang: Language;
  key: string;
  request_count: number;
  missing_count: number;
  last_requested_at?: Date;
  date: Date;
}

export interface MissingTranslation {
  key: string;
  reference_lang: string;
  reference_value: string;
}

// DTOs
export interface CreateTranslationDTO {
  key: string;
  lang: Language;
  value: string;
  category?: string;
  platform?: 'all' | 'web' | 'mobile' | 'desktop';
  notes?: string;
}

export interface UpdateTranslationDTO {
  value?: string;
  category?: string;
  platform?: 'all' | 'web' | 'mobile' | 'desktop';
  notes?: string;
}

export interface BulkCreateTranslationDTO {
  translations: CreateTranslationDTO[];
}

export interface UpdateUserLanguageDTO {
  preferred_lang?: Language;
  fallback_lang?: Language;
  auto_detect?: boolean;
}

export interface TranslationResponse {
  lang: Language;
  translations: Record<string, string>;
  version?: string;
  count: number;
}

export interface TranslationListResponse {
  translations: Translation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MissingTranslationsResponse {
  lang: Language;
  missing: MissingTranslation[];
  count: number;
  coverage_percent: number;
}
