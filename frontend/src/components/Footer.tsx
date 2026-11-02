import React from 'react';
import {
  Terminal,
  BookOpen,
  Mail,
  ShieldCheck,
  Cpu,
  GraduationCap,
  ExternalLink,
  Code2,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';

const GithubIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export const Footer: React.FC = () => {
  return (
    <footer className="aita-pro-footer">
      <style>{`
        .aita-pro-footer {
          background: #ffffff;
          border-top: 1px solid var(--border-color, rgba(11, 18, 32, 0.1));
          color: var(--text-soft, #33415a);
          font-family: var(--font-sans, inherit);
          position: relative;
          overflow: hidden;
          margin-top: auto;
        }

        .aita-pro-footer::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(37, 99, 235, 0.45), transparent);
        }

        .footer-wrapper {
          max-width: 1320px;
          margin: 0 auto;
          padding: 44px 24px 24px;
        }

        .footer-top-grid {
          display: grid;
          grid-template-columns: 2fr 1.2fr 1.2fr 1.4fr;
          gap: 36px;
          padding-bottom: 36px;
          border-bottom: 1px solid var(--border-soft, rgba(11, 18, 32, 0.06));
        }

        @media (max-width: 1024px) {
          .footer-top-grid {
            grid-template-columns: 1fr 1fr;
            gap: 28px;
          }
        }

        @media (max-width: 640px) {
          .footer-top-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .footer-wrapper {
            padding: 32px 16px 20px;
          }
        }

        .footer-brand {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .footer-logo-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .footer-logo-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: var(--blue-600, #2563eb);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px -2px rgba(37, 99, 235, 0.35);
        }

        .footer-brand-title {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-main, #0b1220);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .footer-version-tag {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 2px 7px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.08);
          color: var(--blue-600, #2563eb);
          border: 1px solid rgba(37, 99, 235, 0.2);
        }

        .footer-desc {
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-dim, #5c6b80);
          max-width: 340px;
        }

        .footer-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 4px;
        }

        .footer-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          background: rgba(11, 18, 32, 0.03);
          border: 1px solid var(--border-soft, rgba(11, 18, 32, 0.06));
          color: var(--text-muted, #4d5c76);
          transition: border-color .15s ease, background .15s ease;
        }

        .footer-badge:hover {
          background: rgba(37, 99, 235, 0.05);
          border-color: rgba(37, 99, 235, 0.25);
          color: var(--blue-600, #2563eb);
        }

        .footer-col-title {
          font-size: 12.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-main, #0b1220);
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .footer-nav-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .footer-nav-link {
          font-size: 13px;
          color: var(--text-muted, #4d5c76);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: color .15s ease, transform .15s ease;
        }

        .footer-nav-link:hover {
          color: var(--blue-600, #2563eb);
          transform: translateX(2px);
        }

        .footer-nav-link svg {
          opacity: 0.7;
          transition: opacity .15s ease;
        }

        .footer-nav-link:hover svg {
          opacity: 1;
        }

        .footer-info-card {
          background: #f8fafc;
          border: 1px solid var(--border-soft, rgba(11, 18, 32, 0.06));
          border-radius: 10px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .footer-info-item {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          font-size: 12px;
          color: var(--text-soft, #33415a);
          line-height: 1.45;
        }

        .footer-info-item svg {
          flex-shrink: 0;
          margin-top: 2px;
          color: var(--blue-600, #2563eb);
        }

        .footer-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          font-weight: 600;
          color: #166534;
          background: rgba(22, 101, 52, 0.08);
          border: 1px solid rgba(22, 101, 52, 0.2);
          padding: 4px 10px;
          border-radius: 999px;
          margin-top: 2px;
          width: fit-content;
        }

        .footer-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #16a34a;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.25);
          animation: pulseDot 2s infinite ease-in-out;
        }

        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }

        .footer-bottom-bar {
          padding-top: 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          font-size: 12px;
          color: var(--text-dim, #5c6b80);
        }

        .footer-bottom-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .footer-bottom-links {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .footer-bottom-link {
          color: var(--text-muted, #4d5c76);
          text-decoration: none;
          font-weight: 500;
          transition: color .15s ease;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .footer-bottom-link:hover {
          color: var(--blue-600, #2563eb);
        }

        .footer-credit-chip {
          background: rgba(11, 18, 32, 0.04);
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          color: var(--text-soft, #33415a);
          border: 1px solid var(--border-soft, rgba(11, 18, 32, 0.05));
        }
      `}</style>

      <div className="footer-wrapper">
        {/* KHỐI NỘI DUNG 4 CỘT CHUYÊN NGHIỆP */}
        <div className="footer-top-grid">
          {/* CỘT 1: THƯƠNG HIỆU & GIỚI THIỆU */}
          <div className="footer-brand">
            <div className="footer-logo-row">
              <div className="footer-logo-icon">
                <Terminal size={18} strokeWidth={2.4} />
              </div>
              <span className="footer-brand-title">
                AITA
              </span>
            </div>

            <p className="footer-desc">
              Hệ thống chấm điểm tự động &amp; giám sát liêm chính học thuật thế hệ mới.
              Tích hợp Docker Sandbox cách ly bảo mật và thuật toán phát hiện đạo văn AST Winnowing.
            </p>

            <div className="footer-badges">
              <span className="footer-badge" title="Môi trường chấm an toàn cách ly seccomp">
                <ShieldCheck size={12} color="#2563eb" /> Docker Sandbox
              </span>
              <span className="footer-badge" title="Thuật toán đối soát cây cú pháp trừu tượng">
                <Cpu size={12} color="#2563eb" /> AST Winnowing
              </span>
              <span className="footer-badge" title="Phân tích chất lượng mã nguồn & hướng đối tượng">
                <Code2 size={12} color="#2563eb" /> SOLID &amp; Clean Code
              </span>
            </div>
          </div>

          {/* CỘT 2: TÀI NGUYÊN & LIÊN KẾT HỆ THỐNG */}
          <div>
            <h4 className="footer-col-title">
              <BookOpen size={14} color="#2563eb" />
              Tài nguyên
            </h4>
            <ul className="footer-nav-list">
              <li>
                <a
                  href="https://github.com/FPT-Software/AITA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-nav-link"
                >
                  <GithubIcon size={14} />
                  GitHub Repository
                  <ExternalLink size={11} style={{ opacity: 0.5 }} />
                </a>
              </li>
              <li>
                <a
                  href="/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-nav-link"
                >
                  <BookOpen size={14} />
                  Tài liệu Hướng dẫn (Docs)
                  <ExternalLink size={11} style={{ opacity: 0.5 }} />
                </a>
              </li>
              <li>
                <a
                  href="mailto:contact@aita.edu.vn"
                  className="footer-nav-link"
                >
                  <Mail size={14} />
                  Hỗ trợ kỹ thuật (Contact)
                </a>
              </li>
            </ul>
          </div>

          {/* CỘT 3: TÍNH NĂNG CHÍNH */}
          <div>
            <h4 className="footer-col-title">
              <FileCheck2 size={14} color="#2563eb" />
              Tính năng
            </h4>
            <ul className="footer-nav-list">
              <li>
                <span className="footer-nav-link" style={{ cursor: 'default' }}>
                  <CheckCircle2 size={13} color="#16a34a" /> Chấm điểm Realtime Socket.IO
                </span>
              </li>
              <li>
                <span className="footer-nav-link" style={{ cursor: 'default' }}>
                  <CheckCircle2 size={13} color="#16a34a" /> Đối soát đạo văn phân cụm AST
                </span>
              </li>
              <li>
                <span className="footer-nav-link" style={{ cursor: 'default' }}>
                  <CheckCircle2 size={13} color="#16a34a" /> Hỗ trợ Java, C++, Python, .NET
                </span>
              </li>
              <li>
                <span className="footer-nav-link" style={{ cursor: 'default' }}>
                  <CheckCircle2 size={13} color="#16a34a" /> Cổng phúc khảo điểm minh bạch
                </span>
              </li>
            </ul>
          </div>

          {/* CỘT 4: ĐƠN VỊ PHÁT TRIỂN & TRẠNG THÁI */}
          <div>
            <h4 className="footer-col-title">
              <GraduationCap size={15} color="#2563eb" />
              Đơn vị phát triển
            </h4>
            <div className="footer-info-card">
              <div className="footer-info-item">
                <GraduationCap size={15} />
                <div>
                  <strong>Team 4 – FPT University</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim, #5c6b80)' }}>
                    Bộ môn Kỹ thuật Phần mềm (SWP391)
                  </div>
                </div>
              </div>

              <div className="footer-info-item">
                <Mail size={14} />
                <a
                  href="mailto:contact@aita.edu.vn"
                  style={{ color: 'var(--blue-600, #2563eb)', textDecoration: 'none', fontWeight: 500 }}
                >
                  contact@aita.edu.vn
                </a>
              </div>

              <div className="footer-status-pill">
                <span className="footer-status-dot" />
                Hệ thống sẵn sàng chấm bài
              </div>
            </div>
          </div>
        </div>

        {/* THANH CHÂN TRANG DƯỚI CÙNG (COPYRIGHT & DIRECT ACCESS) */}
        <div className="footer-bottom-bar">
          <div className="footer-bottom-left">
            <span>AITA – Intelligent Automated Grading Platform © 2026</span>
          </div>

          <div className="footer-bottom-links">
            <a
              href="https://github.com/FPT-Software/AITA"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-bottom-link"
            >
              <GithubIcon size={13} />
              GitHub
            </a>
            <span style={{ opacity: 0.3 }}>•</span>
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-bottom-link"
            >
              <BookOpen size={13} />
              Docs
            </a>
            <span style={{ opacity: 0.3 }}>•</span>
            <a
              href="mailto:contact@aita.edu.vn"
              className="footer-bottom-link"
            >
              <Mail size={13} />
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
