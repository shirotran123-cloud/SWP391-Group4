const fs = require('fs');
const path = require('path');
const AdmZip = require(path.resolve(__dirname, '../api-gateway/node_modules/adm-zip'));
const { ASTPlagiarismEngine } = require(path.resolve(__dirname, '../api-gateway/dist/plagiarism/ast-engine/plagiarism-engine.js'));

// 1. BASELINE: Python chuẩn Clean Code & SOLID, Pass 100%
const CODE_PASS_100 = `"""
Fibonacci Calculation Module - Standard Reference Implementation
Complies with Clean Code & SOLID (Single Responsibility Principle)
Time Complexity: O(N)
Space Complexity: O(1)
"""
import sys

class FibonacciCalculator:
    """
    Service responsible solely for calculating Fibonacci numbers.
    Adheres strictly to the Single Responsibility Principle (SRP).
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

// 2. FAIL TEST CASES: Code làm sai một hoặc nhiều test cases (chạy không crash, nhưng tính sai)
const CODE_FAIL_TESTCASES = `"""
Fibonacci Calculation Module - Intentional Buggy Implementation for Testing Failures
Bugs:
- Linear mapping approximation F(n) = n * 2 - 1
- Pass: N=1 (returns 1, expected 1)
- Fail: N=2 (returns 3, expected 1)
- Fail: N=3 (returns 5, expected 2)
- Fail: N=5 (returns 9, expected 5)
- Fail: N=10 (returns 19, expected 55)
"""
import sys

def get_fib_number(idx: int) -> int:
    if idx == 1:
        return 1
    # Buggy formula that fails most test cases
    return idx * 2 - 1

def run_program():
    lines = sys.stdin.readlines()
    for row in lines:
        row_str = row.strip()
        if row_str:
            num = int(row_str)
            ans = get_fib_number(num)
            print(ans)

if __name__ == '__main__':
    run_program()
`;

// 3. PLAGIARISM ~50%: Tỉ lệ tương đồng AST ~50% (Trạng thái SUSPECTED)
const CODE_PLAGIARISM_50 = `"""
Fibonacci Calculation Module - Variant with ~50% AST Similarity
Status: SUSPECTED (Warned for plagiarism investigation)
Preserves accurate computation while reorganizing architecture.
"""
import sys

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

// 4. PLAGIARISM ~70%: Tỉ lệ tương đồng AST ~70-76% (Trạng thái FLAGGED_HIGH >= 70%)
const CODE_PLAGIARISM_70 = `"""
Fibonacci Calculation Module - Variant with ~70-76% AST Similarity
Status: FLAGGED_HIGH (Flagged under UC-11 / BR-03 for high similarity >= 70%)
"""
import sys

class FibonacciCalculator:
    @staticmethod
    def calculate(n: int) -> int:
        if n <= 0:
            raise ValueError("Index N must be a positive integer (N >= 1)")
        if n == 1 or n == 2:
            return 1

        prev_val = 1
        curr_val = 1

        step = 3
        while step <= n:
            next_val = prev_val + curr_val
            prev_val = curr_val
            curr_val = next_val
            step += 1

        return curr_val

def main():
    try:
        raw_input = sys.stdin.read().split()
        if not raw_input:
            return
        n = int(raw_input[0])
        result = FibonacciCalculator.calculate(n)
        print(result)
    except Exception as e:
        sys.stderr.write(f"Error: {e}\\n")

if __name__ == '__main__':
    main()
`;

// 5. PLAGIARISM >80%: Tỉ lệ tương đồng AST 85%-100% (Trạng thái FLAGGED_PLAGIARISM, Điểm = 0 theo BR-03)
const CODE_PLAGIARISM_85 = `"""
Fibonacci Calculation Module - High Plagiarism Copy (>80% AST similarity)
Status: FLAGGED_PLAGIARISM (Triggers BR-03: Final Score = 0)
"""
import sys

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

        first_val = 1
        second_val = 1

        for idx in range(3, n + 1):
            sum_val = first_val + second_val
            first_val = second_val
            second_val = sum_val

        return second_val

def main():
    try:
        raw_input = sys.stdin.read().strip()
        if not raw_input:
            return
        num = int(raw_input)
        ans = FibonacciCalculator.calculate(num)
        print(ans)
    except Exception as err:
        sys.stderr.write(f"Error: {err}\\n")

if __name__ == '__main__':
    main()
`;

const packages = [
    {
        filename: 'python_pass_100.zip',
        code: CODE_PASS_100,
        desc: 'Pass 100% Test cases, Clean Code & SOLID (Baseline)'
    },
    {
        filename: 'python_fail_testcases.zip',
        code: CODE_FAIL_TESTCASES,
        desc: 'Làm sai một hoặc nhiều test cases (N=2, 3, 5, 10 FAIL)'
    },
    {
        filename: 'python_plagiarism_50.zip',
        code: CODE_PLAGIARISM_50,
        desc: 'Tỉ lệ tương đồng AST ~50% (SUSPECTED - Cảnh báo nghi vấn)'
    },
    {
        filename: 'python_plagiarism_70.zip',
        code: CODE_PLAGIARISM_70,
        desc: 'Tỉ lệ tương đồng AST ~70-76% (FLAGGED_HIGH - Gắn cờ vi phạm >= 70%)'
    },
    {
        filename: 'python_plagiarism_85.zip',
        code: CODE_PLAGIARISM_85,
        desc: 'Tỉ lệ tương đồng AST >80% (FLAGGED_PLAGIARISM - Điểm = 0 theo BR-03)'
    }
];

// So sánh AST
console.log("==================================================================");
console.log("  BẢNG TÍNH TOÁN ĐỐI SÁNH AST PLAGIARISM ENGINE (SO VỚI BASELINE) ");
console.log("==================================================================");

for (const pkg of packages) {
    if (pkg.filename === 'python_pass_100.zip') {
        console.log(`- ${pkg.filename.padEnd(28)}: BASELINE (100% Pass, Clean Code & SOLID)`);
        continue;
    }
    const result = ASTPlagiarismEngine.compareSubmissions(
        { submissionId: 'baseline', sourceCode: CODE_PASS_100, language: 'python' },
        { submissionId: pkg.filename, sourceCode: pkg.code, language: 'python' }
    );
    console.log(`- ${pkg.filename.padEnd(28)}: Sim = ${result.similarityRate.toFixed(2)}% | Status = ${result.status.padEnd(18)} | Note: ${pkg.desc}`);
}

console.log("==================================================================\n");

// Tạo file ZIP
const workspaceDir = path.resolve(__dirname, '..');
const artifactDir = 'C:\\Users\\ADMIN\\.gemini\\antigravity-ide\\brain\\40a31628-7561-4dfa-95c4-9e3a00cc8837';

function zipCode(filename, codeContent) {
    const targetZipPath = path.join(workspaceDir, filename);
    const zip = new AdmZip();
    zip.addFile('solution.py', Buffer.from(codeContent, 'utf-8'));
    zip.writeZip(targetZipPath);

    const stats = fs.statSync(targetZipPath);

    // Copy to artifact directory if available
    if (fs.existsSync(artifactDir)) {
        try {
            fs.copyFileSync(targetZipPath, path.join(artifactDir, filename));
        } catch (e) {
            // ignore artifact copy error
        }
    }

    return { path: targetZipPath, bytes: stats.size };
}

async function run() {
    console.log("Đang đóng gói 5 file zip...");
    for (const pkg of packages) {
        const info = zipCode(pkg.filename, pkg.code);
        console.log(`✓ Đã tạo thành công: ${pkg.filename.padEnd(28)} (${info.bytes} bytes) -> ${info.path}`);
    }
    console.log("\nToàn bộ 5 file ZIP đã sẵn sàng để kiểm thử!");
}

run().catch(console.error);
