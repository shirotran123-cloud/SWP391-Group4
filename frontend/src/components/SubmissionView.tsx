import { useState, useRef } from 'react';
import { UploadCloud, FileArchive, AlertOctagon, X, Send } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import type { Task } from '../types';

interface SubmissionViewProps {
  task: Task;
  onSubmit: (file: File) => void;
}

export const SubmissionView: React.FC<SubmissionViewProps> = ({ task, onSubmit }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    setErrorMessage(null);
    const maxBytes = task.maxSizeMb * 1024 * 1024;
    
    if (file.size > maxBytes) {
      setErrorMessage(`Dung lượng file vượt quá giới hạn ${task.maxSizeMb}MB! (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);
      return false;
    }

    const isZip = file.name.endsWith('.zip') || file.type.includes('zip') || file.type.includes('compressed');
    if (!isZip) {
      setErrorMessage('Chỉ chấp nhận file định dạng nén (.zip)');
      return false;
    }

    return true;
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
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onSubmit(selectedFile);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
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
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: '#ffffff' }}>
          Khu vực nộp bài tập (.zip)
        </h2>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? 'var(--accent-primary)' : selectedFile ? 'var(--accent-emerald)' : 'var(--border-color)'}`,
            borderRadius: '16px',
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(18, 24, 36, 0.5)',
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
            accept=".zip"
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
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
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
              <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-dim)', border: '1px solid var(--border-color)' }}>
                Giới hạn dung lượng: $\le {task.maxSizeMb}$MB
              </span>
            </>
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
          disabled={!selectedFile}
          style={{
            marginTop: '24px',
            width: '100%',
            padding: '14px 24px',
            borderRadius: '12px',
            border: 'none',
            background: selectedFile
              ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
              : 'var(--bg-card)',
            color: selectedFile ? '#ffffff' : 'var(--text-dim)',
            fontSize: '16px',
            fontWeight: 700,
            cursor: selectedFile ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: selectedFile ? '0 10px 25px -5px rgba(99, 102, 241, 0.4)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Send size={18} /> Nộp Bài Chấm Điểm Real-Time
        </button>
      </div>
    </div>
  );
};
