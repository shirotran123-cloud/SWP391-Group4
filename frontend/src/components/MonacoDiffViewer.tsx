import { useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { Code, GitCompare, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PlagiarismMatch } from '../types';

interface MonacoDiffViewerProps {
  studentName: string;
  sourceCode: string;
  plagiarismMatch?: PlagiarismMatch;
}

export const MonacoDiffViewer: React.FC<MonacoDiffViewerProps> = ({
  studentName,
  sourceCode,
  plagiarismMatch,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'diff'>('single');

  const similarity = plagiarismMatch?.similarityRate || 0;
  const isHighRisk = similarity >= 70;
  const matchedTokensCount = plagiarismMatch?.matchedTokens?.length || 0;

  return (
    <div className="glass-panel" style={{ padding: '20px', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('single')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'single' ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <Code size={16} /> Code Bài Làm ({studentName})
          </button>

          {plagiarismMatch && (
            <button
              onClick={() => setActiveTab('diff')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === 'diff' ? (isHighRisk ? 'var(--accent-rose)' : 'var(--accent-amber)') : 'rgba(244, 63, 94, 0.15)',
                color: activeTab === 'diff' ? '#ffffff' : (isHighRisk ? '#f43f5e' : '#f59e0b'),
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              <GitCompare size={16} /> So Sánh Đạo Văn Side-by-Side ({similarity}%)
            </button>
          )}
        </div>

        {plagiarismMatch && (
          <div style={{ fontSize: '13px', color: isHighRisk ? 'var(--accent-rose)' : 'var(--accent-amber)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isHighRisk ? <AlertTriangle size={16} /> : <Eye size={16} />}
            <span>
              Trùng khớp với: <strong>{plagiarismMatch.matchedStudentName}</strong> ({plagiarismMatch.matchedStudentId})
            </span>
            {matchedTokensCount > 0 && (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#d1d5db' }}>
                {matchedTokensCount} đoạn token trùng
              </span>
            )}
          </div>
        )}
      </div>

      {plagiarismMatch && activeTab === 'diff' && (
        <div style={{
          marginBottom: '16px',
          padding: '14px 18px',
          borderRadius: '10px',
          backgroundColor: isHighRisk ? 'rgba(244, 63, 94, 0.08)' : 'rgba(16, 185, 129, 0.08)',
          border: `1px solid ${isHighRisk ? 'rgba(244, 63, 94, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isHighRisk ? '#f43f5e' : '#10b981',
              boxShadow: `0 0 10px ${isHighRisk ? '#f43f5e' : '#10b981'}`,
            }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: isHighRisk ? '#f43f5e' : '#10b981' }}>
              {isHighRisk ? '🚨 BÁO ĐỘNG ĐẠO VĂN (≥ 70% NGƯỠNG RBL)' : '✅ MÃ NGUỒN AN TOÀN (< 70% NGƯỠNG RBL)'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: '#d1d5db' }}>
            <span>Độ tương đồng AST: <strong style={{ color: isHighRisk ? '#f87171' : '#34d399' }}>{similarity}%</strong></span>
            {plagiarismMatch.winnowingContainment !== undefined && (
              <span>Winnowing: <strong>{plagiarismMatch.winnowingContainment}%</strong></span>
            )}
            {plagiarismMatch.jaccardSimilarity !== undefined && (
              <span>Jaccard: <strong>{plagiarismMatch.jaccardSimilarity}%</strong></span>
            )}
            {plagiarismMatch.astStructuralSimilarity !== undefined && (
              <span>AST Vector: <strong>{plagiarismMatch.astStructuralSimilarity}%</strong></span>
            )}
            <span>Số đoạn trùng: <strong>{matchedTokensCount}</strong></span>
            {plagiarismMatch.executionTimeMs !== undefined && (
              <span style={{ color: '#60a5fa' }}>Xử lý: <strong>{plagiarismMatch.executionTimeMs}ms</strong></span>
            )}
          </div>
        </div>
      )}

      <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: '#1e1e1e' }}>
        {activeTab === 'single' ? (
          <div>
            <div style={{ backgroundColor: '#252526', padding: '8px 16px', fontSize: '12px', color: '#858585', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Mã nguồn bài nộp ({sourceCode.includes("def ") ? "Python" : sourceCode.includes("package") ? "Java" : "C/C++"})</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
                <CheckCircle2 size={13} /> Chế độ xem độc lập
              </span>
            </div>
            <Editor
              height="400px"
              defaultLanguage={sourceCode.includes("def ") ? "python" : sourceCode.includes("package") ? "java" : "cpp"}
              theme="vs-dark"
              value={sourceCode}
              options={{
                readOnly: true,
                automaticLayout: true,
                fontSize: 14,
                fontFamily: 'var(--font-mono)',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbersMinChars: 3,
                wordWrap: 'on',
              }}
            />
          </div>
        ) : (
          <div>
            <div style={{ backgroundColor: '#252526', padding: '8px 16px', fontSize: '12px', color: '#858585', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#60a5fa' }}>GỐC: Bài nộp của {studentName}</span>
              <span style={{ color: isHighRisk ? '#f87171' : '#fbbf24', fontWeight: 600 }}>
                ĐỐI CHIẾU ({similarity}%): {plagiarismMatch?.matchedStudentName}
              </span>
            </div>
            <DiffEditor
              height="420px"
              language={(plagiarismMatch?.sourceCodeA || sourceCode).includes("def ") ? "python" : "java"}
              theme="vs-dark"
              original={plagiarismMatch?.sourceCodeA || sourceCode}
              modified={plagiarismMatch?.sourceCodeB || ''}
              options={{
                readOnly: true,
                automaticLayout: true,
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                minimap: { enabled: false },
                renderSideBySide: true,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
