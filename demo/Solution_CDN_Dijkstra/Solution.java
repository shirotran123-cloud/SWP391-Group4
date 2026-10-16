import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.util.StringTokenizer;
import java.util.ArrayList;
import java.util.List;
import java.util.PriorityQueue;
import java.util.Arrays;
import java.util.Scanner;

/**
 * ============================================================================
 * HE THONG DINH TUYEN LUONG CDN STREAMING DA VUNG (Adaptive Bitrate Routing)
 * ============================================================================
 * Tuan thu nguyen ly SRP (Single Responsibility Principle) & Khung Starter Code:
 * 1. CDNEdge: Mo ta kenh truyen dan co huong va do tre
 * 2. PathNode: Phan tu phuc vu Hang doi uu tien Min-Heap (heapSort property)
 * 3. CDNGraph: Quan ly danh sach ke mang luoi CDN
 * 4. CDNDijkstraRouter: Trien khai thuat toan Dijkstra O((M + N) log N)
 * 5. Solution: Doc du lieu Fast I/O va goi Router xu ly
 * ============================================================================
 */

class CDNEdge {
    int to;
    long latency;

    public CDNEdge(int to, long latency) {
        this.to = to;
        this.latency = latency;
    }
}

class PathNode implements Comparable<PathNode> {
    final int nodeIndex;
    final long currentLatency;

    public PathNode(int nodeIndex, long currentLatency) {
        this.nodeIndex = nodeIndex;
        this.currentLatency = currentLatency;
    }

    @Override
    public int compareTo(PathNode other) {
        // heapSort invariant: So sanh do tre de duy tri Min-Heap O(log N)
        return Long.compare(this.currentLatency, other.currentLatency);
    }
}

class CDNGraph {
    private final int nodeCount;
    private final List<List<CDNEdge>> adj;

    public CDNGraph(int nodeCount) {
        this.nodeCount = nodeCount;
        this.adj = new ArrayList<>(nodeCount);
        for (int i = 0; i < nodeCount; i++) {
            this.adj.add(new ArrayList<>());
        }
    }

    public int getNodeCount() {
        return this.nodeCount;
    }

    public void addEdge(int from, int to, long latency) {
        this.adj.get(from).add(new CDNEdge(to, latency));
    }

    public List<CDNEdge> getNeighbors(int node) {
        return this.adj.get(node);
    }
}

class CDNDijkstraRouter {
    public static final long UNREACHABLE = -1L;

    /**
     * Trien khai thuat toan Dijkstra voi PriorityQueue Min-Heap O((M + N) log N)
     */
    public long findShortestLatency(CDNGraph graph, int source, int destination) {
        int n = graph.getNodeCount();
        if (source == destination) {
            return 0L;
        }

        long[] minLatency = new long[n];
        Arrays.fill(minLatency, Long.MAX_VALUE);

        PriorityQueue<PathNode> minHeap = new PriorityQueue<>();

        minLatency[source] = 0L;
        minHeap.add(new PathNode(source, 0L));

        while (!minHeap.isEmpty()) {
            PathNode current = minHeap.poll();
            int u = current.nodeIndex;
            long currentDist = current.currentLatency;

            if (currentDist > minLatency[u]) {
                continue;
            }

            if (u == destination) {
                return currentDist;
            }

            for (CDNEdge edge : graph.getNeighbors(u)) {
                int v = edge.to;
                long weight = edge.latency;

                if (minLatency[u] + weight < minLatency[v]) {
                    minLatency[v] = minLatency[u] + weight;
                    minHeap.add(new PathNode(v, minLatency[v]));
                }
            }
        }

        return minLatency[destination] == Long.MAX_VALUE ? UNREACHABLE : minLatency[destination];
    }
}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line = reader.readLine();
        if (line == null) {
            return;
        }

        StringTokenizer tokenizer = new StringTokenizer(line);
        if (!tokenizer.hasMoreTokens()) {
            return;
        }

        int n = Integer.parseInt(tokenizer.nextToken());
        int m = Integer.parseInt(tokenizer.nextToken());
        int source = Integer.parseInt(tokenizer.nextToken());
        int destination = Integer.parseInt(tokenizer.nextToken());

        CDNGraph graph = new CDNGraph(n);

        for (int i = 0; i < m; i++) {
            while (tokenizer == null || !tokenizer.hasMoreTokens()) {
                String nextLine = reader.readLine();
                if (nextLine == null) break;
                tokenizer = new StringTokenizer(nextLine);
            }
            int u = Integer.parseInt(tokenizer.nextToken());
            int v = Integer.parseInt(tokenizer.nextToken());
            long w = Long.parseLong(tokenizer.nextToken());
            graph.addEdge(u, v, w);
        }

        CDNDijkstraRouter router = new CDNDijkstraRouter();
        long shortestLatency = router.findShortestLatency(graph, source, destination);

        System.out.println(shortestLatency);
    }
}
