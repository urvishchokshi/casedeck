// TypeScript mirrors of the database schema (supabase/migrations/).
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

export interface TranscriptTurn {
  speaker: "interviewer" | "candidate";
  text: string;
}

export interface Case {
  id: string;
  casebook_id: string;
  title: string;
  case_types: string[];
  industry: string | null;
  difficulty: DifficultyLevel | null;
  extra_tags: string[];
  tags_inferred: boolean;
  prompt: string | null;
  transcript: TranscriptTurn[];
  /** First printed page of the case; with casebook_id, the import idempotency key. */
  source_start_page: number;
  /** All printed (slide-footer) page numbers the case spans. */
  printed_pages: number[];
  /** Ordered storage paths in the private case-images bucket (e.g. "iim-a/p40.png") — sign at read time. */
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
