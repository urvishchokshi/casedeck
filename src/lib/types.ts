// TypeScript mirrors of the database schema (supabase/migrations/0001_init.sql).
// Single source of truth for row shapes across the app.

export type DifficultyLevel = "Easy" | "Medium" | "Hard";
export type PartnerStatus = "available" | "busy";
export type ModePref = "online" | "offline" | "both";
export type CampusType = "Hyderabad" | "Mohali";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  campus: CampusType | null;
  is_admin: boolean;
  created_at: string;
}

export interface Casebook {
  id: string;
  slug: string;
  name: string;
  college: string | null;
  pdf_url: string | null;
  created_at: string;
}

export interface TranscriptSection {
  heading: string;
  content: string;
}

export interface Case {
  id: string;
  casebook_id: string;
  source_file: string;
  title: string;
  industry: string;
  case_type: string;
  difficulty: DifficultyLevel;
  transcript: TranscriptSection[];
  solution_image_urls: string[];
  exhibit_image_urls: string[];
  avg_rating: number | null;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserCaseProgress {
  id: string;
  user_id: string;
  case_id: string;
  completed: boolean;
  marked_for_later: boolean;
  self_score: number | null;
  quality_rating: number | null;
  completed_at: string | null;
  updated_at: string;
}

export interface MatchProfile {
  user_id: string;
  whatsapp_number: string;
  workex_function: string;
  workex_industry: string;
  campus: CampusType;
  mode_preference: ModePref;
  status: PartnerStatus;
  updated_at: string;
}
