// Core Type Definitions for RedditDIG (Production MV3)

export type Stance = 'support' | 'against' | 'neutral';

export type CommentType =
  | 'experience'
  | 'evidence'
  | 'recommendation'
  | 'counterargument'
  | 'question'
  | 'speculation'
  | 'joke'
  | 'opinion';

export type EvidenceType =
  | 'personal_experience'
  | 'evidence_backed'
  | 'opinion'
  | 'speculation'
  | 'unclear'
  | 'none';

export interface CommentSchema {
  id: string;
  reddit_id: string;
  parent_id: string | null;
  author: string;
  body: string;
  score: number;
  replies_count: number;
  depth: number;
  permalink: string;
  created_utc: number | null;
  created_relative?: string | null;
  timestamp_display: string;
  awards_data_available: boolean;
  awards_count: number | null;
  awards_data: Array<{ name: string; count: number; icon_url?: string }>;
  is_op: boolean;
  has_media?: boolean;
  media_type?: 'gif' | 'image' | 'video' | null;
  media_url?: string | null;
  stance: Stance;
  comment_type: CommentType;
  evidence_type: EvidenceType;
  topics: string[];
  argument: string;
  suggestion?: string | null;
  claims: string[];
  usefulness_score: number;
  support_score: number;
  impact_score: number;
  is_hidden_gem: boolean;
  is_best_supported: boolean;
  is_most_popular: boolean;
  is_most_rewarded?: boolean;
  is_disputed: boolean;
  ai_confidence: number;
}

export interface CitationItem {
  text: string;
  comment_ids: string[];
}

export interface SummaryResponse {
  overview: string;
  key_takeaways: CitationItem[];
  what_agree_on: CitationItem[];
  what_disagree_on: CitationItem[];
  unresolved_questions: CitationItem[];
  is_ai_generated: boolean;
  ai_error: string | null;
  model_name?: string;
}

export interface ViewpointItem {
  label: string;
  comments_count: number;
  unique_users: number;
  user_share: number;
  comment_share: number;
  is_majority: boolean;
  is_plurality: boolean;
  median_score: number;
  avg_score: number;
  score_support_signal: string;
  representative_comments: CommentSchema[];
  strongest_supporting_arg?: string | null;
  strongest_opposing_arg?: string | null;
}

export interface ConsensusResponse {
  label: string;
  score: number;
  rationale: string;
  is_true_majority: boolean;
}

export interface MainArgumentItem {
  topic: string;
  mentions_count: number;
  percentage: number;
  sample_comment_ids: string[];
}

export interface ContradictionItem {
  topic: string;
  claim_a: string;
  claim_b: string;
  support_a_count: number;
  support_b_count: number;
  sample_a_ids: string[];
  sample_b_ids: string[];
  is_direct_contradiction: boolean;
}

export interface ContradictionResponse {
  items: ContradictionItem[];
  is_ai_generated: boolean;
  ai_error: string | null;
}

export interface QuestionResolutionResponse {
  status: 'Resolved' | 'Likely resolved' | 'Partially resolved' | 'Unresolved';
  reason: string;
  confidence: number;
  major_answers: Array<{ author: string; score: number; summary: string; comment_id: string }>;
  op_acknowledged: boolean;
}

export interface OPInteractionResponse {
  op_username: string;
  comments_made: number;
  replies_received: number;
  topics_followed: string[];
  acknowledged_comments: Array<{ author: string; score: number; comment_id: string; snippet: string }>;
}

export interface TemperatureResponse {
  label: string;
  score: number;
  hostility_score: number;
  disagreement_density: number;
  explanation: string;
}

export interface VerticalInsightsResponse {
  category: string;
  is_specialized: boolean;
  confidence: number;
  recommendations: Array<{ text: string; score: number; comment_id: string }>;
  pros: Array<{ text: string; score: number; comment_id: string }>;
  cons: Array<{ text: string; score: number; comment_id: string }>;
  alternatives: Array<{ text: string; score: number; comment_id: string }>;
  domain_specific_data: Record<string, any>;
}

export interface DebateMapNode {
  id: string;
  label: string;
  count: number;
  sentiment: string;
  comment_ids: string[];
  children: DebateMapNode[];
}

export interface CommentRankingsResponse {
  most_popular: CommentSchema | null;
  most_rewarded: CommentSchema | null;
  most_rewarded_reason?: string;
  reward_data_available: boolean;
  best_supported: CommentSchema | null;
  best_supported_reason: string;
  hidden_gem: CommentSchema | null;
  hidden_gem_reason: string;
  questionable_suggestion: CommentSchema | null;
  questionable_reason: string;
  most_discussed: CommentSchema | null;
}

export interface CoverageInfo {
  expected_comments: number | null;
  extracted_comments: number;
  analyzed_comments: number;
  collapsed_comments: number;
  removed_or_deleted_comments: number;
  unavailable_comments: number;
  coverage_percentage: number;
  status: 'complete' | 'partial' | 'unknown';
  explanation: string;
}

export interface HealthDashboardResponse {
  comments_analyzed: number;
  distinct_participants: number;
  major_viewpoints_count: number;
  consensus_label: string;
  unresolved_questions_count: number;
  conflicting_claims_count: number;
  useful_comments_count: number;
  coverage_percentage: number;
  total_reported_comments: number | null;
  comments_unavailable: number;
  expansion_attempts: number;
  coverage?: CoverageInfo;
}

export interface ThreadIntelligenceEnvelope {
  thread_id: string;
  title: string;
  author: string;
  subreddit: string;
  url: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  status: string;
  progress: number;
  step: string;
  total_analyzed: number;
  unique_participants: number;
  is_truncated: boolean;
  created_utc: number | null;
  created_relative?: string | null;
  timestamp_display: string;
  vertical_category: string;
  summary: SummaryResponse;
  consensus: ConsensusResponse;
  viewpoints: ViewpointItem[];
  main_arguments: MainArgumentItem[];
  rankings: CommentRankingsResponse;
  health: HealthDashboardResponse;
  coverage?: CoverageInfo;
  contradictions: ContradictionItem[];
  contradictions_meta?: ContradictionResponse;
  question_resolution: QuestionResolutionResponse;
  op_interaction: OPInteractionResponse;
  temperature: TemperatureResponse;
  vertical_insights: VerticalInsightsResponse;
  argument_journey: Array<{
    comment_id: string;
    author: string;
    depth: number;
    score: number;
    stance: string;
    comment_type: string;
    snippet: string;
    permalink?: string;
  }>;
  debate_map?: DebateMapNode | null;
  comments?: CommentSchema[];
}

export interface SearchRequest {
  query?: string;
  mode?: 'exact' | 'fuzzy' | 'similarity' | 'hybrid';
  username?: string;
  min_score?: number;
  min_replies?: number;
  stance?: string;
  comment_type?: string;
  evidence_type?: string;
  topic?: string;
  top_level_only?: boolean;
  sort_by?: 'relevance' | 'score' | 'date' | 'replies';
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  total_matches: number;
  unique_users: number;
  query_mode: string;
  ranking_explanation: string;
  results: CommentSchema[];
}

export interface AskResponse {
  answer: string;
  confidence: number;
  has_sufficient_info: boolean;
  cited_comments: CommentSchema[];
  is_ai_generated: boolean;
  ai_error: string | null;
}

export interface ParticipantItem {
  username: string;
  comments_count: number;
  total_score: number;
  replies_count: number;
  is_op: boolean;
  highest_scoring_comment: CommentSchema | null;
  stances_taken: string[];
}
