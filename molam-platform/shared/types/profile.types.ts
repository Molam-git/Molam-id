export interface UserProfile {
    user_id: string;
    display_name: string;
    bio?: string;
    country_code?: string;
    city?: string;
    avatar_key?: string;
    banner_key?: string;
}

export interface PrivacySettings {
    show_badges: boolean;
    show_activity: boolean;
    show_country: boolean;
    show_display_name: boolean;
}

export interface UserBadge {
    code: string;
    name: string;
    icon_key?: string;
    valid_from: string;
    valid_to?: string;
}