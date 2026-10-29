const path = require('path');
const { ASTPlagiarismEngine } = require(path.resolve(__dirname, '../api-gateway/dist/plagiarism/ast-engine/plagiarism-engine.js'));

const baselineCode = `import sys

class FibonacciCalculator:
    """
    Service responsible solely for calculating Fibonacci numbers.
    Follows Single Responsibility Principle (SRP).
    Time Complexity: O(N)
    Space Complexity: O(1)
    """
    @staticmethod
    def calculate(n: int) -> int:
        if n <= 0:
            raise ValueError("Index N must be a positive integer (N >= 1)")
        if n == 1 or n == 2:
            return 1

        prev_val = 1
        curr_val = 1

        for _ in range(3, n + 1):
            next_val = prev_val + curr_val
            prev_val = curr_val
            curr_val = next_val

        return curr_val

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            return
        n = int(raw_input)
        result = FibonacciCalculator.calculate(n)
        print(result)
    except Exception as e:
        sys.stderr.write(f"Error: {e}\\n")

if __name__ == '__main__':
    main()
`;

const codePlag52 = `import sys

def parse_input_stream():
    buffer = sys.stdin.read().strip()
    if not buffer:
        return None
    return int(buffer)

class CustomProcessor:
    def __init__(self):
        self.audit = []

    def compute(self, n: int) -> int:
        if n < 1:
            return 0
        if n < 3:
            return 1

        first_num = 1
        second_num = 1
        for idx in range(3, n + 1):
            next_val = first_num + second_num
            first_num = second_num
            second_num = next_val
        return second_num

def start():
    val = parse_input_stream()
    if val is not None:
        p = CustomProcessor()
        print(p.compute(val))

if __name__ == '__main__':
    start()
`;

const res = ASTPlagiarismEngine.compareSubmissions(
    { submissionId: 'baseline', sourceCode: baselineCode, language: 'python' },
    { submissionId: 'plag52', sourceCode: codePlag52, language: 'python' }
);
console.log(`plag52 -> Sim: ${res.similarityRate.toFixed(2)}% | Status: ${res.status} | Common: ${res.commonFingerprintsCount} | sizeA:${res.matchedTokensJson.totalUniqueFingerprintsA}, sizeB:${res.matchedTokensJson.totalUniqueFingerprintsB}`);
