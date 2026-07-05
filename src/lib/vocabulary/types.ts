import type { LandmarkSample } from "@/lib/database/schema";

export interface PersonalSign {
  id: string;
  word: string;
  phrase?: string;
  category?: string;
  description?: string;
  notes?: string;
  samples: LandmarkSample[];
  recognitions: number;
  lastConfidence: number;
  createdAt: number;
  updatedAt: number;
}

export interface PersonalVocabularyExport {
  version: 1;
  exportedAt: number;
  signs: PersonalSign[];
}
