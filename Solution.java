import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;

/**
 * Interface defining the contract for Fibonacci sequence calculation.
 * Follows the Interface Segregation Principle (ISP) and Dependency Inversion Principle (DIP).
 */
interface IFibonacciService {
    long calculateFibonacci(int n);
}

/**
 * Concrete implementation for calculating Fibonacci numbers.
 * Adheres to the Single Responsibility Principle (SRP):
 * Its sole responsibility is computing the Fibonacci sequence.
 *
 * Algorithm complexity:
 * - Time Complexity: O(N)
 * - Space Complexity: O(1)
 */
class FibonacciCalculator implements IFibonacciService {

    @Override
    public long calculateFibonacci(int n) {
        if (n <= 0) {
            throw new IllegalArgumentException("Index N must be a positive integer (N >= 1)");
        }
        if (n == 1 || n == 2) {
            return 1L;
        }

        long previousValue = 1L;
        long currentValue = 1L;

        for (int i = 3; i <= n; i++) {
            long nextValue = previousValue + currentValue;
            previousValue = currentValue;
            currentValue = nextValue;
        }

        return currentValue;
    }
}

/**
 * Main application entry point and orchestrator.
 * Handles standard I/O (StdIn/StdOut) and delegates computation to IFibonacciService.
 */
public class Solution {

    private final IFibonacciService fibonacciService;

    public Solution(IFibonacciService fibonacciService) {
        this.fibonacciService = fibonacciService;
    }

    public void processInputAndExecute() {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in))) {
            String line = reader.readLine();
            if (line == null || line.trim().isEmpty()) {
                return;
            }

            int n = Integer.parseInt(line.trim());
            long result = fibonacciService.calculateFibonacci(n);
            System.out.println(result);

        } catch (IOException e) {
            System.err.println("Input error: " + e.getMessage());
        } catch (NumberFormatException e) {
            System.err.println("Invalid integer format: " + e.getMessage());
        }
    }

    public static void main(String[] args) {
        IFibonacciService calculator = new FibonacciCalculator();
        Solution solution = new Solution(calculator);
        solution.processInputAndExecute();
    }
}
