import { useState, useRef } from 'react';
import { UploadCloud, FileArchive, AlertOctagon, X, Send, Hash, ShieldCheck, Cpu, Code2 } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import type { Task } from '../types';
import { RBL_BENCHMARK_PAIRS } from '../services/ast-engine/rbl-benchmark-pairs';

interface SubmissionViewProps {
  task: Task;
  onSubmit: (file?: File, benchmarkPairId?: number, customCode?: string) => void;
}

export const SubmissionView: React.FC<SubmissionViewProps> = ({ task, onSubmit }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sha256Checksum, setSha256Checksum] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateSha256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setSelectedBenchmarkId(null);
    const maxBytes = task.maxSizeMb * 1024 * 1024;

    if (file.size > maxBytes) {
      setErrorMessage(`Dung lượng file vượt quá giới hạn ${task.maxSizeMb}MB! (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
      return;
    }

    const validExtensions = ['.zip', '.java', '.cpp', '.c', '.py', '.ts', '.js', '.txt'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt && !file.type.includes('zip') && !file.type.includes('text')) {
      setErrorMessage('Chấp nhận các định dạng file (.zip, .cpp, .java, .py, .c, .txt)');
      return;
    }

    setSelectedFile(file);
    setIsHashing(true);
    try {
      const hash = await calculateSha256(file);
      setSha256Checksum(hash);
    } catch {
      setSha256Checksum(null);
    } finally {
      setIsHashing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      void processFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (selectedBenchmarkId !== null) {
      onSubmit(undefined, selectedBenchmarkId);
    } else if (selectedFile) {
      onSubmit(selectedFile);
    }
  };

  const handleSelectBenchmark = (pairId: number) => {
    setSelectedBenchmarkId(pairId);
    setSelectedFile(null);
    setSha256Checksum(null);
    setErrorMessage(null);
  };

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px' }}>
      <div className="glass-panel" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {task.course}
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 800, marginTop: '4px', marginBottom: '8px', color: '#ffffff' }}>
              {task.title}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{task.description}</p>
          </div>
          <CountdownTimer deadline={task.deadline} />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
            Nộp bài tập mã nguồn (File thật hoặc Bộ kiểm thử RBL)
          </h2>
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)', fontWeight: 600 }}>
            AST & Winnowing Real Engine
          </span>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? 'var(--accent-primary)' : selectedFile ? 'var(--accent-emerald)' : 'var(--border-color)'}`,
            borderRadius: '16px',
            padding: '36px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.08)' : selectedFile ? 'rgba(16, 185, 129, 0.05)' : 'rgba(18, 24, 36, 0.5)',
            transition: 'all 0.2s ease-in-out',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.java,.cpp,.c,.py,.ts,.js,.txt"
            onChange={handleChange}
            style={{ display: 'none' }}
          />

          {selectedFile ? (
            <>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)' }}>
                <FileArchive size={36} />
              </div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>{selectedFile.name}</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Kích thước: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                {isHashing && (
                  <p style={{ fontSize: '12px', color: 'var(--accent-primary)', marginTop: '4px' }}>
                    Đang tính toán mã băm SHA-256...
                  </p>
                )}
                {sha256Checksum && (
                  <div style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', fontSize: '12px', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    <ShieldCheck size={14} color="#10b981" />
                    <span>SHA-256: {sha256Checksum.substring(0, 16)}...{sha256Checksum.substring(sha256Checksum.length - 8)}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setSha256Checksum(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-rose)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginTop: '8px',
                }}
              >
                <X size={16} /> Chọn lại file khác
              </button>
            </>
          ) : (
            <>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                <UploadCloud size={32} />
              </div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Kéo thả file mã nguồn hoặc .zip vào đây</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Hỗ trợ: .zip, .cpp, .java, .py, .c, .txt
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border-color)' }}>
                  Giới hạn: ≤ {task.maxSizeMb}MB
                </span>
                <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Hash size={12} /> Tự động xác thực SHA-256
                </span>
              </div>
            </>
          )}
        </div>

        {/* Real Benchmark Dataset Selector Section */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Cpu size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
              Kiểm thử dữ liệu thực tế từ Benchmark Dataset (10 Cặp bài ngụy trang RBL):
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Bấm chọn một cặp bài bên dưới để đưa trực tiếp mã nguồn vào AST Normalizer & Winnowing Engine kiểm tra tỷ lệ trùng khớp thực:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
            {RBL_BENCHMARK_PAIRS.map((pair) => {
              const isSelected = selectedBenchmarkId === pair.pairId;
              return (
                <div
                  key={pair.pairId}
                  onClick={() => handleSelectBenchmark(pair.pairId)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: isSelected ? 'var(--accent-primary)' : '#e5e7eb' }}>
                      Cặp #{pair.pairId.toString().padStart(2, '0')}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 600,
                      backgroundColor: pair.expectedIsPlagiarized ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: pair.expectedIsPlagiarized ? '#f43f5e' : '#10b981',
                    }}>
                      {pair.expectedIsPlagiarized ? 'Đạo văn' : 'An toàn'}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    {pair.obfuscationType}
                  </span>
                </div>
              );
            })}
          </div>

          {selectedBenchmarkId !== null && (
            <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#d1d5db' }}>
                <Code2 size={16} color="var(--accent-cyan)" />
                <span>Đang chọn kiểm thử: <strong>{RBL_BENCHMARK_PAIRS.find(p => p.pairId === selectedBenchmarkId)?.title}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBenchmarkId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Hủy chọn
              </button>
            </div>
          )}
        </div>

        {errorMessage && (
          <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', backgroundColor: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertOctagon size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={(!selectedFile && selectedBenchmarkId === null) || isHashing}
          style={{
            marginTop: '24px',
            width: '100%',
            padding: '14px 24px',
            borderRadius: '12px',
            border: 'none',
            background: (selectedFile || selectedBenchmarkId !== null) && !isHashing
              ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
              : 'var(--bg-card)',
            color: (selectedFile || selectedBenchmarkId !== null) && !isHashing ? '#ffffff' : 'var(--text-dim)',
            fontSize: '16px',
            fontWeight: 700,
            cursor: (selectedFile || selectedBenchmarkId !== null) && !isHashing ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: (selectedFile || selectedBenchmarkId !== null) && !isHashing ? '0 10px 25px -5px rgba(99, 102, 241, 0.4)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Send size={18} /> {selectedBenchmarkId !== null ? `Kiểm Thử Cặp #${selectedBenchmarkId.toString().padStart(2, '0')} Với AST Real Engine` : 'Nộp Bài Chấm Điểm Real-Time'}
        </button>
      </div>
    </div>
  );
};
