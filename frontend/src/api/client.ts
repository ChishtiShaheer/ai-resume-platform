import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ---- Types ----
export interface Job {
  id: string;
  title: string;
  description: string;
  department?: string;
  location?: string;
  seniority?: string;
  required_skills: string[];
  preferred_skills: string[];
  min_experience_years: number;
  required_education?: string;
  required_certifications: string[];
  scoring_weights?: Record<string, number> | null;
  status: string;
  created_at: string;
  candidate_count: number;
}

export interface CandidateListItem {
  id: string;
  full_name: string | null;
  email: string | null;
  overall_score: number;
  skill_score: number;
  experience_score: number;
  education_score: number;
  semantic_score: number;
  matched_skills: string[];
  missing_skills: string[];
  total_experience_years: number;
  status: string;
  rank: number | null;
}

export interface CandidateDetail extends CandidateListItem {
  original_filename: string;
  phone: string | null;
  education: Record<string, any>[];
  experience: Record<string, any>[];
  certifications: string[];
  skills: string[];
  summary: string | null;
  score_breakdown: Record<string, any>;
  interview_questions: string[];
  used_ocr: string;
  created_at: string;
}

export interface AnalyticsOverview {
  total_jobs: number;
  open_jobs: number;
  total_candidates: number;
  average_overall_score: number;
  status_breakdown: Record<string, number>;
  score_distribution: Record<string, number>;
  top_missing_skills: { skill: string; count: number }[];
  shortlisted_count: number;
  rejected_count: number;
  failed_count: number;
}
