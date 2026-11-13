export interface StatusVisualStyle {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
  severity: 'success' | 'info' | 'warning' | 'danger' | 'critical';
}

export function getSubmissionStatusStyle(
  rawStatus?: string | null,
  options?: {
    score?: number;
    passedTestcases?: number;
    totalTestcases?: number;
    plagiarismFlagged?: boolean;
  }
): StatusVisualStyle {
  const status = String(rawStatus || '').trim().toUpperCase();

  if (
    options?.plagiarismFlagged ||
    status === 'FLAGGED' ||
    status === 'PLAGIARISM_FLAGGED' ||
    status === 'FRAUD'
  ) {
    return {
      label: status === 'FRAUD' ? 'Gian lận' : 'Nghi vấn đạo văn',
      color: '#881337',
      bg: '#ffe4e6',
      border: '#fda4af',
      dot: '#be123c',
      severity: 'critical',
    };
  }

  if (status === 'QUEUED' || status === 'PENDING') {
    return {
      label: 'Đang chờ chấm',
      color: '#0E4274',
      bg: 'rgba(14, 66, 116, 0.09)',
      border: 'rgba(14, 66, 116, 0.25)',
      dot: '#0E4274',
      severity: 'info',
    };
  }

  if (status === 'IN_PROGRESS' || status === 'GRADING' || status === 'RUNNING') {
    return {
      label: 'Đang chấm',
      color: '#1d4ed8',
      bg: 'rgba(29, 78, 216, 0.1)',
      border: 'rgba(29, 78, 216, 0.28)',
      dot: '#2563eb',
      severity: 'info',
    };
  }

  if (status === 'TLE' || status === 'TIME_LIMIT_EXCEEDED') {
    return {
      label: 'Quá thời gian (TLE)',
      color: '#9a3412',
      bg: '#ffedd5',
      border: '#fdba74',
      dot: '#ea580c',
      severity: 'warning',
    };
  }

  if (status === 'MLE' || status === 'MEMORY_LIMIT_EXCEEDED') {
    return {
      label: 'Vượt bộ nhớ (MLE)',
      color: '#92400e',
      bg: '#fef3c7',
      border: '#fcd34d',
      dot: '#d97706',
      severity: 'warning',
    };
  }

  if (status === 'CE' || status === 'COMPILE_ERROR' || status === 'COMPILATION_ERROR') {
    return {
      label: 'Lỗi biên dịch (CE)',
      color: '#991b1b',
      bg: '#fee2e2',
      border: '#fca5a5',
      dot: '#dc2626',
      severity: 'danger',
    };
  }

  if (status === 'RE' || status === 'RUNTIME_ERROR') {
    return {
      label: 'Lỗi thực thi (RE)',
      color: '#991b1b',
      bg: '#fee2e2',
      border: '#fca5a5',
      dot: '#dc2626',
      severity: 'danger',
    };
  }

  if (status === 'REJECTED') {
    return {
      label: 'Từ chối',
      color: '#991b1b',
      bg: '#fee2e2',
      border: '#fca5a5',
      dot: '#dc2626',
      severity: 'danger',
    };
  }

  if (status === 'PASSED' || status === 'PASS' || status === 'ACCEPTED') {
    return {
      label: 'Đạt',
      color: '#15803d',
      bg: '#dcfce7',
      border: '#86efac',
      dot: '#16a34a',
      severity: 'success',
    };
  }

  if (status === 'PARTIAL') {
    return {
      label: 'Đạt một phần',
      color: '#92400e',
      bg: '#fef3c7',
      border: '#fcd34d',
      dot: '#d97706',
      severity: 'warning',
    };
  }

  if (status === 'COMPLETED') {
    if (options?.score !== undefined) {
      if (options.score >= 8.0) {
        return {
          label: 'Hoàn thành xuất sắc',
          color: '#15803d',
          bg: '#dcfce7',
          border: '#86efac',
          dot: '#16a34a',
          severity: 'success',
        };
      }
      if (options.score >= 5.0) {
        return {
          label: 'Đạt yêu cầu',
          color: '#166534',
          bg: '#ecfdf5',
          border: '#6ee7b7',
          dot: '#10b981',
          severity: 'success',
        };
      }
      if (options.score > 0) {
        return {
          label: 'Chưa đạt',
          color: '#b45309',
          bg: '#fef3c7',
          border: '#fcd34d',
          dot: '#f59e0b',
          severity: 'warning',
        };
      }
      return {
        label: 'Chưa đạt (0đ)',
        color: '#b91c1c',
        bg: '#fee2e2',
        border: '#fca5a5',
        dot: '#dc2626',
        severity: 'danger',
      };
    }
    return {
      label: 'Hoàn tất',
      color: '#15803d',
      bg: '#dcfce7',
      border: '#86efac',
      dot: '#16a34a',
      severity: 'success',
    };
  }

  if (status === 'FAILED' || status === 'FAIL' || status === 'WRONG_ANSWER' || status === 'WA') {
    return {
      label: 'Chưa đạt',
      color: '#b91c1c',
      bg: '#fee2e2',
      border: '#fca5a5',
      dot: '#dc2626',
      severity: 'danger',
    };
  }

  return {
    label: status || 'Không rõ',
    color: '#0E4274',
    bg: 'rgba(14, 66, 116, 0.08)',
    border: 'rgba(14, 66, 116, 0.2)',
    dot: '#0E4274',
    severity: 'info',
  };
}

