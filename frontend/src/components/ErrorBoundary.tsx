import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AITA ErrorBoundary] Caught runtime exception:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('aita_published_assignments');
      localStorage.removeItem('aita_cached_courses');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0b1220',
            color: '#f8fafc',
            padding: '24px',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '640px',
              width: '100%',
              backgroundColor: '#111827',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Đã xảy ra sự cố hiển thị giao diện
                </h2>
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                  Hệ thống AITA đã kích hoạt cơ chế bảo vệ phiên làm việc.
                </p>
              </div>
            </div>

            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                marginBottom: '20px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: '#fca5a5',
                overflowX: 'auto',
                maxHeight: '160px',
              }}
            >
              {this.state.error?.message || 'Lỗi không xác định'}
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <RefreshCw size={15} /> Tải lại trang
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Trash2 size={15} /> Khôi phục bộ nhớ đệm & Tải lại
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
