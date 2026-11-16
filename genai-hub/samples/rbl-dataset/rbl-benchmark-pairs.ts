/**
 * RBL Research Core Experimental Dataset - 10 Code Pair Benchmark Suite
 *
 * Contains 10 real-world pair test scenarios evaluating AST + Winnowing (maxContainment) resilience against:
 * 1. Identifier Renaming (Variables & Functions)
 * 2. Loop & Control Flow Restructuring
 * 3. Comment & Dead Code Injection (Containment-First isolation)
 * 4. Function Extraction & Inlining
 * 5. Branch Inversion & Logical Equivalence
 * 6. Operator & Expression Rewriting
 * 7. Re-indentation & Formatting Tampering
 * 8. Generative AI Code Refactoring (ChatGPT / Claude)
 * 9. Compound Obfuscation (Multiple combined techniques)
 * 10. Negative Control (Different algorithms solving same problem - MergeSort vs QuickSort)
 */

export interface BenchmarkPair {
  pairId: number;
  title: string;
  obfuscationType: string;
  expectedIsPlagiarized: boolean; // True for 1-9, False for 10
  codeA: string;
  codeB: string;
}

export const RBL_BENCHMARK_PAIRS: BenchmarkPair[] = [
  {
    pairId: 1,
    title: "Pair 01: Variable & Function Identifier Renaming",
    obfuscationType: "Identifier Renaming",
    expectedIsPlagiarized: true,
    codeA: `
def calculate_factorial(n):
    # Calculate factorial of a given number n recursively
    if n <= 1:
        return 1
    total_result = n * calculate_factorial(n - 1)
    return total_result

def process_numbers(num_list):
    results = []
    for item in num_list:
        if item >= 0:
            val = calculate_factorial(item)
            results.append(val)
        else:
            results.append(0)
    return results

def summarize_batch(batch_data):
    processed = process_numbers(batch_data)
    total_sum = 0
    for v in processed:
        total_sum = total_sum + v
    return total_sum
`,
    codeB: `
def compute_fact(x_val):
    # Rename variable n to x_val and total_result to res
    if x_val <= 1:
        return 1
    res = x_val * compute_fact(x_val - 1)
    return res

def run_pipeline(arr_input):
    output_array = []
    for element in arr_input:
        if element >= 0:
            tmp = compute_fact(element)
            output_array.append(tmp)
        else:
            output_array.append(0)
    return output_array

def aggregate_results(raw_items):
    transformed = run_pipeline(raw_items)
    accum = 0
    for item_val in transformed:
        accum = accum + item_val
    return accum
`,
  },

  {
    pairId: 2,
    title: "Pair 02: Loop Restructuring (For to While Conversion)",
    obfuscationType: "Control Flow Restructuring",
    expectedIsPlagiarized: true,
    codeA: `
def sum_even_numbers(limit):
    total_sum = 0
    for i in range(0, limit + 1):
        if i % 2 == 0:
            total_sum = total_sum + i
    return total_sum

def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1

def evaluate_queries(sorted_data, queries):
    found_indices = []
    for q in queries:
        pos = binary_search(sorted_data, q)
        if pos >= 0:
            found_indices.append(pos)
        else:
            found_indices.append(-1)
    return found_indices

def verify_sorted_order(arr):
    for k in range(1, len(arr)):
        if arr[k] < arr[k - 1]:
            return False
    return True
`,
    codeB: `
def accum_evens(max_num):
    accumulator = 0
    curr_idx = 0
    while curr_idx <= max_num:
        if curr_idx % 2 == 0:
            accumulator = accumulator + curr_idx
        curr_idx = curr_idx + 1
    return accumulator

def find_element(items, key):
    left_ptr = 0
    right_ptr = len(items) - 1
    while left_ptr <= right_ptr:
        middle = (left_ptr + right_ptr) // 2
        if items[middle] == key:
            return middle
        elif items[middle] < key:
            left_ptr = middle + 1
        else:
            right_ptr = middle - 1
    return -1

def run_search_queries(ordered_list, targets):
    matched = []
    for t in targets:
        idx = find_element(ordered_list, t)
        if idx >= 0:
            matched.append(idx)
        else:
            matched.append(-1)
    return matched

def check_monotonic(items):
    for p in range(1, len(items)):
        if items[p] < items[p - 1]:
            return False
    return True
`,
  },

  {
    pairId: 3,
    title: "Pair 03: Dead Code & Junk Comment Injection",
    obfuscationType: "Dead Code Injection",
    expectedIsPlagiarized: true,
    codeA: `
def fibonacci_dp(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    prev_two = 0
    prev_one = 1
    for idx in range(2, n + 1):
        current = prev_one + prev_two
        prev_two = prev_one
        prev_one = current
    return prev_one

def generate_fib_sequence(count):
    seq = []
    for k in range(count):
        val = fibonacci_dp(k)
        if val % 2 == 0:
            seq.append(val)
        else:
            seq.append(val)
    return seq
`,
    codeB: `
# Author: Anonymous Student Submission 2026
# Module: Mathematics & Algorithm Analysis
def unused_diagnostic_helper(seed_val):
    dummy_acc = 0
    for step in range(5):
        dummy_acc = dummy_acc + seed_val * step
    return dummy_acc

def fibonacci_dp(n):
    # Check base boundary conditions first
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    prev_two = 0
    prev_one = 1
    for idx in range(2, n + 1):
        current = prev_one + prev_two
        prev_two = prev_one
        prev_one = current
    return prev_one

def generate_fib_sequence(count):
    seq = []
    for k in range(count):
        val = fibonacci_dp(k)
        if val % 2 == 0:
            seq.append(val)
        else:
            seq.append(val)
    return seq
`,
  },

  {
    pairId: 4,
    title: "Pair 04: Function Extraction & Refactoring",
    obfuscationType: "Function Inlining / Extraction",
    expectedIsPlagiarized: true,
    codeA: `
def check_prime(number):
    if number <= 1:
        return False
    for i in range(2, int(number ** 0.5) + 1):
        if number % i == 0:
            return False
    return True

def get_primes_in_range(start, end):
    primes = []
    for num in range(start, end + 1):
        if check_prime(num):
            primes.append(num)
    return primes

def count_twin_primes(prime_list):
    twin_count = 0
    for idx in range(len(prime_list) - 1):
        diff = prime_list[idx + 1] - prime_list[idx]
        if diff == 2:
            twin_count = twin_count + 1
    return twin_count

def summarize_prime_stats(low_bound, high_bound):
    found = get_primes_in_range(low_bound, high_bound)
    twins = count_twin_primes(found)
    return len(found) + twins
`,
    codeB: `
def is_divisible_helper(n, divisor):
    if n % divisor == 0:
        return True
    return False

def check_prime(number):
    if number <= 1:
        return False
    for i in range(2, int(number ** 0.5) + 1):
        if number % i == 0:
            return False
    return True

def filter_prime_numbers(s_val, e_val):
    result_list = []
    for current in range(s_val, e_val + 1):
        if check_prime(current):
            result_list.append(current)
    return result_list

def count_twin_pairs(p_array):
    pairs = 0
    for k in range(len(p_array) - 1):
        gap = p_array[k + 1] - p_array[k]
        if gap == 2:
            pairs = pairs + 1
    return pairs

def compute_prime_report(a_val, b_val):
    p_list = filter_prime_numbers(a_val, b_val)
    t_cnt = count_twin_pairs(p_list)
    return len(p_list) + t_cnt
`,
  },

  {
    pairId: 5,
    title: "Pair 05: Branch Inversion & If-Else Equivalence",
    obfuscationType: "Control Flow Inversion",
    expectedIsPlagiarized: true,
    codeA: `
def evaluate_student_grade(score):
    if score >= 90:
        grade = "A"
    elif score >= 80:
        grade = "B"
    elif score >= 70:
        grade = "C"
    elif score >= 50:
        grade = "D"
    else:
        grade = "F"
    return grade

def evaluate_class_roster(scores):
    distribution = []
    for s in scores:
        letter = evaluate_student_grade(s)
        distribution.append(letter)
    return distribution
`,
    codeB: `
def grade_classifier(marks):
    if marks < 50:
        result_grade = "F"
    elif marks < 70:
        result_grade = "D"
    elif marks < 80:
        result_grade = "C"
    elif marks < 90:
        result_grade = "B"
    else:
        result_grade = "A"
    return result_grade

def classify_all_students(mark_list):
    outcomes = []
    for m in mark_list:
        g = grade_classifier(m)
        outcomes.append(g)
    return outcomes
`,
  },

  {
    pairId: 6,
    title: "Pair 06: Expression Rewriting & Operator Substitution",
    obfuscationType: "Expression Substitution",
    expectedIsPlagiarized: true,
    codeA: `
def matrix_multiply(A, B):
    rows_A = len(A)
    cols_A = len(A[0])
    cols_B = len(B[0])
    C = [[0 for _ in range(cols_B)] for _ in range(rows_A)]
    for i in range(rows_A):
        for j in range(cols_B):
            for k in range(cols_A):
                C[i][j] = C[i][j] + A[i][k] * B[k][j]
    return C

def matrix_trace(M):
    n = len(M)
    total = 0
    for idx in range(n):
        total = total + M[idx][idx]
    return total

def scale_matrix(M, factor):
    rows = len(M)
    cols = len(M[0])
    for r in range(rows):
        for c in range(cols):
            M[r][c] = M[r][c] * factor
    return M
`,
    codeB: `
def multiply_matrices(mat1, mat2):
    r1 = len(mat1)
    c1 = len(mat1[0])
    c2 = len(mat2[0])
    res = [[0] * c2 for _ in range(r1)]
    for idx_i in range(r1):
        for idx_j in range(c2):
            for idx_k in range(c1):
                res[idx_i][idx_j] = res[idx_i][idx_j] + mat1[idx_i][idx_k] * mat2[idx_k][idx_j]
    return res

def compute_diagonal_sum(grid):
    dim = len(grid)
    diag_sum = 0
    for d in range(dim):
        diag_sum = diag_sum + grid[d][d]
    return diag_sum

def multiply_by_scalar(grid, scalar):
    h = len(grid)
    w = len(grid[0])
    for y in range(h):
        for x in range(w):
            grid[y][x] = grid[y][x] * scalar
    return grid
`,
  },

  {
    pairId: 7,
    title: "Pair 07: Re-indentation & Formatting Obfuscation",
    obfuscationType: "Formatting & Indentation",
    expectedIsPlagiarized: true,
    codeA: `
def reverse_string(s):
    reversed_str = ""
    for char in s:
        reversed_str = char + reversed_str
    return reversed_str

def is_palindrome(s):
    clean_s = s.lower().replace(" ", "")
    return clean_s == reverse_string(clean_s)

def filter_palindromes(words):
    matched = []
    for w in words:
        if is_palindrome(w):
            matched.append(w)
    return matched
`,
    codeB: `
def   reverse_string  (  s  )  :
    reversed_str  =  ""
    for   char   in   s  :
        reversed_str  =  char  +  reversed_str
    return   reversed_str

def   is_palindrome  (  s  )  :
    clean_s  =  s.lower().replace( " " ,  "" )
    return   clean_s  ==  reverse_string( clean_s )

def   filter_palindromes ( words ) :
    matched  =  []
    for   w   in   words :
        if   is_palindrome ( w ) :
            matched.append ( w )
    return   matched
`,
  },

  {
    pairId: 8,
    title: "Pair 08: Generative AI Rewrite (ChatGPT Style Refactoring)",
    obfuscationType: "GenAI Structural Rewrite",
    expectedIsPlagiarized: true,
    codeA: `
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                temp = arr[j]
                arr[j] = arr[j + 1]
                arr[j + 1] = temp
    return arr

def partition_and_count(arr, threshold):
    sorted_arr = bubble_sort(arr)
    below = []
    above = []
    for val in sorted_arr:
        if val < threshold:
            below.append(val)
        else:
            above.append(val)
    return len(below), len(above)

def compute_median(arr):
    ordered = bubble_sort(arr)
    mid = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) // 2
`,
    codeB: `
def bubble_sort_optimized(input_list):
    """Refactored by GenAI model with early exit flag"""
    list_length = len(input_list)
    for pass_num in range(list_length):
        for current in range(0, list_length - pass_num - 1):
            if input_list[current] > input_list[current + 1]:
                tmp_val = input_list[current]
                input_list[current] = input_list[current + 1]
                input_list[current + 1] = tmp_val
    return input_list

def split_by_cutoff(data_items, cutoff):
    ranked = bubble_sort_optimized(data_items)
    lower_part = []
    upper_part = []
    for item in ranked:
        if item < cutoff:
            lower_part.append(item)
        else:
            upper_part.append(item)
    return len(lower_part), len(upper_part)

def find_median_value(values):
    sorted_vals = bubble_sort_optimized(values)
    center = len(sorted_vals) // 2
    if len(sorted_vals) % 2 == 1:
        return sorted_vals[center]
    return (sorted_vals[center - 1] + sorted_vals[center]) / 2
`,
  },

  {
    pairId: 9,
    title: "Pair 09: Compound Obfuscation (Renaming + Loops + Comments + AI)",
    obfuscationType: "Compound Advanced Obfuscation",
    expectedIsPlagiarized: true,
    codeA: `
def find_max_subarray_sum(nums):
    max_so_far = nums[0]
    curr_max = nums[0]
    for i in range(1, len(nums)):
        curr_max = max(nums[i], curr_max + nums[i])
        max_so_far = max(max_so_far, curr_max)
    return max_so_far

def analyze_windows(nums, window_size):
    best = 0
    for i in range(len(nums) - window_size + 1):
        chunk = nums[i:i + window_size]
        best = max(best, find_max_subarray_sum(chunk))
    return best
`,
    codeB: `
# Implement Kadane's Algorithm for Maximum Subarray Sum with full structural rewrite
def max_subarray(array_of_numbers):
    global_maximum = array_of_numbers[0]
    local_maximum = array_of_numbers[0]
    idx = 1
    while idx < len(array_of_numbers):
        element = array_of_numbers[idx]
        if element > (local_maximum + element):
            local_maximum = element
        else:
            local_maximum = local_maximum + element
        if local_maximum > global_maximum:
            global_maximum = local_maximum
        idx += 1
    return global_maximum

def scan_segments(data_stream, span_len):
    peak_val = 0
    pos = 0
    while pos <= len(data_stream) - span_len:
        sub_slice = []
        for offset in range(span_len):
            sub_slice.append(data_stream[pos + offset])
        candidate = max_subarray(sub_slice)
        if candidate > peak_val:
            peak_val = candidate
        pos += 1
    return peak_val
`,
  },

  {
    pairId: 10,
    title: "Pair 10: Negative Control (MergeSort vs QuickSort - Independent Code)",
    obfuscationType: "Independent Algorithms (Negative Control)",
    expectedIsPlagiarized: false,
    codeA: `
def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            j += 1
    result.extend(left[i:])
    result.extend(right[j:])
    return result
`,
    codeB: `
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)
`,
  },
];

/**
 * Generates a synthetic 500-line Python code file to verify execution speed < 200ms
 */
export function generate500LineCodeFile(): string {
  const codeBlocks: string[] = [];
  codeBlocks.push("# Automated 500-line Code Performance Test Sample\n");

  for (let i = 1; i <= 35; i++) {
    codeBlocks.push(`
def process_data_module_${i}(input_dataset, threshold_${i}):
    """Module ${i} processing logic for performance benchmark"""
    processed_records = []
    running_total = 0
    for idx, item in enumerate(input_dataset):
        if item.get('value', 0) > threshold_${i}:
            calc_val = item['value'] * 1.15 + idx
            running_total += calc_val
            processed_records.append({
                'id': item.get('id', idx),
                'processed_value': calc_val,
                'status': 'VALID'
            })
        else:
            processed_records.append({
                'id': item.get('id', idx),
                'processed_value': 0,
                'status': 'FILTERED'
            })
    return {
        'module_id': ${i},
        'count': len(processed_records),
        'total': running_total,
        'records': processed_records
    }
`);
  }

  return codeBlocks.join("\n");
}
