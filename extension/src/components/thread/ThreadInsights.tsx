import React, { useState } from 'react';
import { GitBranch, Hash, Thermometer, TrendingUp, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { DebateMapNode, MainArgumentItem, TemperatureResponse } from '../../types';
import { jumpToRedditComment } from '../../services/reddit';

interface Props {
  debateMap?: DebateMapNode | null;
  mainArguments: MainArgumentItem[];
  temperature: TemperatureResponse;
  argumentJourney: Array<{
    comment_id: string;
    author: string;
    depth: number;
    score: number;
    stance: string;
    comment_type: string;
    snippet: string;
    permalink?: string;
  }>;
}

export const ThreadInsights: React.FC<Props> = ({ debateMap, mainArguments, temperature, argumentJourney }) => {
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  const tempColor = getTempColor(temperature.label);
  const tempBg = getTempBg(temperature.label);
  const tempBorder = getTempBorder(temperature.label);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 1. Thread Temperature Card */}
      <div className="rdg-card">
        <div className="rdg-card-header">
          <h3>
            <Thermometer size={14} style={{ color: tempColor }} />
            <span>Discussion Vibe</span>
          </h3>
          <span
            className="rdg-badge"
            style={{
              background: tempBg,
              color: tempColor,
              border: `1px solid ${tempBorder}`,
              fontWeight: 700
            }}
          >
            {temperature.label}
          </span>
        </div>
        <div className="rdg-card-body">
          {/* Temperature meter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="rdg-bar-track" style={{ flex: 1, height: 8 }}>
              <div
                style={{
                  width: `${Math.min(temperature.score * 10, 100)}%`,
                  height: '100%',
                  borderRadius: 3,
                  background: `linear-gradient(90deg, var(--positive) 0%, var(--warning) 50%, var(--negative) 100%)`,
                  transition: 'width 0.5s ease'
                }}
              />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: tempColor }}>
              {temperature.score.toFixed(1)}<span style={{ fontSize: 10, color: 'var(--text-dim)' }}>/10</span>
            </span>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            <div>Arguments / Heat: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{temperature.hostility_score}%</span></div>
            <div>Disagreements: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{temperature.disagreement_density}%</span></div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 8 }}>
            {temperature.explanation}
          </p>

          {/* Vibe rating scale meaning guide */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-dim)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="rdg-section-label" style={{ marginBottom: 0 }}>Vibe Scale Meaning</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>0 (Calm) → 10 (Confrontational)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 11 }}>
              <div style={{ padding: '6px 8px', background: 'var(--positive-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--positive-border)' }}>
                <span style={{ fontWeight: 700, color: 'var(--positive)' }}>0.0 – 2.4 Calm</span>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Polite, helpful, and relaxed consensus.</div>
              </div>
              <div style={{ padding: '6px 8px', background: 'var(--royal-blue-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--royal-blue-border)' }}>
                <span style={{ fontWeight: 700, color: 'var(--royal-blue)' }}>2.5 – 4.4 Debate</span>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Civil differences of opinion backed by evidence.</div>
              </div>
              <div style={{ padding: '6px 8px', background: 'var(--warning-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--warning-border)' }}>
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>4.5 – 6.4 Heated</span>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Polarizing debate with sharp clashes.</div>
              </div>
              <div style={{ padding: '6px 8px', background: 'var(--negative-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--negative-border)' }}>
                <span style={{ fontWeight: 700, color: 'var(--negative)' }}>6.5 – 10 Confrontational</span>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Tense exchanges and hostile language.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Interactive Debate Map */}
      {debateMap && debateMap.children && debateMap.children.length > 0 && (
        <div className="rdg-card">
          <div className="rdg-card-header">
            <h3>
              <GitBranch size={14} style={{ color: 'var(--royal-blue)' }} />
              <span>Discussion Breakdown</span>
            </h3>
            <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {debateMap.count} comments mapped
            </span>
          </div>
          <div className="rdg-card-body">
            <div style={{
              fontSize: 11.5,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              background: 'var(--bg-surface)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1.5px solid var(--border-default)',
              marginBottom: 10
            }}>
              <span style={{ color: 'var(--royal-blue)', fontWeight: 800 }}>POST TOPIC: </span>
              {debateMap.label}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {debateMap.children.map((branch) => {
                const isSelected = selectedBranch === branch.id;
                const badgeClass = branch.sentiment === 'positive'
                  ? 'rdg-badge-support'
                  : branch.sentiment === 'negative'
                  ? 'rdg-badge-against'
                  : 'rdg-badge-neutral';
                const sentimentLabel = branch.sentiment === 'positive' ? 'Agrees' : branch.sentiment === 'negative' ? 'Disagrees' : 'Mixed';

                return (
                  <div
                    key={branch.id}
                    className="rdg-debate-node"
                    style={{
                      borderColor: isSelected ? 'var(--royal-blue)' : 'var(--border-default)',
                      padding: 10
                    }}
                    onClick={() => setSelectedBranch(isSelected ? null : branch.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`rdg-badge ${badgeClass}`}>{sentimentLabel}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {branch.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {branch.count} comments
                      </span>
                    </div>

                    {/* Sub-topics under this branch */}
                    {branch.children && branch.children.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                        {branch.children.map((sub) => (
                          <span
                            key={sub.id}
                            style={{
                              fontSize: 10,
                              fontFamily: 'var(--font-mono)',
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)',
                              background: '#ffffff',
                              border: '1px solid var(--border-default)',
                              color: 'var(--text-secondary)'
                            }}
                          >
                            {sub.label} ({sub.count})
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Sample comment links */}
                    {branch.comment_ids && branch.comment_ids.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border-dim)' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Sample source:</span>
                        {branch.comment_ids.map((id, i) => (
                          <button
                            key={id}
                            type="button"
                            className="rdg-source-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              jumpToRedditComment(id);
                            }}
                          >
                            <span>#{i + 1}</span>
                            <ExternalLink size={10} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. Key Discussion Topics */}
      {mainArguments && mainArguments.length > 0 && (
        <div className="rdg-card">
          <div className="rdg-card-header">
            <h3>
              <Hash size={14} style={{ color: 'var(--royal-blue)' }} />
              <span>Main Topics Talked About ({mainArguments.length})</span>
            </h3>
          </div>
          <div className="rdg-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mainArguments.map((arg, idx) => {
                const isOpen = expandedTopic === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      background: '#ffffff',
                      border: `1.5px solid ${isOpen ? 'var(--royal-blue)' : 'var(--border-default)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'border-color 0.12s'
                    }}
                    onClick={() => setExpandedTopic(isOpen ? null : idx)}
                  >
                    <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                          {arg.topic}
                        </span>
                        <span className="rdg-badge rdg-badge-neutral">
                          {arg.percentage}% of comments
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {arg.mentions_count} mentions
                        </span>
                        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </div>
                    </div>

                    {isOpen && arg.sample_comment_ids && arg.sample_comment_ids.length > 0 && (
                      <div
                        style={{
                          padding: '6px 10px 10px',
                          borderTop: '1px solid var(--border-dim)'
                        }}
                        className="animate-fade-in"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Jump to comments:</span>
                          {arg.sample_comment_ids.map((id, sIdx) => (
                            <button
                              key={id}
                              type="button"
                              className="rdg-source-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                jumpToRedditComment(id);
                              }}
                            >
                              <span>Comment #{sIdx + 1}</span>
                              <ExternalLink size={10} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. Longest Reply Chain */}
      {argumentJourney && argumentJourney.length > 0 && (
        <div className="rdg-card" style={{ overflow: 'hidden' }}>
          <div className="rdg-card-header">
            <h3>
              <TrendingUp size={14} style={{ color: 'var(--royal-blue)' }} />
              <span>Longest Reply Chain ({argumentJourney.length} comments · {Math.max(...argumentJourney.map(s => s.depth), argumentJourney.length - 1)} levels deep)</span>
            </h3>
          </div>
          <div className="rdg-card-body" style={{ overflow: 'hidden' }}>
            <div style={{ position: 'relative', paddingLeft: 18, minWidth: 0 }}>
              {/* Vertical connecting line */}
              <div
                style={{
                  position: 'absolute',
                  left: 5,
                  top: 8,
                  bottom: 12,
                  width: 2,
                  background: 'var(--border-default)'
                }}
              />

              {argumentJourney.map((step, idx) => {
                const stanceClass = step.stance === 'support'
                  ? 'rdg-badge-support'
                  : step.stance === 'against'
                  ? 'rdg-badge-against'
                  : 'rdg-badge-neutral';
                const stepStance = step.stance === 'support' ? 'Agrees' : step.stance === 'against' ? 'Disagrees' : 'Neutral';

                return (
                  <div
                    key={step.comment_id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      marginBottom: idx === argumentJourney.length - 1 ? 0 : 12,
                      position: 'relative',
                      minWidth: 0,
                      width: '100%'
                    }}
                  >
                    {/* Node circle */}
                    <div
                      style={{
                        position: 'absolute',
                        left: -17,
                        top: 5,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: idx === 0 ? 'var(--royal-blue)' : 'var(--text-muted)',
                        border: '2px solid #ffffff'
                      }}
                    />

                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      maxWidth: '100%',
                      background: '#ffffff',
                      border: '1.5px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 10px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--royal-blue)' }} className="rdg-truncate">
                            u/{step.author}
                          </span>
                          <span style={{
                            fontSize: 9.5,
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-elevated)',
                            padding: '1px 5px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-dim)'
                          }}>
                            {step.depth === 0 ? 'Top comment' : `Reply level ${step.depth}`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span className={`rdg-badge ${stanceClass}`}>{stepStance}</span>
                          <span style={{
                            fontSize: 10,
                            fontFamily: 'var(--font-mono)',
                            color: step.score < 0 ? 'var(--negative)' : 'var(--positive)',
                            fontWeight: 600
                          }}>
                            {step.score > 0 ? `+${step.score}` : step.score}
                          </span>
                        </div>
                      </div>

                      <p style={{
                        fontSize: 11.5,
                        color: 'var(--text-primary)',
                        lineHeight: 1.45,
                        margin: '4px 0 6px',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere'
                      }}>
                        "{step.snippet}"
                      </p>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <button
                          type="button"
                          className="rdg-source-link"
                          onClick={() => jumpToRedditComment(step.comment_id, step.permalink)}
                        >
                          <span>View on Reddit</span>
                          <ExternalLink size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function getTempColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('calm') || l.includes('cool')) return 'var(--positive)';
  if (l.includes('constructive') || l.includes('warm') || l.includes('moderate')) return 'var(--warning)';
  return 'var(--negative)';
}

function getTempBg(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('calm') || l.includes('cool')) return 'var(--positive-dim)';
  if (l.includes('constructive') || l.includes('warm') || l.includes('moderate')) return 'var(--warning-dim)';
  return 'var(--negative-dim)';
}

function getTempBorder(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('calm') || l.includes('cool')) return 'var(--positive-border)';
  if (l.includes('constructive') || l.includes('warm') || l.includes('moderate')) return 'var(--warning-border)';
  return 'var(--negative-border)';
}
