import React, { useState } from 'react';
import {
  BookOpen, Zap, Terminal, Code, AlertTriangle, CheckCircle,
  Layers, ShieldAlert, Cpu, HardDrive, Sparkles, ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';
import { parseAssignmentDescription, type ParsedAssignmentSpec } from '../utils/assignmentParser';

export interface TechnicalRequirementProp {
  problemContext?: string;
  inputFormat?: string[];
  outputFormat?: string[];
  constraints?: string[];
  complexityRequirements?: string[];
  solidGuidelines?: string[];
}

interface AssignmentDescriptionViewProps {
  description: string;
  technicalRequirements?: TechnicalRequirementProp;
  starterCode?: string;
  title?: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  courseCode?: string;
  testCasesCount?: number;
  allowedLanguages?: string[];
  mode?: 'HEADER_COMPACT' | 'FULL_SPEC';
  onScrollToSpec?: () => void;
}

export const AssignmentDescriptionView: React.FC<AssignmentDescriptionViewProps> = ({
  description,
  technicalRequirements,
  starterCode,
  title,
  timeLimitMs = 2000,
  memoryLimitMb = 512,
  courseCode = 'SWP391',
  testCasesCount = 5,
  allowedLanguages = ['java', 'python', 'cpp'],
  mode = 'FULL_SPEC',
  onScrollToSpec,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const parsedSpec: ParsedAssignmentSpec = parseAssignmentDescription(description);

  // Kết hợp giữa dữ liệu bóc tách từ text và technicalRequirements (nếu có sẵn)
  const overview = (technicalRequirements?.problemContext && technicalRequirements.problemContext.length > 30)
    ? technicalRequirements.problemContext
    : parsedSpec.overview;

  const techRequirements = parsedSpec.technicalRequirements.length > 0
    ? parsedSpec.technicalRequirements
    : [
        ...(technicalRequirements?.complexityRequirements || []),
        ...(technicalRequirements?.solidGuidelines || []),
      ];

  const inputFormat = (technicalRequirements?.inputFormat && technicalRequirements.inputFormat.length > 0)
    ? technicalRequirements.inputFormat
    : parsedSpec.inputFormat;

  const outputFormat = (technicalRequirements?.outputFormat && technicalRequirements.outputFormat.length > 0)
    ? technicalRequirements.outputFormat
    : parsedSpec.outputFormat;

  const constraints = (technicalRequirements?.constraints && technicalRequirements.constraints.length > 0)
    ? technicalRequirements.constraints
    : parsedSpec.constraints;

  const handleCopy = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  // ==========================================
  // CHẾ ĐỘ 1: HEADER COMPACT (DÙNG TRÊN ĐẦU MÀN HÌNH NỘP BÀI)
  // Chỉ hiển thị tóm tắt ngắn gọn + các tags công nghệ, không gây ngợp!
  // ==========================================
  if (mode === 'HEADER_COMPACT') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Tiêu đề đề bài. Trước đây prop `title` được nhận vào và truyền từ phía gọi nhưng
            KHÔNG hề được render, nên tiêu đề đề bài biến mất khỏi giao diện. */}
        {title && (
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: '1.4',
            }}
          >
            {title}
          </h3>
        )}

        {/* Tóm tắt nghiệp vụ 1-2 câu */}
        <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
          {isExpanded ? overview : parsedSpec.shortSummary}
        </p>

        {/* Nút xem thêm / thu gọn tóm tắt nếu overview dài */}
        {overview.length > parsedSpec.shortSummary.length && (
          <div>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 0',
              }}
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={14} /> Thu gọn tóm tắt
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> Xem thêm bối cảnh...
                </>
              )}
            </button>
          </div>
        )}

        {/* Các Tags / Chips Công Nghệ & Kỹ Thuật Tự Động Trích Xuất */}
        {parsedSpec.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
            {parsedSpec.tags.map((tag, idx) => {
              let bg = 'rgba(99, 102, 241, 0.15)';
              let color = '#818cf8';
              let border = 'rgba(99, 102, 241, 0.35)';

              if (tag.includes('Dijkstra') || tag.includes('QuickSort') || tag.includes('AVL') || tag.includes('BST')) {
                bg = 'rgba(56, 189, 248, 0.15)';
                color = '#38bdf8';
                border = 'rgba(56, 189, 248, 0.4)';
              } else if (tag.includes('PriorityQueue') || tag.includes('Heap')) {
                bg = 'rgba(16, 185, 129, 0.15)';
                color = '#34d399';
                border = 'rgba(16, 185, 129, 0.4)';
              } else if (tag.includes('O(')) {
                bg = 'rgba(245, 158, 11, 0.15)';
                color = '#fbbf24';
                border = 'rgba(245, 158, 11, 0.4)';
              } else if (tag.includes('SOLID') || tag.includes('SRP')) {
                bg = 'rgba(168, 85, 247, 0.15)';
                color = '#c084fc';
                border = 'rgba(168, 85, 247, 0.4)';
              } else if (tag.includes('64-bit')) {
                bg = 'rgba(236, 72, 153, 0.15)';
                color = '#f472b6';
                border = 'rgba(236, 72, 153, 0.4)';
              }

              return (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    backgroundColor: bg,
                    color: color,
                    border: `1px solid ${border}`,
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  <Sparkles size={11} /> {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // CHẾ ĐỘ 2: FULL SPEC (TRÌNH BÀY ĐỀ BÀI PHÂN TẦNG ĐẲNG CẤP LEETCODE)
  // ==========================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* TIÊU ĐỀ ĐỀ BÀI. Prop `title` trước đây được nhận và truyền vào nhưng không hề render
          ở bất kỳ nhánh nào, nên tiêu đề đề bài biến mất khỏi giao diện. */}
      {title && (
        <h2
          style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: '1.35',
          }}
        >
          {title}
        </h2>
      )}

      {/* KHỐI 1: BỐI CẢNH NGHIỆP VỤ & MÔ TẢ BÀI TOÁN */}
      <div
        style={{
          padding: '20px 22px',
          borderRadius: '14px',
          backgroundColor: 'rgba(99, 102, 241, 0.07)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontSize: '14px', fontWeight: 800, marginBottom: '10px' }}>
          <BookOpen size={18} />
          <span>BỐI CẢNH BÀI TOÁN &amp; NGHIỆP VỤ THỰC TẾ</span>
        </div>
        <p style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: '1.7', margin: 0 }}>
          {overview}
        </p>
      </div>

      {/* KHỐI 2: YÊU CẦU THUẬT TOÁN & KỸ THUẬT (TECHNICAL REQUIREMENTS) */}
      {techRequirements.length > 0 && (
        <div
          style={{
            padding: '20px 22px',
            borderRadius: '14px',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '14px', fontWeight: 800, marginBottom: '14px' }}>
            <Zap size={18} />
            <span>YÊU CẦU KỸ THUẬT &amp; GIẢI THUẬT TRỌNG TÂM</span>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500 }}>(Bắt buộc tuân thủ)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {techRequirements.map((req, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: 800,
                    marginTop: '2px',
                  }}
                >
                  0{idx + 1}
                </span>
                <span style={{ fontSize: '13.5px', color: '#e2e8f0', lineHeight: '1.6' }}>
                  {req}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KHỐI 3: QUY CHUẨN ĐẦU VÀO (STDIN) & ĐẦU RA (STDOUT) (2 CỘT) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Cột Trái: Đầu vào (STDIN) */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            backgroundColor: 'rgba(10, 15, 29, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '13.5px', fontWeight: 800, marginBottom: '12px' }}>
            <Terminal size={16} />
            <span>ĐỊNH DẠNG ĐẦU VÀO (STDIN)</span>
          </div>

          {inputFormat.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.65', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {inputFormat.map((line, idx) => (
                <li key={idx}>
                  <code style={{ color: '#93c5fd', fontFamily: 'Consolas, monospace', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                    {line}
                  </code>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              Đọc dữ liệu từ luồng chuẩn STDIN (Scanner trong Java, sys.stdin trong Python, cin trong C++).
            </div>
          )}
        </div>

        {/* Cột Phải: Đầu ra (STDOUT) */}
        <div
          style={{
            padding: '18px 20px',
            borderRadius: '14px',
            backgroundColor: 'rgba(10, 15, 29, 0.85)',
            border: '1px solid rgba(52, 211, 153, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontSize: '13.5px', fontWeight: 800, marginBottom: '12px' }}>
            <Code size={16} />
            <span>ĐỊNH DẠNG ĐẦU RA (STDOUT)</span>
          </div>

          {outputFormat.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.65', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {outputFormat.map((line, idx) => (
                <li key={idx}>
                  <code style={{ color: '#6ee7b7', fontFamily: 'Consolas, monospace', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                    {line}
                  </code>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              In kết quả ra luồng chuẩn STDOUT. Không in các chuỗi thông báo thừa như &ldquo;Nhập N:&rdquo;.
            </div>
          )}
        </div>
      </div>

      {/* KHỐI 4: RÀNG BUỘC KỸ THUẬT & GIỚI HẠN (CONSTRAINTS) */}
      <div
        style={{
          padding: '18px 20px',
          borderRadius: '14px',
          backgroundColor: 'rgba(245, 158, 11, 0.06)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '13.5px', fontWeight: 800, marginBottom: '12px' }}>
          <AlertTriangle size={16} />
          <span>RÀNG BUỘC KỸ THUẬT &amp; GIỚI HẠN DỮ LIỆU (CONSTRAINTS)</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {constraints.length > 0 ? (
            constraints.map((c, idx) => (
              <div
                key={idx}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fef3c7',
                  fontSize: '12.5px',
                  fontFamily: 'Consolas, monospace',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>•</span>
                <span>{c}</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: '13px', color: '#d1d5db' }}>
              Thời gian tối đa: {timeLimitMs}ms | RAM tối đa: {memoryLimitMb}MB | Tránh thuật toán suy biến O(N²).
            </div>
          )}
        </div>
      </div>
      {/* KHỐI 5: KHUNG MÃ NGUỒN KHỞI TẠO (STARTER CODE) CHO SINH VIÊN */}
      {starterCode && (
        <div
          style={{
            padding: '20px 22px',
            borderRadius: '14px',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(129, 140, 248, 0.35)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a5b4fc', fontSize: '14px', fontWeight: 800 }}>
              <Code size={18} color="#818cf8" />
              <span>KHUNG MÃ NGUỒN KHỞI TẠO (STARTER CODE)</span>
              <span style={{ fontSize: '11px', color: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700 }}>
                Chuẩn SRP &amp; Kiến Trúc
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                try {
                  navigator.clipboard.writeText(starterCode);
                  setCopiedId('starter-code-spec');
                  setTimeout(() => setCopiedId(null), 2500);
                } catch (e) {
                  console.error('Failed to copy starter code', e);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: copiedId === 'starter-code-spec' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.22)',
                border: copiedId === 'starter-code-spec' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(99, 102, 241, 0.45)',
                color: copiedId === 'starter-code-spec' ? '#34d399' : '#ffffff',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {copiedId === 'starter-code-spec' ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
              <span>{copiedId === 'starter-code-spec' ? 'Đã sao chép vào Clipboard!' : 'Sao Chép Khung Code'}</span>
            </button>
          </div>

          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: '1.5' }}>
            💡 <strong>Hướng dẫn sinh viên:</strong> Hãy sao chép khung mã nguồn này vào file <code>Solution.java</code>, hoàn thiện các phương thức nghiệp vụ đánh dấu <code>// TODO</code> tuân thủ nguyên lý <strong>Single Responsibility Principle (SRP)</strong> và nén thành file <code>.zip</code> để nộp.
          </p>

          <pre
            style={{
              margin: 0,
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: '#070a13',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              fontSize: '12.5px',
              fontFamily: 'Consolas, Monaco, monospace',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
              lineHeight: '1.6',
            }}
          >
            {starterCode}
          </pre>
        </div>
      )}
    </div>
  );
};
