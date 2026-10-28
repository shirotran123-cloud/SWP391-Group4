import { ASTNormalizer } from './ast-normalizer';
import { WinnowingEngine } from './winnowing';
import { ASTPlagiarismEngine, CodeSubmission } from './plagiarism-engine';

/**
 * IEEE EXPERIMENTAL BENCHMARK SUITE (THÀNH VIÊN 4)
 * Bộ thực nghiệm đo lường đối soát mã nguồn ngụy trang phục vụ Bài báo IEEE
 * Đánh giá hiệu năng giải thuật AST Normalizer + Winnowing Fingerprinting (k=15, w=10)
 */

export interface ExperimentResult {
  scenarioId: string;
  attackVectorName: string;
  sourceTokensA: number;
  sourceTokensB: number;
  fingerprintsA: number;
  fingerprintsB: number;
  commonFingerprints: number;
  jaccardSimilarityPct: number;
  winnowingContainmentPct: number;
  executionTimeMs: number;
  status: string;
  zeroScoreEnforced: boolean;
  finalScoreVerdict: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATASETS: SOURCE CODE PAIRS (Mã nguồn thực nghiệm)
// ─────────────────────────────────────────────────────────────────────────────

// Base Implementation: BubbleSort với Java Scanner I/O chuẩn
export const CODE_BASE = `package com.aita.autograder;
import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }
        bubbleSort(arr);
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
    }

    public static void bubbleSort(int[] a) {
        int n = a.length;
        for (int i = 0; i < n - 1; i++) {
            for (int j = 0; j < n - i - 1; j++) {
                if (a[j] > a[j + 1]) {
                    int temp = a[j];
                    a[j] = a[j + 1];
                    a[j + 1] = temp;
                }
            }
        }
    }
}`;

// T01: Sao chép nguyên văn (Exact copy-paste)
export const CODE_T01_COPY = CODE_BASE;

// T02: Đổi tên định danh biến, phương thức, class (Identifier Renaming)
export const CODE_T02_RENAME = `package vn.edu.fpt.student;
import java.util.Scanner;

public class ArrayProcessor {
    public static void main(String[] arguments) {
        Scanner scannerInput = new Scanner(System.in);
        int totalElements = scannerInput.nextInt();
        int[] dataList = new int[totalElements];
        for (int index = 0; index < totalElements; index++) {
            dataList[index] = scannerInput.nextInt();
        }
        executeSortAlgorithm(dataList);
        for (int index = 0; index < totalElements; index++) {
            System.out.print(dataList[index] + " ");
        }
        System.out.println();
    }

    public static void executeSortAlgorithm(int[] numbers) {
        int length = numbers.length;
        for (int outer = 0; outer < length - 1; outer++) {
            for (int inner = 0; inner < length - outer - 1; inner++) {
                if (numbers[inner] > numbers[inner + 1]) {
                    int swapTemp = numbers[inner];
                    numbers[inner] = numbers[inner + 1];
                    numbers[inner + 1] = swapTemp;
                }
            }
        }
    }
}`;

// T03: Chèn chú thích dày đặc & thay đổi định dạng khoảng trắng (Comment & Formatting Obfuscation)
export const CODE_T03_COMMENTS = `
// ==========================================
// Author: Anonymous Student
// Subject: Data Structures & Algorithms
// ==========================================
import java.util.Scanner;

public class Solution {
    /* Main entry point for the test evaluation */
    public static void main(String[] args) {
        // Initialize standard input reader
        Scanner sc = new Scanner(System.in);
        /* Read array size */
        int n = sc.nextInt();
        int[] arr = new int[n];
        
        // Loop through all elements
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt(); // read next integer
        }
        
        // Call the bubble sorting routine
        bubbleSort(arr);
        
        // Print elements to stdout
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
    }

    /**
     * Standard ascending bubble sort implementation.
     * @param a the target array
     */
    public static void bubbleSort(int[] a) {
        int n = a.length; // array length
        for (int i = 0; i < n - 1; i++) {
            for (int j = 0; j < n - i - 1; j++) {
                if (a[j] > a[j + 1]) {
                    int temp = a[j];
                    a[j] = a[j + 1];
                    a[j + 1] = temp;
                }
            }
        }
    }
}`;

// T04: Xáo trộn câu lệnh & chèn mã chết (Instruction Reordering & Dead Code Injection)
export const CODE_T04_DEAD_CODE = `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        int dummyCounter = 100;
        dummyCounter = dummyCounter + 50;
        Scanner sc = new Scanner(System.in);
        int unusedFlag = 0;
        int n = sc.nextInt();
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }
        bubbleSort(arr);
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
        dummyCounter = dummyCounter * 2;
    }

    public static void bubbleSort(int[] a) {
        int n = a.length;
        int debugPasses = 0;
        for (int i = 0; i < n - 1; i++) {
            debugPasses++;
            for (int j = 0; j < n - i - 1; j++) {
                if (a[j] > a[j + 1]) {
                    int temp = a[j];
                    a[j] = a[j + 1];
                    a[j + 1] = temp;
                }
            }
        }
    }
}`;

// T05: Trùng lặp mã I/O mẫu nhưng thuật toán hoàn toàn khác (Shared I/O Boilerplate with MergeSort)
export const CODE_T05_SHARED_IO_MERGESORT = `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }
        mergeSort(arr, 0, n - 1);
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
    }

    public static void mergeSort(int[] arr, int left, int right) {
        if (left < right) {
            int mid = left + (right - left) / 2;
            mergeSort(arr, left, mid);
            mergeSort(arr, mid + 1, right);
            merge(arr, left, mid, right);
        }
    }

    public static void merge(int[] arr, int left, int mid, int right) {
        int n1 = mid - left + 1;
        int n2 = right - mid;
        int[] lArr = new int[n1];
        int[] rArr = new int[n2];
        for (int i = 0; i < n1; ++i) lArr[i] = arr[left + i];
        for (int j = 0; j < n2; ++j) rArr[j] = arr[mid + 1 + j];
        int i = 0, j = 0, k = left;
        while (i < n1 && j < n2) {
            if (lArr[i] <= rArr[j]) {
                arr[k] = lArr[i];
                i++;
            } else {
                arr[k] = rArr[j];
                j++;
            }
            k++;
        }
        while (i < n1) { arr[k] = lArr[i]; i++; k++; }
        while (j < n2) { arr[k] = rArr[j]; j++; k++; }
    }
}`;

// T06: Cài đặt độc lập không sao chép (QuickSort with BufferedReader)
export const CODE_T06_INDEPENDENT_QUICKSORT = `import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.util.StringTokenizer;

public class FastQuickSort {
    public static void main(String[] args) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line = reader.readLine();
        if (line == null) return;
        int size = Integer.parseInt(line.trim());
        int[] values = new int[size];
        StringTokenizer st = new StringTokenizer(reader.readLine());
        for (int idx = 0; idx < size; idx++) {
            values[idx] = Integer.parseInt(st.nextToken());
        }
        quickSort(values, 0, size - 1);
        StringBuilder sb = new StringBuilder();
        for (int val : values) {
            sb.append(val).append(" ");
        }
        System.out.println(sb.toString().trim());
    }

    private static void quickSort(int[] data, int low, int high) {
        if (low < high) {
            int pIndex = partition(data, low, high);
            quickSort(data, low, pIndex - 1);
            quickSort(data, pIndex + 1, high);
        }
    }

    private static int partition(int[] arr, int low, int high) {
        int pivot = arr[high];
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (arr[j] <= pivot) {
                i++;
                int temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
            }
        }
        int swap = arr[i + 1];
        arr[i + 1] = arr[high];
        arr[high] = swap;
        return i + 1;
    }
}`;

// T07: Thuật toán đồ thị hoàn toàn khác biệt (Dijkstra's Shortest Path)
export const CODE_T07_DIJKSTRA = `import java.util.*;

public class DijkstraGraph {
    static class Edge {
        int to;
        int weight;
        Edge(int t, int w) { to = t; weight = w; }
    }

    public static void main(String[] args) {
        Scanner scan = new Scanner(System.in);
        int vertices = scan.nextInt();
        int edges = scan.nextInt();
        List<List<Edge>> adj = new ArrayList<>();
        for (int i = 0; i < vertices; i++) adj.add(new ArrayList<>());
        for (int i = 0; i < edges; i++) {
            int u = scan.nextInt();
            int v = scan.nextInt();
            int w = scan.nextInt();
            adj.get(u).add(new Edge(v, w));
        }
        int[] dist = new int[vertices];
        Arrays.fill(dist, Integer.MAX_VALUE);
        dist[0] = 0;
        PriorityQueue<int[]> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a[1]));
        pq.offer(new int[]{0, 0});
        while (!pq.isEmpty()) {
            int[] curr = pq.poll();
            int u = curr[0];
            int d = curr[1];
            if (d > dist[u]) continue;
            for (Edge e : adj.get(u)) {
                if (dist[u] + e.weight < dist[e.to]) {
                    dist[e.to] = dist[u] + e.weight;
                    pq.offer(new int[]{e.to, dist[e.to]});
                }
            }
        }
        System.out.println(dist[vertices - 1]);
    }
}`;

// T08: Bài nộp siêu ngắn dưới ngưỡng cửa sổ k-gram (< 15 tokens)
export const CODE_T08_SHORT = `public class A { int x = 5; }`;

// ─────────────────────────────────────────────────────────────────────────────
// THỰC THI THỬ NGHIỆM ĐỐI SOÁT
// ─────────────────────────────────────────────────────────────────────────────

export async function runExperiments(): Promise<ExperimentResult[]> {
  const testCases = [
    { id: 'T01', name: 'Exact Verbatim Copy', codeB: CODE_T01_COPY },
    { id: 'T02', name: 'Identifier & Method Renaming', codeB: CODE_T02_RENAME },
    { id: 'T03', name: 'Comment & Format Obfuscation', codeB: CODE_T03_COMMENTS },
    { id: 'T04', name: 'Dead Code & Instruction Reorder', codeB: CODE_T04_DEAD_CODE },
    { id: 'T05', name: 'Shared I/O Boilerplate (MergeSort)', codeB: CODE_T05_SHARED_IO_MERGESORT },
    { id: 'T06', name: 'Independent Implementation (QuickSort)', codeB: CODE_T06_INDEPENDENT_QUICKSORT },
    { id: 'T07', name: 'Unrelated Algorithm (Dijkstra)', codeB: CODE_T07_DIJKSTRA },
    { id: 'T08', name: 'Micro-submission (< 15 tokens)', codeB: CODE_T08_SHORT },
  ];

  const results: ExperimentResult[] = [];

  for (const tc of testCases) {
    const subA: CodeSubmission = { submissionId: 'SUB-ORIGINAL', sourceCode: CODE_BASE, language: 'java' };
    const subB: CodeSubmission = { submissionId: `SUB-${tc.id}`, sourceCode: tc.codeB, language: 'java' };

    const normA = ASTNormalizer.normalize(subA.sourceCode, 'java');
    const normB = ASTNormalizer.normalize(subB.sourceCode, 'java');

    const fpA = WinnowingEngine.computeFingerprints(normA.tokens);
    const fpB = WinnowingEngine.computeFingerprints(normB.tokens);

    const comp = ASTPlagiarismEngine.compareSubmissions(subA, subB);

    // Ngưỡng phạt 0 điểm theo BR-03: similarityRate >= 80.0%
    const isZeroScore = comp.similarityRate >= 80.0;

    results.push({
      scenarioId: tc.id,
      attackVectorName: tc.name,
      sourceTokensA: normA.tokens.length,
      sourceTokensB: normB.tokens.length,
      fingerprintsA: fpA.length,
      fingerprintsB: fpB.length,
      commonFingerprints: comp.commonFingerprintsCount,
      jaccardSimilarityPct: comp.matchedTokensJson.jaccardSimilarity,
      winnowingContainmentPct: comp.similarityRate,
      executionTimeMs: comp.executionTimeMs,
      status: comp.status,
      zeroScoreEnforced: isZeroScore,
      finalScoreVerdict: isZeroScore ? '0.0 / 10.0 (Zero-Tolerance BR-03)' : 'Điểm tính bình thường (Không đạo văn)',
    });
  }

  return results;
}
