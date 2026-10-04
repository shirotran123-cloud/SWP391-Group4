import { useState } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { Code, GitCompare, Eye } from 'lucide-react';
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
                backgroundColor: activeTab === 'diff' ? 'var(--accent-rose)' : 'rgba(244, 63, 94, 0.15)',
                color: activeTab === 'diff' ? '#ffffff' : '#f43f5e',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
            >
              <GitCompare size={16} /> So Sánh Đạo Văn Side-by-Side ({plagiarismMatch.similarityRate}%)
            </button>
          )}
        </div>

        {plagiarismMatch && (
          <div style={{ fontSize: '13px', color: 'var(--accent-rose)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={16} /> Phát hiện trùng lặp với: {plagiarismMatch.matchedStudentName} ({plagiarismMatch.matchedStudentId})
          </div>
        )}
      </div>

      <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: '#1e1e1e' }}>
        {activeTab === 'single' ? (
          <div>
            <div style={{ backgroundColor: '#252526', padding: '8px 16px', fontSize: '12px', color: '#858585', borderBottom: '1px solid #333' }}>
              Solution.java — Java 17 (Syntax Highlighting)
            </div>
            <Editor
              height="400px"
              defaultLanguage="java"
              theme="vs-dark"
              value={sourceCode}
              options={{
                readOnly: true,
                fontSize: 14,
                fontFamily: 'var(--font-mono)',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbersMinChars: 3,
              }}
            />
          </div>
        ) : (
          <div>
            <div style={{ backgroundColor: '#252526', padding: '8px 16px', fontSize: '12px', color: '#858585', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
              <span>GỐC: {studentName}'s Code</span>
              <span>TRÙNG LẶP ({plagiarismMatch?.similarityRate}%): {plagiarismMatch?.matchedStudentName}'s Code</span>
            </div>
            <DiffEditor
              height="420px"
              language="java"
              theme="vs-dark"
              original={plagiarismMatch?.sourceCodeA || sourceCode}
              modified={plagiarismMatch?.sourceCodeB || ''}
              options={{
                readOnly: true,
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                minimap: { enabled: false },
                renderSideBySide: true,
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
