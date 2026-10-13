import { useState, useRef } from 'react';
import { UploadCloud, FileArchive, AlertOctagon, X, Send, Hash, ShieldCheck, Lock, Bug, RefreshCw } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import type { Task } from '../types';

interface SubmissionViewProps {
  task: Task;
  onSubmit: (file: File) => void;
}

export const SubmissionView: React.FC<SubmissionViewProps> = ({ task, onSubmit }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sha256Checksum, setSha256Checksum] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exceptionType, setExceptionType] = useState<'OVERSIZE' | 'EXPIRED' | null>(null);
  const [isDeadlineSimulatedExpired, setIsDeadlineSimulatedExpired] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isActuallyExpired = new Date() > new Date(task.deadline);
  const isExpired = isActuallyExpired || isDeadlineSimulatedExpired;

  const calculateSha256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setExceptionType(null);

    // Kiểm tra ngoại lệ 2: Quá hạn chót (BR-02)
    if (isExpired) {
      setErrorMessage(`[BR-02 Ngoại Lệ] Đã quá hạn chót nộp bài (${new Date(task.deadline).toLocaleString('vi-VN')})! Cổng nộp đã tự động đóng.`);
      setExceptionType('EXPIRED');
      return;
    }

    const maxBytes = task.maxSizeMb * 1024 * 1024;

    // Kiểm tra ngoại lệ 1: File quá kích thước 10MB
    if (file.size > maxBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(`[413 Payload Too Large - Ngoại Lệ 1] Dung lượng file (${sizeMb} MB) vượt quá giới hạn tối đa ${task.maxSizeMb} MB! Hệ thống từ chối nhận file để bảo vệ băng thông.`);
      setExceptionType('OVERSIZE');
      return;
    }

    const isZip = file.name.endsWith('.zip') || file.type.includes('zip') || file.type.includes('compressed');
    if (!isZip) {
      setErrorMessage('Chỉ chấp nhận file định dạng nén (.zip)');
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
    if (isExpired) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isExpired) return;
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
    if (isExpired) {
      setErrorMessage('[BR-02 Ngoại Lệ] Không thể nộp bài do đã quá hạn chót!');
      return;
    }
    if (selectedFile) {
      onSubmit(selectedFile);
    }
  };

  // Demo kịch bản 1: Giả lập file 12.5MB
  const triggerDemoOversize = () => {
    setSelectedFile(null);
    setSha256Checksum(null);
    setErrorMessage(
      `[413 Payload Too Large - Ngoại Lệ 1] Dung lượng file (12.45 MB) vượt quá giới hạn tối đa ${task.maxSizeMb} MB! Đã đánh chặn ngay tại Client-side trước khi truyền tải qua mạng.`,
    );
    setExceptionType('OVERSIZE');
  };

  // Demo kịch bản 2: Giả lập quá hạn deadline (BR-02)
  const toggleDemoExpired = () => {
    const nextState = !isDeadlineSimulatedExpired;
    setIsDeadlineSimulatedExpired(nextState);
    setSelectedFile(null);
    setSha256Checksum(null);
    if (nextState) {
      setErrorMessage(
        '[BR-02 Ngoại Lệ 2] Cổng nộp bài đã đóng do quá hạn chót Deadline. Không cho phép nộp bổ sung nhằm bảo toàn tính toàn vẹn học thuật.',
      );
      setExceptionType('EXPIRED');
    } else {
      setErrorMessage(null);
      setExceptionType(null);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      {/* Thanh Demo Ngoại Lệ cho Hội đồng đánh giá */}
      <div
        style={{
          padding: '12px 18px',
          borderRadius: '12px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '13px', fontWeight: 700 }}>
          <Bug size={16} />
          <span>Kịch bản Demo Đường Ngoại Lệ (Milestone 2 Defense):</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={triggerDemoOversize}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: exceptionType === 'OVERSIZE' ? 'rgba(244, 63, 94, 0.3)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#f43f5e',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            🔴 Demo File &gt; 10MB
          </button>
          <button
            type="button"
            onClick={toggleDemoExpired}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: isDeadlineSimulatedExpired ? 'rgba(244, 63, 94, 0.3)' : 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#f43f5e',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isDeadlineSimulatedExpired ? <RefreshCw size={12} /> : <Lock size={12} />}
            {isDeadlineSimulatedExpired ? 'Khôi phục Deadline' : '🔴 Demo Quá Deadline (BR-02)'}
          </button>
        </div>
      </div>

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
          <CountdownTimer deadline={isDeadlineSimulatedExpired ? new Date(Date.now() - 3600000).toISOString() : task.deadline} />
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: '#ffffff' }}>
          Khu vực nộp bài tập (.zip)
        </h2>

        {/* Dropzone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            if (!isExpired) fileInputRef.current?.click();
          }}
          style={{
            border: `2px dashed ${
              isExpired
                ? 'rgba(244, 63, 94, 0.5)'
                : dragActive
                ? 'var(--accent-primary)'
                : selectedFile
                ? 'var(--accent-emerald)'
                : 'var(--border-color)'
            }`,
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
            cursor: isExpired ? 'not-allowed' : 'pointer',
            backgroundColor: isExpired
              ? 'rgba(244, 63, 94, 0.05)'
              : dragActive
              ? 'rgba(99, 102, 241, 0.08)'
              : 'rgba(18, 24, 36, 0.5)',
            transition: 'all 0.2s ease-in-out',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            opacity: isExpired ? 0.75 : 1,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            disabled={isExpired}
            onChange={handleChange}
            style={{ display: 'none' }}
          />

          {isExpired ? (
            <>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(244, 63, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                <Lock size={36} />
              </div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#f43f5e' }}>
                  Cổng nộp bài đã đóng (Quá hạn deadline - Quy tắc BR-02)
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Hệ thống khóa nộp bài tự động khi quá thời hạn quy định để bảo đảm tính công bằng.
                </p>
              </div>
            </>
          ) : selectedFile ? (
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
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                <UploadCloud size={36} />
              </div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>Kéo thả file .zip bài làm vào đây</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Hoặc click để duyệt file từ máy tính của bạn
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border-color)' }}>
                  Giới hạn dung lượng: ≤ {task.maxSizeMb}MB
                </span>
                <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Hash size={12} /> Tự động xác thực SHA-256
                </span>
              </div>
            </>
          )}
        </div>

        {/* Error message / Exception banner */}
        {errorMessage && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 18px',
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              color: '#f43f5e',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              lineHeight: 1.5,
            }}
          >
            <AlertOctagon size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                {exceptionType === 'OVERSIZE'
                  ? 'ĐÁNH CHẶN NGOẠI LỆ: DUNG LƯỢNG VƯỢT QUÁ 10MB'
                  : exceptionType === 'EXPIRED'
                  ? 'ĐÁNH CHẶN NGOẠI LỆ: QUÁ HẠN NỘP BÀI (BR-02)'
                  : 'LỖI BÀI NỘP'}
              </div>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!selectedFile || isHashing || isExpired}
          style={{
            marginTop: '24px',
            width: '100%',
            padding: '14px 24px',
            borderRadius: '12px',
            border: 'none',
            background: isExpired
              ? 'rgba(255, 255, 255, 0.05)'
              : selectedFile && !isHashing
              ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
              : 'var(--bg-card)',
            color: isExpired
              ? '#f43f5e'
              : selectedFile && !isHashing
              ? '#ffffff'
              : 'var(--text-dim)',
            fontSize: '16px',
            fontWeight: 700,
            cursor: selectedFile && !isHashing && !isExpired ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow:
              selectedFile && !isHashing && !isExpired
                ? '0 10px 25px -5px rgba(99, 102, 241, 0.4)'
                : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {isExpired ? (
            <>
              <Lock size={18} /> Cổng Nộp Đã Đóng (Quá Hạn Chót BR-02)
            </>
          ) : (
            <>
              <Send size={18} /> Nộp Bài Chấm Điểm Trực Tuyến
            </>
          )}
        </button>
      </div>
    </div>
  );
};
