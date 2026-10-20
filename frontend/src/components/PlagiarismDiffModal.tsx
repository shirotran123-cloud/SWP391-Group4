import React, { useState } from 'react';
import { DiffEditor, type Monaco } from '@monaco-editor/react';
import { X, GitCompare, AlertTriangle, ShieldAlert, CheckCircle2, Copy, Check, FileCode, Users } from 'lucide-react';
import type { PlagiarismMatch } from '../types';

interface PlagiarismDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: PlagiarismMatch | null;
  studentAName?: string;
}

const AITA_THEME = 'aita-diff-light';

const defineTheme = (monaco: Monaco) => {
  monaco.editor.defineTheme(AITA_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '000000' },
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000ff' },
      { token: 'string', foreground: 'a31515' },
      { token: 'number', foreground: '098658' },
      { token: 'type', foreground: '267f99' },
      { token: 'identifier', foreground: '001080' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editorLineNumber.foreground': '#237893',
      'diffEditor.insertedTextBackground': '#9bbf3044',
      'diffEditor.removedTextBackground': '#ef444433',
      'diffEditor.insertedLineBackground': '#f0fdf4',
      'diffEditor.removedLineBackground': '#fef2f2',
    },
  });
};

export const PlagiarismDiffModal: React.FC<PlagiarismDiffModalProps> = ({
  isOpen,
  onClose,
  match,
  studentAName = 'Bài Nộp A',
}) => {
  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen || !match) return null;

  const similarity = match.similarityRate || 0;
  const isSeverePlagiarism = similarity >= 80;
  const isFlagged = similarity >= 70;
  const matchedTokensCount = match.matchedTokens?.length || 0;

  const handleCopyId = () => {
    navigator.clipboard.writeText(match.matchedStudentId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getStatusBadge = () => {
    if (isSeverePlagiarism) {
      return {
        bg: '#fef2f2',
        border: '#ef4444',
        text: '#dc2626',
        label: 'ĐẠO VĂN NGHIÊM TRỌNG (≥80% - ĐIỂM 0)',
        icon: ShieldAlert,
      };
    }
    if (isFlagged) {
      return {
        bg: '#fffbeb',
        border: '#f59e0b',
        text: '#d97706',
        label: 'CẢNH BÁO TRÙNG LẶP (≥70% - CỜ GIAN LẬN)',
        icon: AlertTriangle,
      };
    }
    return {
      bg: '#f0fdf4',
      border: '#22c55e',
      text: '#16a34a',
      label: 'ĐỘ TRÙNG KHỚP THẤP (<70%)',
      icon: CheckCircle2,
    };
  };

  const badge = getStatusBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="modal-backdrop" style={{ zIndex: 9999 }}>
      <div
        className="modal-card fade-up"
        style={{
          width: '95vw',
          maxWidth: '1400px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            marginBottom: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: badge.bg,
                  color: badge.text,
                  border: `1px solid ${badge.border}`,
                }}
              >
                <BadgeIcon size={14} /> {badge.label}
              </span>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                Thuật toán AST Winnowing (K-gram k=15, w=10) & Containment Index
              </span>
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)', margin: '4px 0' }}>
              Đối Sánh Trực Quan Mã Nguồn: {studentAName} ⇔ {match.matchedStudentName || match.matchedStudentId}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', margin: 0 }}>
              Khu vực dành riêng cho Giảng viên / Quản lý bộ môn (BR-04). Tỷ lệ tương đồng được tính theo chỉ số bao hàm cực đại (Max Containment Index).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyId}
              title="Sao chép mã bài đối chiếu"
            >
              {copiedId ? <Check size={14} /> : <Copy size={14} />}
              {match.matchedStudentId}
            </button>
            <button
              type="button"
              className="btn btn-invert btn-sm"
              onClick={onClose}
              style={{ minWidth: '80px' }}
            >
              <X size={15} style={{ marginRight: '4px' }} /> Đóng
            </button>
          </div>
        </div>

        {/* METRICS STRIP */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Độ Tương Đồng Max Containment
            </span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: badge.text, marginTop: '2px' }}>
              {similarity.toFixed(1)}%
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(11, 18, 32, 0.03)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Tokens AST Trùng Khớp
            </span>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
              {matchedTokensCount} đoạn khớp
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(11, 18, 32, 0.03)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Chỉ Số Jaccard Tương Quan
            </span>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
              {(match.jaccardSimilarity ?? similarity).toFixed(1)}%
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(11, 18, 32, 0.03)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Quy chế xử lý BR-03
            </span>
            <div style={{ fontSize: '13px', fontWeight: 600, color: badge.text, marginTop: '6px' }}>
              {isSeverePlagiarism ? 'Hủy điểm bài tập về 0.0' : isFlagged ? 'Gửi cảnh báo nghi vấn' : 'Hợp lệ / An toàn'}
            </div>
          </div>
        </div>

        {/* CODE LABELS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-soft)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <FileCode size={13} color="var(--blue-500)" />
            <span>[BÊN TRÁI] Bài Nộp Hiện Tại: {studentAName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <Users size={13} color="var(--accent-rose)" />
            <span>[BÊN PHẢI] Bài Đối Chiếu: {match.matchedStudentName || match.matchedStudentId}</span>
          </div>
        </div>

        {/* MONACO DIFF EDITOR */}
        <div
          style={{
            flex: 1,
            minHeight: '400px',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
          }}
        >
          <DiffEditor
            height="100%"
            language="java"
            theme={AITA_THEME}
            beforeMount={defineTheme}
            original={match.sourceCodeA || '// Không có mã nguồn bài A'}
            modified={match.sourceCodeB || '// Không có mã nguồn bài B'}
            options={{
              readOnly: true,
              automaticLayout: true,
              renderSideBySide: true,
              scrollBeyondLastLine: false,
              minimap: { enabled: true },
              lineNumbersMinChars: 3,
              wordWrap: 'on',
              padding: { top: 10, bottom: 10 },
              diffWordWrap: 'on',
            }}
          />
        </div>
      </div>
    </div>
  );
};
