import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.util.StringTokenizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Arrays;
import java.util.Scanner;

/**
 * ============================================================================
 * DONG CO GAME 3D - HE THONG TOI UU HOA CACHE VRAM PHAN VUNG OCTREE
 * ============================================================================
 * Thuat toan: Quy hoach dong Balo 0/1 toi uu hoa mang 1D (Space-optimized 1D DP)
 * Do phuc tap thoi gian: O(N * W)
 * Do phuc tap khong gian: O(W) voi W la dung luong VRAM toi da
 * Kieu du lieu: 64-bit integer (long) ngan ngua tran so nguyen (Integer Overflow)
 * Kien truc: Thiet ke huong doi tuong tuan thu Single Responsibility Principle (SRP)
 * Ghi chu thuat toan: Khac voi Fractional Knapsack dung Arrays.sort(), 0/1 Knapsack dung 1D DP.
 * ============================================================================
 */

// 1. Single Responsibility: Bieu dien thong tin thuc the node trong Octree (Weight & Value)
class OctreeEntityNode {
    final int weight;
    final long priorityValue;

    public OctreeEntityNode(int weight, long priorityValue) {
        this.weight = weight;
        this.priorityValue = priorityValue;
    }
}

// 2. Single Responsibility: Thuat toan quy hoach dong 1D mang toi uu hoa VRAM Cache
class VramCacheOptimizer {

    /**
     * Tinh toan tong diem uu tien hieu nang ket xuat lon nhat khong vuot qua gioi han VRAM.
     * Su dung mang 1 chieu dp[j] duyet nguoc tu maxCapacity ve weight de dam bao
     * moi thuc the chi duoc chon toi da 1 lan (0/1 Knapsack invariant).
     */
    public long computeMaxPriority(List<OctreeEntityNode> nodes, int maxCapacity) {
        if (nodes == null || nodes.isEmpty() || maxCapacity < 0) {
            return 0L;
        }

        long baseBonus = 0L;
        List<OctreeEntityNode> validNodes = new ArrayList<>();

        // Xu ly cac node dac biet
        for (OctreeEntityNode node : nodes) {
            if (node.weight == 0) {
                // Node co trong luong = 0 khong tieu ton VRAM, luon duoc nap vao cache
                if (node.priorityValue > 0) {
                    baseBonus += node.priorityValue;
                }
            } else if (node.weight <= maxCapacity && node.priorityValue > 0) {
                validNodes.add(node);
            }
        }

        if (maxCapacity == 0) {
            return baseBonus;
        }

        // Space-optimized 1D DP array O(W)
        long[] dp = new long[maxCapacity + 1];
        Arrays.fill(dp, 0L);

        // Quy hoach dong 1D duyet nguoc
        for (OctreeEntityNode node : validNodes) {
            int wt = node.weight;
            long val = node.priorityValue;

            for (int j = maxCapacity; j >= wt; j--) {
                long candidate = dp[j - wt] + val;
                if (candidate > dp[j]) {
                    dp[j] = candidate;
                }
            }
        }

        return baseBonus + dp[maxCapacity];
    }
}

// 3. Single Responsibility: Doc du lieu dau vao StdIn toc do cao (Fast I/O)
class FastInputReader {
    private final BufferedReader reader;
    private StringTokenizer tokenizer;

    public FastInputReader() {
        this.reader = new BufferedReader(new InputStreamReader(System.in));
    }

    public String next() throws IOException {
        while (tokenizer == null || !tokenizer.hasMoreTokens()) {
            String line = reader.readLine();
            if (line == null) {
                return null;
            }
            tokenizer = new StringTokenizer(line);
        }
        return tokenizer.nextToken();
    }

    public int nextInt() throws IOException {
        String token = next();
        if (token == null) {
            return 0;
        }
        return Integer.parseInt(token);
    }

    public long nextLong() throws IOException {
        String token = next();
        if (token == null) {
            return 0L;
        }
        return Long.parseLong(token);
    }
}

// 4. Single Responsibility: Dieu phoi luong chuong trinh chinh (Orchestrator)
public class Solution {
    public static void main(String[] args) {
        try {
            FastInputReader reader = new FastInputReader();
            String firstToken = reader.next();
            if (firstToken == null) {
                return;
            }

            int n = Integer.parseInt(firstToken);
            int maxVram = reader.nextInt();

            int[] weights = new int[n];
            for (int i = 0; i < n; i++) {
                weights[i] = reader.nextInt();
            }

            long[] values = new long[n];
            for (int i = 0; i < n; i++) {
                values[i] = reader.nextLong();
            }

            List<OctreeEntityNode> nodes = new ArrayList<>(n);
            for (int i = 0; i < n; i++) {
                nodes.add(new OctreeEntityNode(weights[i], values[i]));
            }

            VramCacheOptimizer optimizer = new VramCacheOptimizer();
            long maxPriority = optimizer.computeMaxPriority(nodes, maxVram);

            System.out.println(maxPriority);

        } catch (Exception ex) {
            System.out.println(0);
        }
    }
}
