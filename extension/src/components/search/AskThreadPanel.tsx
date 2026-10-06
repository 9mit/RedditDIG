import React, { useState } from 'react';
import { Send, Sparkles, AlertCircle } from 'lucide-react';
import { AskResponse, CommentSchema } from '../../types';
import { LocalAskThreadEngine } from '../../services/nlp/ask';
import { CommentCard } from '../common/CommentCard';

interface AskThreadPanelProps {
  threadId: string;
  comments?: CommentSchema[];
  onOpenSettings?: () => void;
}

const suggestedQuestions = [
  'What does the community recommend?',
  'What are the biggest complaints?',
  'What are people disagreeing about?',
  'What are the best alternatives?',
];

export const AskThreadPanel: React.FC<AskThreadPanelProps> = ({ comments, onOpenSettings }) => {
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (q: string) => {
    const query = q || question;
    if (!query.trim()) return;
    setIsAsking(true);
    setError(null);

    try {
      if (!comments || comments.length === 0) {
        throw new Error('No comments available yet to answer this question.');
      }

      const res = LocalAskThreadEngine.answerQuestion(query, comments);
      setResponse(res);
      setQuestion('');
    } catch (e: any) {
      setError(e.message || 'Could not get an answer right now.');
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="rdg-card">
      <div className="rdg-card-header">
        <h3>
          <Sparkles size={13} style={{ color: 'var(--royal-blue)' }} />
          <span>Ask This Thread</span>
        </h3>
        <span className="rdg-badge rdg-badge-ai">Thread Q&A</span>
      </div>
      <div className="rdg-card-body">
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Ask any question. Answers are synthesized directly from real comments in this thread.
        </p>

        {/* Suggested questions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Suggested questions">
          {suggestedQuestions.map((sq, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAsk(sq)}
              disabled={isAsking}
              className="rdg-suggestion"
            >
              {sq}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleAsk(question); }}
          style={{ display: 'flex', gap: 6 }}
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about this discussion..."
            aria-label="Ask anything about this discussion"
            className="rdg-input"
            disabled={isAsking}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            disabled={isAsking || !question.trim()}
            className="rdg-btn rdg-btn-primary"
            style={{ padding: '7px 14px', flexShrink: 0 }}
            aria-label="Submit question"
            title="Ask"
          >
            {isAsking ? <Sparkles size={13} className="animate-spin" aria-hidden="true" /> : <Send size={13} aria-hidden="true" />}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="rdg-error" role="alert">
            <AlertCircle size={13} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Response */}
        {response && (
          <div style={{
            background: 'var(--bg-surface)', border: '1.5px solid var(--border-default)',
            borderRadius: 'var(--radius-md)', padding: 12
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid var(--border-dim)',
              fontSize: 10.5, fontFamily: 'var(--font-mono)'
            }}>
              <span style={{ color: 'var(--royal-blue)', fontWeight: 800 }}>ANSWER</span>
              <span style={{ color: 'var(--text-muted)' }}>
                Confidence: {Math.round(response.confidence * 100)}%
              </span>
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-line', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {response.answer}
            </div>

            {response.cited_comments?.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-dim)' }}>
                <div className="rdg-section-label">Sources (Comments Used)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {response.cited_comments.map((c) => (
                    <CommentCard key={c.id} comment={c} compact />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
