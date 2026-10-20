/**
 * Biểu tượng định dạng tệp — dùng đúng màu nhận diện của từng định dạng.
 *
 * Đây là ngoại lệ có chủ đích với bảng 3 màu: người dùng nhận ra định dạng tệp
 * qua màu (Excel xanh lá, CSV xanh dương, ZIP vàng...). Tô tất cả thành một màu
 * xanh thì mất khả năng phân biệt bằng mắt.
 */
import React from 'react';

type FileKind = 'excel' | 'csv' | 'zip' | 'code' | 'pdf' | 'file';

const KIND: Record<FileKind, { bg: string; fg: string; ext: string }> = {
  excel: { bg: '#217346', fg: '#ffffff', ext: 'XLSX' },
  csv: { bg: '#1d6f42', fg: '#ffffff', ext: 'CSV' },
  zip: { bg: '#f0b429', fg: '#3d2c00', ext: 'ZIP' },
  code: { bg: '#2563eb', fg: '#ffffff', ext: 'CODE' },
  pdf: { bg: '#d93025', fg: '#ffffff', ext: 'PDF' },
  file: { bg: '#5f6368', fg: '#ffffff', ext: 'FILE' },
};

export const detectFileKind = (name?: string): FileKind => {
  const n = (name || '').toLowerCase();
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) return 'excel';
  if (n.endsWith('.csv')) return 'csv';
  if (n.endsWith('.zip') || n.endsWith('.rar') || n.endsWith('.7z')) return 'zip';
  if (n.endsWith('.java') || n.endsWith('.py') || n.endsWith('.cpp') || n.endsWith('.js')) return 'code';
  if (n.endsWith('.pdf')) return 'pdf';
  return 'file';
};

interface FileTypeIconProps {
  /** Tên tệp để tự suy ra định dạng. */
  fileName?: string;
  /** Ép định dạng thủ công. */
  kind?: FileKind;
  /** Cạnh của ô icon (px). */
  size?: number;
  /** Hiện chữ phần mở rộng bên trong ô hay chỉ hiện ký hiệu. */
  showExt?: boolean;
  style?: React.CSSProperties;
}

export const FileTypeIcon: React.FC<FileTypeIconProps> = ({
  fileName,
  kind,
  size = 28,
  showExt = true,
  style,
}) => {
  const k = KIND[kind || detectFileKind(fileName)] ?? KIND.file;
  const radius = Math.max(3, Math.round(size * 0.18));

  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: `${radius}px`,
        backgroundColor: k.bg,
        color: k.fg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: `${Math.max(7, Math.round(size * 0.29))}px`,
        fontWeight: 700,
        letterSpacing: '0.02em',
        lineHeight: 1,
        fontFamily: 'var(--font-mono)',
        ...style,
      }}
    >
      {showExt ? k.ext : ''}
    </span>
  );
};

export default FileTypeIcon;
