import { useState } from 'react';
import Editor, { DiffEditor, type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Code, GitCompare, AlertTriangle, CheckCircle2, FileCode2 } from 'lucide-react';
import type { PlagiarismMatch } from '../types';

interface MonacoDiffViewerProps {
  studentName: string;
  sourceCode: string;
  plagiarismMatch?: PlagiarismMatch;
}

/**
 * Theme cho trình soạn thảo.
 *
 * Khung UI giữ 3 màu (xanh dương / đen / trắng), nhưng phần tô màu cú pháp thì
 * dùng đúng bảng màu VS Code Light+ thật — vì người dùng đọc code quen với
 * màu đó, đổi sang 1 tông xanh thì mất khả năng phân biệt token.
 */
const AITA_THEME = 'aita-light';

const defineTheme = (monaco: Monaco) => {
  monaco.editor.defineTheme(AITA_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '000000' },
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000ff' },
      { token: 'keyword.control', foreground: 'af00db' },
      { token: 'string', foreground: 'a31515' },
      { token: 'string.escape', foreground: 'ee0000' },
      { token: 'number', foreground: '098658' },
      { token: 'regexp', foreground: '811f3f' },
      { token: 'type', foreground: '267f99' },
      { token: 'type.identifier', foreground: '267f99' },
      { token: 'identifier', foreground: '001080' },
      { token: 'delimiter', foreground: '000000' },
      { token: 'delimiter.bracket', foreground: '0431fa' },
      { token: 'operator', foreground: '000000' },
      { token: 'annotation', foreground: '808080' },
      { token: 'tag', foreground: '800000' },
      { token: 'attribute.name', foreground: 'e50000' },
      { token: 'attribute.value', foreground: '0451a5' },
      { token: 'invalid', foreground: 'cd3131', background: 'fef3f2' },
      // ghi đè token tô màu cặp ngoặc của Monaco
      { token: 'mtk15', foreground: '000000' },
      { token: 'bracket-highlighting-0', foreground: '0431fa' },
      { token: 'bracket-highlighting-1', foreground: '319331' },
      { token: 'bracket-highlighting-2', foreground: '7b3814' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editorLineNumber.foreground': '#237893',
      'editorLineNumber.activeForeground': '#0b216f',
      'editor.lineHighlightBackground': '#f7f9fc',
      'editor.selectionBackground': '#add6ff',
      'editorCursor.foreground': '#000000',
      'editorIndentGuide.background1': '#d3d3d3',
      'editorWidget.background': '#f3f3f3',
      'editorWidget.border': '#c8c8c8',
      'diffEditor.insertedTextBackground': '#9bbf30aa',
      'diffEditor.removedTextBackground': '#ff000033',
      'diffEditor.insertedLineBackground': '#e9f2d9',
      'diffEditor.removedLineBackground': '#ffeaea',
      'scrollbarSlider.background': '#64646466',
      'scrollbarSlider.hoverBackground': '#646464aa',
    },
  });
};

const editorOptions = {
  readOnly: true,
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbersMinChars: 3,
  wordWrap: 'on' as const,
  padding: { top: 10, bottom: 10 },
  renderLineHighlight: 'line' as const,
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  // Tô màu cặp ngoặc như VS Code thật (giúp đọc code lồng nhau)
  bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: false },
  guides: { bracketPairs: true, indentation: true },
};

export const MonacoDiffViewer: React.FC<MonacoDiffViewerProps> = ({
  studentName,
  sourceCode,
  plagiarismMatch,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'diff'>('single');

  const similarity = plagiarismMatch?.similarityRate || 0;
  const isHighRisk = similarity >= 70;
  const matchedTokensCount = plagiarismMatch?.matchedTokens?.length || 0;

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 11px',
    borderRadius: '6px',
    border: `1px solid ${isActive ? 'var(--border-highlight)' : 'transparent'}`,
    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
    color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
    fontWeight: isActive ? 600 : 500,
    fontSize: '12.5px',
    cursor: 'pointer',
    transition: 'color .15s ease, background-color .15s ease, border-color .15s ease',
  });

  return (
    <div style={{ marginTop: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          <button type="button" onClick={() => setActiveTab('single')} style={tabStyle(activeTab === 'single')}>
            <Code size={13} /> Mã nguồn bài làm
          </button>

          {plagiarismMatch && (
            <button type="button" onClick={() => setActiveTab('diff')} style={tabStyle(activeTab === 'diff')}>
              <GitCompare size={13} /> Đối sánh đạo văn ({similarity}%)
            </button>
          )}
        </div>

        {plagiarismMatch && (
          <div
            style={{
              fontSize: '12px',
              color: isHighRisk ? 'var(--text-main)' : 'var(--blue-200)',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              flexWrap: 'wrap',
            }}
          >
            {isHighRisk ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
            <span>
              Trùng khớp với <strong>{plagiarismMatch.matchedStudentName}</strong> ({plagiarismMatch.matchedStudentId})
            </span>
            {matchedTokensCount > 0 && (
              <span className="chip chip-neutral chip-mono">{matchedTokensCount} token</span>
            )}
          </div>
        )}
      </div>

      <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: '#ffffff' }}>
        <div
          style={{
            backgroundColor: '#f7f9fc',
            padding: '7px 13px',
            fontSize: '11.5px',
            color: 'var(--text-dim)',
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {activeTab === 'single' ? (
            <>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)' }}>
                <FileCode2 size={12} /> Solution.java
              </span>
              <span style={{ color: 'var(--text-dim)' }}>Chế độ xem độc lập</span>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--blue-200)' }}>Gốc · {studentName}</span>
              <span style={{ color: isHighRisk ? 'var(--text-main)' : 'var(--blue-200)', fontWeight: 600 }}>
                Đối chiếu · {plagiarismMatch?.matchedStudentName}
              </span>
            </>
          )}
        </div>

        {activeTab === 'single' ? (
          <Editor
            height="380px"
            defaultLanguage="java"
            theme={AITA_THEME}
            beforeMount={defineTheme}
            value={sourceCode}
            options={{ ...editorOptions, fontSize: 13 } as editor.IStandaloneEditorConstructionOptions}
          />
        ) : (
          <DiffEditor
            height="420px"
            language="java"
            theme={AITA_THEME}
            beforeMount={defineTheme}
            original={plagiarismMatch?.sourceCodeA || sourceCode}
            modified={plagiarismMatch?.sourceCodeB || ''}
            // Giữ model cũ lại khi nội dung đổi, tránh Monaco dispose model trước lúc
            // DiffEditorWidget kịp reset → lỗi "TextModel got disposed before ... model got reset".
            keepCurrentOriginalModel
            keepCurrentModifiedModel
            options={
              {
                ...editorOptions,
                fontSize: 12.5,
                renderSideBySide: true,
              } as editor.IStandaloneDiffEditorConstructionOptions
            }
          />
        )}
      </div>
    </div>
  );
};
