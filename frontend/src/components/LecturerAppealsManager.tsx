import React, { useState, useEffect } from 'react';
import {
  Scale,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  Award,
  Code,
  Cpu,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  FileCode,
  Terminal,
  AlertTriangle,
  Download,
  Copy,
  Check,
  FileText,
  X,
  ExternalLink,
} from 'lucide-react';
import type { Appeal } from '../types';

interface LecturerAppealsManagerProps {
  apiBaseUrl?: string;
  lecturerId?: string;
}

export const LecturerAppealsManager: React.FC<LecturerAppealsManagerProps> = ({
  apiBaseUrl = 'http://localhost:3000',
  lecturerId = 'GV001',
}) => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACCEPTED' | 'REJECTED'>('ALL');
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [resolutionNote, setResolutionNote] = useState('');
  const [adjustedScore, setAdjustedScore] = useState<number>(9.0);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Thẩm định chi tiết: Tab & dữ liệu bài nộp
  const [activeModalTab, setActiveModalTab] = useState<'CODE' | 'TESTCASES' | 'AI_REVIEW' | 'PLAGIARISM'>('CODE');
  const [copiedCode, setCopiedCode] = useState(false);
  const [submissionDetail, setSubmissionDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appeals`);
      if (res.ok) {
        const json = await res.json();
        setAppeals(json.data || []);
      } else {
        throw new Error('API offline');
      }
    } catch {
      // Mock data đầy đủ nếu API gateway offline
      setAppeals([
        {
          appealId: 'APL-516461-XLGA',
          submissionId: 'SUB-568109-BVD74X',
          studentId: 'phaithayj@gmail.com',
          reason: 'Kính gửi Thầy, bài của em đã giải thuật toán O(N log N) bằng QuickSort phân vùng Hoare và testcase chạy rất nhanh (131ms), nhưng Testcase 2 em bị chấm trượt do timeout 2.0s trên hệ thống cũ. Mong Thầy xem lại mã nguồn và phúc khảo giúp em ạ.',
          status: 'PENDING',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          appealId: 'APL-101-DEMO',
          submissionId: 'SUB-SE170000-01',
          studentId: 'SE170000',
          reason: 'Kính gửi Thầy, bài của em đã tối ưu O(N log N) bằng thuật toán MergeSort nhưng AI chấm điểm SOLID bị trừ 1.5đ ở hàm hiển thị, mong Thầy chấm lại.',
          status: 'PENDING',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
        {
          appealId: 'APL-102-DEMO',
          submissionId: 'SUB-SE170456-02',
          studentId: 'SE170456',
          reason: 'Em xin phúc khảo Testcase 2, em chạy trên Ubuntu local thì PASS nhưng server báo timeout 2.0s.',
          status: 'ACCEPTED',
          reviewerId: 'GV001',
          resolutionNote: 'Đã phúc tra trong Docker sandbox: bộ nhớ đạt 512MB, thuật toán tối ưu chuẩn, chấp thuận cộng thêm 1.0 điểm.',
          adjustedScore: 8.5,
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 80000000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAppeals();
  }, []);

  // Tải chi tiết bài nộp khi mở modal phúc khảo
  useEffect(() => {
    if (!selectedAppeal) {
      setSubmissionDetail(null);
      return;
    }

    const fetchSubDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/submissions/${selectedAppeal.submissionId}`);
        if (res.ok) {
          const json = await res.json();
          setSubmissionDetail(json.data || null);
        } else {
          setSubmissionDetail(null);
        }
      } catch {
        setSubmissionDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    };

    void fetchSubDetail();
  }, [selectedAppeal, apiBaseUrl]);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppeal) return;
    if (resolutionNote.trim().length < 5) {
      alert('Vui lòng nhập phản hồi giải quyết cụ thể (tối thiểu 5 ký tự)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/appeals/${selectedAppeal.appealId}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: resolveStatus,
          reviewerId: lecturerId,
          resolutionNote: resolutionNote.trim(),
          adjustedScore: resolveStatus === 'ACCEPTED' ? adjustedScore : undefined,
        }),
      });

      if (res.ok) {
        setToastMessage(`Đã xử lý thành công đơn phúc khảo #${selectedAppeal.appealId}`);
        setSelectedAppeal(null);
        setResolutionNote('');
        void fetchAppeals();
      } else {
        const err = await res.json();
        alert(err.message || 'Lỗi khi cập nhật đơn phúc khảo');
      }
    } catch {
      // Mock local update
      setAppeals((prev) =>
        prev.map((a) =>
          a.appealId === selectedAppeal.appealId
            ? {
                ...a,
                status: resolveStatus,
                reviewerId: lecturerId,
                resolutionNote: resolutionNote.trim(),
                adjustedScore: resolveStatus === 'ACCEPTED' ? adjustedScore : undefined,
                resolvedAt: new Date().toISOString(),
              }
            : a,
        ),
      );
      setToastMessage(`Đã cập nhật quyết định phúc khảo đơn #${selectedAppeal.appealId}`);
      setSelectedAppeal(null);
      setResolutionNote('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredAppeals = appeals.filter((a) => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  // Dữ liệu thẩm định đầy đủ (kết hợp API thật + mock tiêu chuẩn nếu offline)
  const getAuditData = () => {
    if (!selectedAppeal) return null;
    const details = submissionDetail?.details || submissionDetail?.result || {};

    const studentEmail = selectedAppeal.studentId;
    const isPhaithay = studentEmail.includes('phaithayj');

    const sourceCode =
      details?.plagiarismMatch?.sourceCodeA ||
      `// ================================================================
// MA NGUON NOP BAI: ${selectedAppeal.submissionId}
// Sinh vien: ${studentEmail}
// Bai tap: ASM-SWP-01 (Thuat toan Sap xep O(N log N))
// Ngon ngu: Java 17 (OpenJDK)
// ================================================================
package com.aita.sorting;

import java.util.Scanner;

public class Solution {
    // Thuat toan QuickSort toi uu phan vung Hoare O(N log N)
    public static void quickSort(int[] arr, int low, int high) {
        if (low < high) {
            int pi = partition(arr, low, high);
            quickSort(arr, low, pi);
            quickSort(arr, pi + 1, high);
        }
    }

    private static int partition(int[] arr, int low, int high) {
        int pivot = arr[low + (high - low) / 2];
        int i = low - 1;
        int j = high + 1;
        while (true) {
            do { i++; } while (arr[i] < pivot);
            do { j--; } while (arr[j] > pivot);
            if (i >= j) return j;
            int temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
    }

    // Ham xu ly xuat ket qua (Single Responsibility)
    public static void sortAndDisplay(int[] arr) {
        quickSort(arr, 0, arr.length - 1);
        for (int i = 0; i < arr.length; i++) {
            System.out.print(arr[i] + (i < arr.length - 1 ? " " : "\\n"));
        }
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int n = sc.nextInt();
        int[] a = new int[n];
        for (int i = 0; i < n; i++) {
            a[i] = sc.nextInt();
        }
        sortAndDisplay(a);
    }
}`;

    const originalScore = submissionDetail?.score ?? (isPhaithay ? 7.0 : 6.5);
    const passedTestcases = details?.passedTestcases ?? 2;
    const totalTestcases = details?.totalTestcases ?? 2;

    const testcases = [
      {
        id: 'TC-01',
        title: 'Mẫu I/O cơ bản (6 phần tử ngẫu nhiên)',
        input: '6\\n5 2 9 1 5 6',
        expected: '1 2 5 5 6 9',
        actual: '1 2 5 5 6 9',
        status: 'PASSED',
        timeMs: 68,
        memoryMb: 36,
        score: 4.0,
        maxScore: 4.0,
      },
      {
        id: 'TC-02',
        title: 'Hidden Benchmark O(N log N) - 100,000 phần tử ngẫu nhiên',
        input: '100000\\n[Array 100,000 integers in range -10^6..10^6]',
        expected: '100,000 số nguyên sắp xếp tăng dần, thời gian < 2000ms',
        actual: 'Sắp xếp chính xác 100% trong 131ms',
        status: details?.passedTestcases === 1 ? 'FAILED' : 'PASSED',
        timeMs: 131,
        memoryMb: 94,
        score: details?.passedTestcases === 1 ? 0 : 3.0,
        maxScore: 3.0,
      },
    ];

    const aiRating = details?.aiRating || {
      cleanCodeScore: 8.5,
      solidScore: { s: 7.0, o: 9.0, l: 8.5, i: 9.0, d: 8.0 },
      explanation:
        'Mã nguồn sinh viên áp dụng thuật toán QuickSort phân vùng Hoare đạt hiệu năng tối ưu O(N log N). Thuật toán hoạt động ổn định trên tập dữ liệu lớn. Tuy nhiên, hàm sortAndDisplay đang gộp cả tác vụ sắp xếp và xuất dữ liệu ra console, vi phạm nguyên tắc Đơn trách nhiệm (SRP).',
      codeSmells: [
        {
          line: 29,
          rule: 'Single Responsibility Principle (SRP)',
          description: 'Hàm sortAndDisplay vừa thực hiện gọi sắp xếp mảng vừa đảm nhận việc in kết quả ra System.out.',
        },
        {
          line: 36,
          rule: 'Resource Leak Warning',
          description: 'Đối tượng Scanner chưa được bọc trong khối try-with-resources để tự động đóng luồng dữ liệu.',
        },
      ],
    };

    const plagiarism = details?.plagiarismMatch || {
      matchedStudentName: 'Trần Thanh Nguyên',
      matchedStudentId: 'SE170123',
      similarityRate: 14.2,
      astStructuralSimilarity: 12.8,
      winnowingContainment: 15.0,
      isFlagged: false,
      comparedSubmissionsCount: 15,
      verdict: 'Mã nguồn có tính độc lập cao. Cấu trúc cây cú pháp AST nguyên bản, không phát hiện dấu hiệu sao chép trái phép.',
    };

    return {
      studentEmail,
      submissionId: selectedAppeal.submissionId,
      assignmentTitle: 'ASM-SWP-01 - Thuật toán Sắp xếp O(N log N)',
      originalScore,
      sourceCode,
      testcases,
      passedTestcases,
      totalTestcases,
      aiRating,
      plagiarism,
      sandbox: {
        mode: 'DOCKER_SECCOMP',
        memoryLimit: '512 MB',
        pidsLimit: 64,
        networkMode: 'none',
        watchdogSec: '2.0s',
        teardownMs: 122,
      },
    };
  };

  const auditData = getAuditData();

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
            HỘI ĐỒNG PHÚC KHẢO (UC-06 / BR-05)
          </span>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
            Quản Lý &amp; Thẩm Định Đơn Phúc Khảo
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Xem toàn diện mã nguồn, kết quả chạy testcase, nhận xét AI và báo cáo đạo văn trước khi quyết định điểm số.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchAppeals}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>
      </div>

      {toastMessage && (
        <div style={{ padding: '12px 18px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '14px', marginBottom: '20px', fontWeight: 600 }}>
          {toastMessage}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {(['ALL', 'PENDING', 'ACCEPTED', 'REJECTED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: statusFilter === tab ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: statusFilter === tab ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              color: statusFilter === tab ? '#ffffff' : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {tab === 'ALL' && `Tất Cả (${appeals.length})`}
            {tab === 'PENDING' && `Chờ Duyệt (${appeals.filter((a) => a.status === 'PENDING').length})`}
            {tab === 'ACCEPTED' && `Đã Chấp Thuận (${appeals.filter((a) => a.status === 'ACCEPTED').length})`}
            {tab === 'REJECTED' && `Đã Từ Chối (${appeals.filter((a) => a.status === 'REJECTED').length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>MÃ ĐƠN</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>SINH VIÊN</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>BÀI NỘP</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>LÝ DO KHIẾU NẠI</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>TRẠNG THÁI</th>
              <th style={{ padding: '16px 20px', color: '#94a3b8', fontWeight: 700 }}>THẨM ĐỊNH &amp; XỬ LÝ</th>
            </tr>
          </thead>
          <tbody>
            {filteredAppeals.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Không có đơn phúc khảo nào trong danh mục này.
                </td>
              </tr>
            ) : (
              filteredAppeals.map((app) => (
                <tr key={app.appealId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <td style={{ padding: '16px 20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#818cf8' }}>
                    #{app.appealId}
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: '#ffffff' }}>
                    {app.studentId}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
                    {app.submissionId}
                  </td>
                  <td style={{ padding: '16px 20px', maxWidth: '300px', color: '#cbd5e1' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={app.reason}>
                      {app.reason}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    {app.status === 'ACCEPTED' ? (
                      <span style={{ padding: '4px 10px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700 }}>
                        ĐÃ DUYỆT ({app.adjustedScore}đ)
                      </span>
                    ) : app.status === 'REJECTED' ? (
                      <span style={{ padding: '4px 10px', borderRadius: '10px', backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', fontWeight: 700 }}>
                        TỪ CHỐI
                      </span>
                    ) : (
                      <span style={{ padding: '4px 10px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontWeight: 700 }}>
                        CHỜ DUYỆT
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <button
                      onClick={() => {
                        setSelectedAppeal(app);
                        setResolveStatus('ACCEPTED');
                        setResolutionNote(app.resolutionNote || '');
                        setAdjustedScore(app.adjustedScore || 9.0);
                        setActiveModalTab('CODE');
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        backgroundColor: app.status === 'PENDING' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(99, 102, 241, 0.5)',
                        color: '#a5b4fc',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Scale size={13} />
                      {app.status === 'PENDING' ? 'Thẩm Định & Xử Lý' : 'Xem Chi Tiết'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ==================================================================== */}
      {/* MODAL TOÀN DIỆN: THẨM ĐỊNH MÃ NGUỒN, TESTCASE, AI REVIEW, ĐẠO VĂN   */}
      {/* ==================================================================== */}
      {selectedAppeal && auditData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedAppeal(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '1080px',
              maxHeight: '92vh',
              overflowY: 'auto',
              backgroundColor: '#0b1120',
              borderRadius: '24px',
              padding: '28px 32px',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(99, 102, 241, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                    }}
                  >
                    HỒ SƠ PHÚC KHẢO ĐIỆN TỬ
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>•</span>
                  <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                    Ngày gửi: {new Date(selectedAppeal.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Thẩm Định Đơn Phúc Khảo #{selectedAppeal.appealId}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAppeal(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  padding: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Thông tin tóm tắt & Lý do sinh viên */}
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '16px',
                padding: '18px 20px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Sinh viên khiếu nại</span>
                  <strong style={{ fontSize: '14px', color: '#ffffff' }}>{auditData.studentEmail}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Mã bài nộp</span>
                  <strong style={{ fontSize: '14px', color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>{auditData.submissionId}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Bài tập</span>
                  <strong style={{ fontSize: '14px', color: '#cbd5e1' }}>{auditData.assignmentTitle}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Điểm gốc ban đầu</span>
                  <span style={{ fontSize: '15px', color: '#f59e0b', fontWeight: 800 }}>{auditData.originalScore} / 10.0</span>
                </div>
              </div>

              {/* Hộp lý do của SV */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', marginTop: '2px' }}>
                  <MessageSquare size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', color: '#a5b4fc', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                    LÝ DO &amp; NGUYỆN VỌNG CỦA SINH VIÊN:
                  </span>
                  <p style={{ fontSize: '13.5px', color: '#f1f5f9', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
                    "{selectedAppeal.reason}"
                  </p>
                </div>
              </div>
            </div>

            {/* 4 Tabs Thẩm Định Chuyên Sâu */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveModalTab('CODE')}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: activeModalTab === 'CODE' ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: activeModalTab === 'CODE' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  color: activeModalTab === 'CODE' ? '#ffffff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Code size={16} color={activeModalTab === 'CODE' ? '#818cf8' : '#94a3b8'} />
                1. Mã Nguồn Đã Nộp
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('TESTCASES')}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: activeModalTab === 'TESTCASES' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: activeModalTab === 'TESTCASES' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: activeModalTab === 'TESTCASES' ? '#ffffff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Terminal size={16} color={activeModalTab === 'TESTCASES' ? '#10b981' : '#94a3b8'} />
                2. Test Cases &amp; Sandbox ({auditData.passedTestcases}/{auditData.totalTestcases})
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('AI_REVIEW')}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: activeModalTab === 'AI_REVIEW' ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: activeModalTab === 'AI_REVIEW' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: activeModalTab === 'AI_REVIEW' ? '#ffffff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={16} color={activeModalTab === 'AI_REVIEW' ? '#f59e0b' : '#94a3b8'} />
                3. AI Đánh Giá &amp; SOLID
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('PLAGIARISM')}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: activeModalTab === 'PLAGIARISM' ? '1px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: activeModalTab === 'PLAGIARISM' ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: activeModalTab === 'PLAGIARISM' ? '#ffffff' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShieldCheck size={16} color={activeModalTab === 'PLAGIARISM' ? '#ec4899' : '#94a3b8'} />
                4. Kiểm Tra Đạo Văn (Moss/AST)
              </button>
            </div>

            {/* Nội dung TAB 1: MÃ NGUỒN ĐÃ NỘP */}
            {activeModalTab === 'CODE' && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    padding: '10px 16px',
                    borderRadius: '12px 12px 0 0',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderBottom: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCode size={16} color="#818cf8" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                      Solution.java
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                      Java 17 (UTF-8)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(auditData.sourceCode)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: copiedCode ? '#34d399' : '#e2e8f0',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                      {copiedCode ? 'Đã sao chép' : 'Sao chép mã'}
                    </button>

                    <a
                      href={`${apiBaseUrl}/api/v1/submissions/${selectedAppeal.submissionId}/download`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        color: '#a5b4fc',
                        fontSize: '12px',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <Download size={13} />
                      Tải file .zip gốc
                    </a>
                  </div>
                </div>

                {/* Editor Container */}
                <div
                  style={{
                    backgroundColor: '#030712',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0 0 12px 12px',
                    padding: '16px',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '12.5px',
                    lineHeight: '1.6',
                    color: '#e2e8f0',
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {auditData.sourceCode}
                  </pre>
                </div>
              </div>
            )}

            {/* Nội dung TAB 2: TEST CASES & SANDBOX */}
            {activeModalTab === 'TESTCASES' && (
              <div>
                {/* Thông số Sandbox */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>MÔI TRƯỜNG SANDBOX</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                      Docker (cgroups v2)
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>QUOTA BỘ NHỚ RAM</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginTop: '2px' }}>
                      {auditData.sandbox.memoryLimit}
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>WATCHDOG TIMEOUT</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', marginTop: '2px' }}>
                      {auditData.sandbox.watchdogSec} (SIGKILL)
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>BẢO MẬT &amp; SECCOMP</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                      PidsLimit=64, Net=None
                    </div>
                  </div>
                </div>

                {/* Danh sách Testcases */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {auditData.testcases.map((tc) => (
                    <div
                      key={tc.id}
                      style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.65)',
                        border: tc.status === 'PASSED' ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid rgba(244, 63, 94, 0.35)',
                        borderRadius: '12px',
                        padding: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.08)', color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
                            {tc.id}
                          </span>
                          <strong style={{ fontSize: '13.5px', color: '#ffffff' }}>{tc.title}</strong>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Thời gian: <strong style={{ color: '#fff' }}>{tc.timeMs}ms</strong></span>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>RAM: <strong style={{ color: '#fff' }}>{tc.memoryMb}MB</strong></span>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 800,
                              padding: '3px 10px',
                              borderRadius: '12px',
                              backgroundColor: tc.status === 'PASSED' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                              color: tc.status === 'PASSED' ? '#34d399' : '#f43f5e',
                            }}
                          >
                            {tc.status === 'PASSED' ? `PASSED (+${tc.score}đ)` : 'FAILED (0.0đ)'}
                          </span>
                        </div>
                      </div>

                      {/* Chi tiết I/O */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                        <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Dữ liệu đầu vào (Input):</span>
                          <code style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>{tc.input}</code>
                        </div>
                        <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ color: '#94a3b8', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Kết quả thực tế (Actual Output):</span>
                          <code style={{ color: tc.status === 'PASSED' ? '#4ade80' : '#f87171', fontFamily: 'var(--font-mono)' }}>{tc.actual}</code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nội dung TAB 3: AI ĐÁNH GIÁ & SOLID */}
            {activeModalTab === 'AI_REVIEW' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '18px', marginBottom: '18px' }}>
                  {/* Cột trái: Điểm số */}
                  <div
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      padding: '18px',
                      borderRadius: '14px',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>ĐIỂM CLEAN CODE</span>
                    <div style={{ fontSize: '38px', fontWeight: 900, color: '#f59e0b', margin: '4px 0' }}>
                      {auditData.aiRating.cleanCodeScore}
                      <span style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 500 }}>/10</span>
                    </div>

                    <div style={{ marginTop: '16px', textAlign: 'left' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                        ĐÁNH GIÁ 5 NGUYÊN LÝ SOLID:
                      </span>
                      {[
                        { label: 'S - Single Responsibility', val: auditData.aiRating.solidScore.s },
                        { label: 'O - Open/Closed Principle', val: auditData.aiRating.solidScore.o },
                        { label: 'L - Liskov Substitution', val: auditData.aiRating.solidScore.l },
                        { label: 'I - Interface Segregation', val: auditData.aiRating.solidScore.i },
                        { label: 'D - Dependency Inversion', val: auditData.aiRating.solidScore.d },
                      ].map((s) => (
                        <div key={s.label} style={{ marginBottom: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#cbd5e1', marginBottom: '2px' }}>
                            <span>{s.label}</span>
                            <strong style={{ color: '#f59e0b' }}>{s.val}/10</strong>
                          </div>
                          <div style={{ width: '100%', height: '5px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${s.val * 10}%`, height: '100%', backgroundColor: s.val >= 8 ? '#10b981' : '#f59e0b' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cột phải: Lời nhận xét sư phạm từ AI & Code Smells */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                        <Sparkles size={16} />
                        Nhận xét sư phạm từ Trí tuệ nhân tạo (GenAI Hub):
                      </div>
                      <p style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.6, margin: 0 }}>
                        {auditData.aiRating.explanation}
                      </p>
                    </div>

                    <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                        <AlertTriangle size={16} />
                        Các điểm cần cải tiến (Code Smells phát hiện qua AST):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {auditData.aiRating.codeSmells.map((smell: any, i: number) => (
                          <div key={i} style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fca5a5', fontWeight: 700, marginBottom: '2px' }}>
                              <span>Dòng {smell.line}: {smell.rule}</span>
                            </div>
                            <div style={{ color: '#e2e8f0' }}>{smell.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Nội dung TAB 4: KIỂM TRA ĐẠO VĂN (MOSS / AST) */}
            {activeModalTab === 'PLAGIARISM' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                  <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>TỈ LỆ TƯƠNG ĐỒNG AST TỔNG THỂ</span>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: auditData.plagiarism.similarityRate > 40 ? '#f43f5e' : '#34d399', margin: '4px 0' }}>
                      {auditData.plagiarism.similarityRate}%
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#a7f3d0', fontWeight: 700 }}>
                      {auditData.plagiarism.similarityRate > 40 ? '🔴 Cảnh Báo Trùng Lặp Cao' : '🟢 An Toàn - Không Vi Phạm'}
                    </span>
                  </div>

                  <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>AST CÂY CÚ PHÁP TRỪU TƯỢNG</span>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', margin: '4px 0' }}>
                      {auditData.plagiarism.astStructuralSimilarity}%
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>So khớp node giải thuật</span>
                  </div>

                  <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>WINNOWING TOKEN CONTAINMENT</span>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#a5b4fc', margin: '4px 0' }}>
                      {auditData.plagiarism.winnowingContainment}%
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Jaccard index n-gram</span>
                  </div>

                  <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>QUY MÔ ĐỐI CHIẾU</span>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', margin: '4px 0' }}>
                      {auditData.plagiarism.comparedSubmissionsCount} bài
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Toàn bộ lớp CRS-SWP391</span>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  <ShieldCheck size={28} color="#34d399" style={{ flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: '14px', color: '#6ee7b7', display: 'block', marginBottom: '2px' }}>
                      KẾT LUẬN LIÊM CHÍNH HỌC THUẬT:
                    </strong>
                    <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: 1.5 }}>
                      {auditData.plagiarism.verdict} Đối tượng có điểm tương đồng gần nhất: <strong>{auditData.plagiarism.matchedStudentName} ({auditData.plagiarism.matchedStudentId})</strong> với tỉ lệ {auditData.plagiarism.similarityRate}% (dưới ngưỡng cảnh báo 40%).
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* KHUNG QUYẾT ĐỊNH CỦA GIẢNG VIÊN                                     */}
            {/* ==================================================================== */}
            <div
              style={{
                marginTop: '24px',
                paddingTop: '20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.12)',
              }}
            >
              <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#ffffff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={18} color="#818cf8" />
                Quyết Định Xử Lý Của Giảng Viên:
              </h4>

              <form onSubmit={handleResolve}>
                {/* 2 Nút Chấp thuận / Từ chối */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setResolveStatus('ACCEPTED')}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '12px',
                      border: resolveStatus === 'ACCEPTED' ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: resolveStatus === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                      color: resolveStatus === 'ACCEPTED' ? '#34d399' : '#94a3b8',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <CheckCircle2 size={18} />
                    Chấp Thuận Phúc Khảo (Cộng / Điều Chỉnh Điểm)
                  </button>

                  <button
                    type="button"
                    onClick={() => setResolveStatus('REJECTED')}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '12px',
                      border: resolveStatus === 'REJECTED' ? '2px solid #f43f5e' : '1px solid rgba(255, 255, 255, 0.1)',
                      backgroundColor: resolveStatus === 'REJECTED' ? 'rgba(244, 63, 94, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                      color: resolveStatus === 'REJECTED' ? '#f43f5e' : '#94a3b8',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <XCircle size={18} />
                    Từ Chối Khiếu Nại (Giữ Nguyên Điểm Gốc)
                  </button>
                </div>

                {/* Nếu chấp thuận -> Nhập điểm điều chỉnh */}
                {resolveStatus === 'ACCEPTED' && (
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '16px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '13.5px', fontWeight: 700, color: '#34d399' }}>
                        Điểm số điều chỉnh sau phúc khảo (Thang điểm 0.0 - 10.0):
                      </label>
                      <span style={{ fontSize: '12.5px', color: '#a7f3d0' }}>
                        Điểm gốc: <strong style={{ color: '#fff' }}>{auditData.originalScore}</strong> ➔ Điểm mới:{' '}
                        <strong style={{ color: '#34d399' }}>{adjustedScore}</strong>{' '}
                        ({adjustedScore >= auditData.originalScore ? `+${(adjustedScore - auditData.originalScore).toFixed(1)}` : (adjustedScore - auditData.originalScore).toFixed(1)} đ)
                      </span>
                    </div>

                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={adjustedScore}
                      onChange={(e) => setAdjustedScore(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: '#030712',
                        border: '1px solid rgba(52, 211, 153, 0.4)',
                        color: '#34d399',
                        fontSize: '16px',
                        fontWeight: 800,
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                )}

                {/* Ô phản hồi sư phạm */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                    Phản hồi sư phạm / Căn cứ giải quyết (Gửi trực tiếp đến sinh viên):
                  </label>
                  <textarea
                    rows={3}
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    placeholder="Ví dụ: Đã đối chiếu mã nguồn QuickSort và kiểm tra lại log Docker Sandbox; thuật toán đạt O(N log N) chuẩn xác, không có dấu hiệu đạo văn. Chấp thuận cộng 2.0 điểm..."
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                      lineHeight: '1.5',
                    }}
                  />
                </div>

                {/* Nút hành động cuối */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedAppeal(null)}
                    style={{
                      padding: '11px 20px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      color: '#cbd5e1',
                      fontWeight: 600,
                      fontSize: '13.5px',
                      cursor: 'pointer',
                    }}
                  >
                    Đóng / Hủy
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: '11px 24px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: resolveStatus === 'ACCEPTED' ? '#10b981' : '#f43f5e',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: resolveStatus === 'ACCEPTED' ? '0 4px 20px rgba(16, 185, 129, 0.35)' : '0 4px 20px rgba(244, 63, 94, 0.35)',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    {submitting ? 'Đang Lưu Quyết Định...' : 'Xác Nhận Quyết Định Phúc Khảo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
