// ============================================================
// KumbhMitra Database Row Types
// These mirror the PostgreSQL schema exactly.
// ============================================================

export type Language = 'en' | 'hi' | 'mr' | 'gu' | 'te' | 'ta' | 'kn' | 'raj';

// -- users -------------------------------------------------------
export interface UserRow {
  id: string;
  auth_id: string | null;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  language: Language;
  session_token: string | null;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// -- places ------------------------------------------------------
export type PlaceCategory =
  | 'ghat' | 'camp' | 'parking' | 'hospital' | 'medical'
  | 'police' | 'toilet' | 'food' | 'transport'
  | 'temple' | 'landmark' | 'info_center' | 'help_centre' | 'other';

export interface PlaceRow {
  id: string;
  name: string;
  category: PlaceCategory;
  description: string | null;
  address: string | null;
  latitude: string | null;   // NUMERIC comes back as string from pg
  longitude: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// -- emergency_services ------------------------------------------
export type EmergencyCategory =
  | 'police' | 'medical' | 'fire' | 'rescue' | 'helpline' | 'other';

export interface EmergencyServiceRow {
  id: string;
  name: string;
  category: EmergencyCategory;
  phone: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  verified: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// -- lost_found --------------------------------------------------
export type LostFoundType = 'lost' | 'found';
export type LostFoundStatus = 'open' | 'resolved' | 'expired';
export type LostFoundCategory =
  | 'person' | 'child' | 'bag' | 'document'
  | 'phone' | 'wallet' | 'jewellery' | 'clothing'
  | 'vehicle' | 'animal' | 'other';

export interface LostFoundRow {
  id: string;
  user_id: string | null;
  type: LostFoundType;
  title: string;
  description: string | null;
  category: LostFoundCategory;
  location: string;
  latitude: string | null;
  longitude: string | null;
  image_url: string | null;
  status: LostFoundStatus;
  created_at: Date;
  updated_at: Date;
}

// -- crowd_updates -----------------------------------------------
export interface CrowdUpdateRow {
  id: string;
  place_id: string | null;
  density: number;   // 1–5
  message: string;
  language: Language;
  is_active: boolean;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// -- events ------------------------------------------------------
export type EventCategory =
  | 'snan' | 'aarti' | 'procession'
  | 'cultural' | 'administrative' | 'general';

export interface EventRow {
  id: string;
  place_id: string | null;
  title: string;
  description: string | null;
  category: EventCategory;
  language: Language;
  starts_at: Date;
  ends_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// -- announcements -----------------------------------------------
export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'critical';

export interface AnnouncementRow {
  id: string;
  place_id: string | null;
  title: string;
  body: string;
  language: Language;
  priority: AnnouncementPriority;
  active: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// -- schema_migrations -------------------------------------------
export interface SchemaMigrationRow {
  id: number;
  filename: string;
  applied_at: Date;
}
