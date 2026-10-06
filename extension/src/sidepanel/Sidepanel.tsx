import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '../components/common/Header';
import { Tabs, TabType, panelId, tabId } from '../components/common/Tabs';
import { ThreadSummaryCard } from '../components/insights/ThreadSummaryCard';
import { MajorityOpinionCard } from '../components/insights/MajorityOpinionCard';
import { CommentRankings } from '../components/insights/CommentRankings';
import { ContradictionDetector } from '../components/insights/ContradictionDetector';
import { ThreadHealthCard } from '../components/insights/ThreadHealthCard';
import { VerticalIntelligenceCard } from '../components/insights/VerticalIntelligenceCard';
import { SearchBar } from '../components/search/SearchBar';
import { FilterDrawer } from '../components/search/FilterDrawer';
import { AskThreadPanel } from '../components/search/AskThreadPanel';
import { ParticipantAnalytics } from '../components/people/ParticipantAnalytics';
import { ThreadInsights } from '../components/thread/ThreadInsights';
import { CommentCard } from '../components/common/CommentCard';
import { SettingsModal } from '../components/common/SettingsModal';

import {
  ThreadIntelligenceEnvelope,
  SearchRequest,
  SearchResponse,
  ParticipantItem,
  CommentSchema
} from '../types';
import { isRedditUrl } from '../services/reddit';
import { StorageService, AppSettings } from '../services/storage';
import { DiscussionAnalyzer } from '../services/analyzer';
import { ClientSearchEngine } from '../services/search';
import { ExtractionResult } from '../content/adapter';
import { Play, AlertCircle, Thermometer, HelpCircle, X } from 'lucide-react';
import { MainLogo } from '../components/common/MainLogo';

function getVibeColor(score: number): string {
  if (score < 2.5) return 'var(--positive)';
  if (score < 4.5) return 'var(--royal-blue)';
  if (score < 6.5) return 'var(--warning)';
  return 'var(--negative)';
}

function getShortVibeLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('confrontational') || l.includes('very heated')) return 'Heated+';
  if (l.includes('heated')) return 'Heated';
  if (l.includes('constructive')) return 'Debate';
  return 'Calm';
}

function buildParticipantsFromComments(comments: CommentSchema[], opAuthor: string): ParticipantItem[] {
  const map = new Map<string, { comments: CommentSchema[]; totalScore: number; repliesCount: number }>();
  for (const c of comments) {
    if (!c.author || c.author === '[deleted]' || c.author === 'AutoModerator') continue;
    const entry = map.get(c.author) || { comments: [], totalScore: 0, repliesCount: 0 };
    entry.comments.push(c);
    entry.totalScore += c.score;
    entry.repliesCount += c.replies_count;
    map.set(c.author, entry);
  }
  const result: ParticipantItem[] = [];
  for (const [author, data] of map.entries()) {
    const highest = [...data.comments].sort((a, b) => b.score - a.score)[0] || null;
    const stances = Array.from(new Set(data.comments.map(c => c.stance)));
    result.push({
      username: author,
      comments_count: data.comments.length,
      total_score: data.totalScore,
      replies_count: data.repliesCount,
      is_op: author.toLowerCase() === opAuthor.toLowerCase(),
      highest_scoring_comment: highest,
      stances_taken: stances
    });
  }
  return result.sort((a, b) => b.comments_count - a.comments_count);
}

export const Sidepanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [thread, setThread] = useState<ThreadIntelligenceEnvelope | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusStep, setStatusStep] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showVibeModal, setShowVibeModal] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Search state
  const [searchReq, setSearchReq] = useState<SearchRequest>({
    query: '', mode: 'hybrid', sort_by: 'relevance', limit: 30
  });
  const [searchRes, setSearchRes] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState<boolean>(false);

  // People state
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);

  // Race condition guardrails
  const currentAnalysisIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleCancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    currentAnalysisIdRef.current = null;
    setIsLoading(false);
    setStatusStep('Cancelled.');
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'CANCEL_EXTRACTION' }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, []);

  const handleAnalyze = useCallback(async (forceRefresh: boolean = false) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const analysisId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    currentAnalysisIdRef.current = analysisId;

    setIsLoading(true);
    setErrorMessage(null);
    setProgress(10);
    setStatusStep('Reading discussion...');

    try {
      const currentSettings = await StorageService.getSettings();
      setSettings(currentSettings);

      if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
        throw new Error('RedditDIG requires Google Chrome. Open a Reddit thread and try again.');
      }

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url || !isRedditUrl(tab.url)) {
        setIsLoading(false);
        setErrorMessage('Please open a Reddit discussion post first before reading.');
        return;
      }

      if (abortController.signal.aborted || currentAnalysisIdRef.current !== analysisId) return;

      setActiveUrl(tab.url);
      setStatusStep('Reading comments from post...');
      setProgress(25);

      const progressListener = (msg: any) => {
        if (msg.action === 'EXTRACTION_PROGRESS' && currentAnalysisIdRef.current === analysisId) {
          setStatusStep(msg.step);
          const base = 25;
          const range = 25;
          const maxExpected = Math.min(currentSettings.maxComments || 1000, msg.totalReported || 1000);
          const fraction = Math.min(1, msg.loadedComments / (maxExpected > 0 ? maxExpected : 1));
          setProgress(Math.floor(base + (range * fraction)));
        }
      };
      chrome.runtime.onMessage.addListener(progressListener);

      let extractionResponse: any = null;
      try {
        extractionResponse = await chrome.tabs.sendMessage(tab.id, {
          action: 'EXTRACT_THREAD_DATA',
          maxComments: currentSettings.maxComments || 1000
        });
      } catch (msgErr) {
        try {
          if (chrome.scripting && chrome.scripting.executeScript) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            await new Promise(r => setTimeout(r, 250));
            extractionResponse = await chrome.tabs.sendMessage(tab.id, {
              action: 'EXTRACT_THREAD_DATA',
              maxComments: currentSettings.maxComments || 1000
            });
          }
        } catch (injectErr) {
          throw new Error('Could not read the Reddit page. Please refresh the Reddit tab and click Read.');
        }
      } finally {
        chrome.runtime.onMessage.removeListener(progressListener);
      }

      if (abortController.signal.aborted || currentAnalysisIdRef.current !== analysisId) return;

      if (!extractionResponse || !extractionResponse.success || !extractionResponse.data) {
        throw new Error(extractionResponse?.error || 'Failed to read thread comments.');
      }

      const extraction: ExtractionResult = extractionResponse.data;
      if (!extraction.comments || extraction.comments.length === 0) {
        throw new Error('No comments found on this post. Open a post that has comments.');
      }

      setStatusStep(`Reading ${extraction.comments.length} comments...`);
      setProgress(50);

      const envelope = await DiscussionAnalyzer.analyzeThread(extraction, (step, pct) => {
        if (currentAnalysisIdRef.current === analysisId) {
          setStatusStep(step);
          setProgress(pct);
        }
      });

      if (abortController.signal.aborted || currentAnalysisIdRef.current !== analysisId) return;

      setThread(envelope);
      if (envelope.comments) {
        setParticipants(buildParticipantsFromComments(envelope.comments, envelope.author));
      }
      setIsLoading(false);
      setProgress(100);
    } catch (err: any) {
      if (currentAnalysisIdRef.current === analysisId) {
        setIsLoading(false);
        setErrorMessage(err.message || 'Could not analyze post.');
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      const s = await StorageService.getSettings();
      if (!mounted) return;
      setSettings(s);

      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (mounted && tab?.url) {
            setActiveUrl(tab.url);
            if (s.autoAnalysis && isRedditUrl(tab.url)) {
              handleAnalyze(false);
            }
          }
        } catch (e) {
          console.warn('Error querying active tab:', e);
        }
      }
    }
    init();

    const onActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.get) {
        chrome.tabs.get(activeInfo.tabId).then((tab) => {
          if (mounted && tab?.url) {
            setActiveUrl(tab.url);
          }
        }).catch(() => {});
      }
    };

    const onUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (changeInfo.url && tab.active && mounted) {
        setActiveUrl(changeInfo.url);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
      chrome.tabs.onActivated.addListener(onActivated);
    }
    if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
      chrome.tabs.onUpdated.addListener(onUpdated);
    }

    return () => {
      mounted = false;
      if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
        chrome.tabs.onActivated.removeListener(onActivated);
      }
      if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
        chrome.tabs.onUpdated.removeListener(onUpdated);
      }
    };
  }, [handleAnalyze]);

  // Keyboard shortcut for closing Vibe explanation modal
  useEffect(() => {
    if (!showVibeModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowVibeModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showVibeModal]);

  const handleSearch = (overrideReq?: SearchRequest) => {
    if (!thread || !thread.comments) return;
    const req = overrideReq || searchReq;
    setIsSearching(true);
    try {
      setSearchRes(ClientSearchEngine.search(thread.comments, req));
    } catch (e: any) {
      console.error('Search failed:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResetFilters = () => {
    const reset: SearchRequest = {
      query: searchReq.query,
      mode: searchReq.mode,
      sort_by: 'relevance',
      limit: 30
    };
    setSearchReq(reset);
    handleSearch(reset);
  };

  const handleClearSession = () => {
    setThread(null);
    setSearchRes(null);
    setParticipants([]);
    setErrorMessage(null);
    setStatusStep('');
    setProgress(0);
  };

  const canAnalyzeCurrentTab = isRedditUrl(activeUrl);

  const hasActiveFilters = Boolean(
    searchReq.username || searchReq.min_score !== undefined ||
    searchReq.min_replies !== undefined || searchReq.stance ||
    searchReq.comment_type || searchReq.evidence_type || searchReq.top_level_only
  );

  return (
    <div className="rdg-app">
      <Header
        thread={thread}
        isLoading={isLoading}
        statusStep={statusStep}
        progress={progress}
        onAnalyze={handleAnalyze}
        onCancel={handleCancelAnalysis}
        onOpenSettings={() => setShowSettings(true)}
        activeUrl={activeUrl}
        canAnalyze={canAnalyzeCurrentTab}
      />

      {thread && <Tabs activeTab={activeTab} onChange={setActiveTab} />}

      <main className="rdg-main">
        {/* Error notification */}
        {errorMessage && (
          <div className="rdg-error" role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            <div><strong>Notice:</strong> {errorMessage}</div>
          </div>
        )}

        {/* Empty state */}
        {!thread && !isLoading && (
          <div className="rdg-empty" style={{ flex: 1 }}>
            <div className="rdg-empty-icon" style={{ background: 'transparent', border: 'none', width: 'auto', height: 'auto', marginBottom: 12 }}>
              <MainLogo size={52} />
            </div>
            <h2>Understand Reddit in Seconds</h2>
            <p>
              Find out what people actually agree on, where they disagree, the most helpful comments, and answers to your questions.
            </p>
            <button
              type="button"
              onClick={() => handleAnalyze(false)}
              disabled={!canAnalyzeCurrentTab}
              className="rdg-btn rdg-btn-primary"
              style={{ width: '100%', maxWidth: 240, padding: '10px 16px' }}
              title={canAnalyzeCurrentTab ? 'Read this post' : 'Navigate to a Reddit discussion in the active tab to start reading'}
            >
              <Play size={13} aria-hidden="true" />
              <span>{canAnalyzeCurrentTab ? 'Read This Post' : 'Open a Reddit Post to Read'}</span>
            </button>
            <span className="rdg-version" style={{ marginTop: 4 }}>
              100% Private · Zero Saved Data · 100% Local
            </span>
          </div>
        )}

        {/* Loaded content */}
        {thread && (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'OVERVIEW' && (
              <div
                role="tabpanel"
                id={panelId('OVERVIEW')}
                aria-labelledby={tabId('OVERVIEW')}
                tabIndex={0}
              >
                {/* Quick Stats */}
                <div className="rdg-pulse">
                  <div className="rdg-pulse-cell">
                    <span className="rdg-pulse-value" style={{ color: 'var(--text-primary)' }}>
                      {thread.consensus.label.split(' ')[0]}
                    </span>
                    <span className="rdg-pulse-label">Verdict</span>
                  </div>
                  <div
                    className="rdg-pulse-cell"
                    onClick={() => setShowVibeModal(!showVibeModal)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowVibeModal(!showVibeModal); } }}
                    title={`Discussion Vibe: ${thread.temperature.score}/10 (${thread.temperature.label}) - Emotional tension & heat index. Click to view rating scale guide.`}
                    aria-expanded={showVibeModal}
                    aria-label={`Discussion Vibe score: ${thread.temperature.score} of 10, ${thread.temperature.label}. Click to view rating scale guide.`}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                      <span className="rdg-pulse-value" style={{ color: getVibeColor(thread.temperature.score) }}>
                        {thread.temperature.score}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)' }}>/10</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span className="rdg-pulse-label">
                        Vibe · {getShortVibeLabel(thread.temperature.label)}
                      </span>
                      <HelpCircle size={10} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                    </div>
                  </div>
                  <div className="rdg-pulse-cell">
                    <span className="rdg-pulse-value" style={{ color: 'var(--text-primary)' }}>
                      {thread.viewpoints.length}
                    </span>
                    <span className="rdg-pulse-label">Sides</span>
                  </div>
                </div>

                {/* Interactive Vibe Rating Explanation Guide */}
                {showVibeModal && (
                  <div
                    className="rdg-card"
                    role="region"
                    aria-label="Discussion Vibe Rating Guide"
                    style={{ marginTop: 8, marginBottom: 12, borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
                  >
                    <div className="rdg-card-header" style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                        <Thermometer size={13} style={{ color: getVibeColor(thread.temperature.score) }} aria-hidden="true" />
                        <span>Vibe Rating: {thread.temperature.score}/10 ({thread.temperature.label})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowVibeModal(false)}
                        className="rdg-btn-ghost"
                        style={{ padding: 2 }}
                        aria-label="Close vibe guide"
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="rdg-card-body" style={{ padding: '10px 12px', fontSize: 11.5 }}>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                        <strong>What does the Vibe rating mean?</strong> The Vibe score (0–10) measures the emotional temperature, tension, and hostility level of this discussion based on multi-signal indicators.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--positive)', marginTop: 4, flexShrink: 0 }} aria-hidden="true" />
                          <div>
                            <strong style={{ color: 'var(--positive)' }}>0.0 – 2.4 Calm:</strong>{' '}
                            <span style={{ color: 'var(--text-secondary)' }}>Peaceful, cooperative, and friendly discussion.</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--royal-blue)', marginTop: 4, flexShrink: 0 }} aria-hidden="true" />
                          <div>
                            <strong style={{ color: 'var(--royal-blue)' }}>2.5 – 4.4 Constructive Debate:</strong>{' '}
                            <span style={{ color: 'var(--text-secondary)' }}>Civil differences of opinion supported by reasons or experience.</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', marginTop: 4, flexShrink: 0 }} aria-hidden="true" />
                          <div>
                            <strong style={{ color: 'var(--warning)' }}>4.5 – 6.4 Heated:</strong>{' '}
                            <span style={{ color: 'var(--text-secondary)' }}>Spirited debate with sharp disagreements and polarized stances.</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, lineHeight: 1.4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--negative)', marginTop: 4, flexShrink: 0 }} aria-hidden="true" />
                          <div>
                            <strong style={{ color: 'var(--negative)' }}>6.5 – 10.0 Confrontational:</strong>{' '}
                            <span style={{ color: 'var(--text-secondary)' }}>High conflict, personal disputes, or adversarial language.</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-dim)' }}>
                        <div style={{ display: 'flex', gap: 12, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 4 }}>
                          <span>Disagreements: <strong style={{ color: 'var(--text-primary)' }}>{thread.temperature.disagreement_density}%</strong></span>
                          <span>Heat signals: <strong style={{ color: 'var(--text-primary)' }}>{thread.temperature.hostility_score}%</strong></span>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {thread.temperature.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <ThreadSummaryCard
                  summary={thread.summary}
                  onOpenSettings={() => setShowSettings(true)}
                />

                <VerticalIntelligenceCard vertical={thread.vertical_insights} />

                <ThreadHealthCard health={thread.health} />
              </div>
            )}

            {/* OPINIONS TAB */}
            {activeTab === 'OPINIONS' && (
              <div
                role="tabpanel"
                id={panelId('OPINIONS')}
                aria-labelledby={tabId('OPINIONS')}
                tabIndex={0}
              >
                <MajorityOpinionCard
                  viewpoints={thread.viewpoints}
                  consensus={thread.consensus}
                />
                <CommentRankings rankings={thread.rankings} />
              </div>
            )}

            {/* SEARCH TAB */}
            {activeTab === 'SEARCH' && (
              <div
                role="tabpanel"
                id={panelId('SEARCH')}
                aria-labelledby={tabId('SEARCH')}
                tabIndex={0}
              >
                <AskThreadPanel
                  threadId={thread.thread_id}
                  comments={thread.comments}
                  onOpenSettings={() => setShowSettings(true)}
                />

                <div className="rdg-card">
                  <div className="rdg-card-header">
                    <h3>Search Comments</h3>
                    {searchRes && (
                      <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {searchRes.total_matches} matches · {searchRes.unique_users} people
                      </span>
                    )}
                  </div>
                  <div className="rdg-card-body">
                    <SearchBar
                      request={searchReq}
                      onChange={setSearchReq}
                      onSearch={handleSearch}
                      isSearching={isSearching}
                      onToggleFilter={() => setShowFilterDrawer(!showFilterDrawer)}
                      hasActiveFilters={hasActiveFilters}
                      similarityEnabled={settings?.similaritySearchEnabled ?? true}
                      filtersOpen={showFilterDrawer}
                    />

                    {showFilterDrawer && (
                      <FilterDrawer
                        request={searchReq}
                        onChange={setSearchReq}
                        onApply={() => { setShowFilterDrawer(false); handleSearch(); }}
                        onReset={handleResetFilters}
                        onClose={() => setShowFilterDrawer(false)}
                      />
                    )}

                    {searchRes && searchRes.ranking_explanation && (
                      <p style={{
                        fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
                        background: 'var(--bg-elevated)', padding: 8,
                        border: '1px solid var(--border-dim)', borderRadius: 'var(--radius-sm)'
                      }}>
                        {searchRes.ranking_explanation}
                      </p>
                    )}

                    {searchRes && searchRes.results.length === 0 && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                        No comments found matching your search.
                      </p>
                    )}

                    {searchRes && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {searchRes.results.map((c) => (
                          <CommentCard key={c.id} comment={c} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PEOPLE TAB */}
            {activeTab === 'PEOPLE' && (
              <div
                role="tabpanel"
                id={panelId('PEOPLE')}
                aria-labelledby={tabId('PEOPLE')}
                tabIndex={0}
              >
                <ParticipantAnalytics
                  participants={participants}
                  resolution={thread.question_resolution}
                  opInteraction={thread.op_interaction}
                />
              </div>
            )}

            {/* EXPLORE TAB */}
            {activeTab === 'EXPLORE' && (
              <div
                role="tabpanel"
                id={panelId('EXPLORE')}
                aria-labelledby={tabId('EXPLORE')}
                tabIndex={0}
              >
                <ContradictionDetector contradictions={thread.contradictions} />
                <ThreadInsights
                  debateMap={thread.debate_map}
                  mainArguments={thread.main_arguments}
                  temperature={thread.temperature}
                  argumentJourney={thread.argument_journey}
                />
              </div>
            )}
          </>
        )}
      </main>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSaved={async () => {
          const s = await StorageService.getSettings();
          setSettings(s);
        }}
        onClearSession={handleClearSession}
      />
    </div>
  );
};
