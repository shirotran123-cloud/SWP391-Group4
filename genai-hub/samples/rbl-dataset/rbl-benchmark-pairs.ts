/**
 * RBL Research Core Experimental Dataset - 10 Code Pair Benchmark Suite
 *
 * Contains 10 real-world pair test scenarios evaluating AST + Winnowing resilience against:
 * 1. Identifier Renaming (Variables & Functions)
 * 2. Loop & Control Flow Restructuring
 * 3. Comment & Dead Code Injection
 * 4. Function Extraction & Inlining
 * 5. Branch Inversion & Logical Equivalence
 * 6. Operator & Expression Rewriting
 * 7. Re-indentation & Formatting Tampering
 * 8. Generative AI Code Refactoring (ChatGPT / Claude)
 * 9. Compound Obfuscation (Multiple combined techniques)
 * 10. Negative Control (Different algorithms solving same problem - e.g. QuickSort vs MergeSort)
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
        val = calculate_factorial(item)
        results.append(val)
    return results
`,
    codeB: `
def compute_fact(x_val):
    // Rename variable n to x_val and total_result to res
    if x_val <= 1:
        return 1
    res = x_val * compute_fact(x_val - 1)
    return res

def run_pipeline(arr_input):
    output_array = []
    for element in arr_input:
        tmp = compute_fact(element)
        output_array.append(tmp)
    return output_array
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
            total_sum += i
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
`,
    codeB: `
def accum_evens(max_num):
    accumulator = 0
    curr_idx = 0
    while curr_idx <= max_num:
        if curr_idx % 2 == 0:
            accumulator = accumulator + curr_idx
        curr_idx += 1
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
`,
  },

  {
    pairId: 3,
    title: "Pair 03: Dead Code & Junk Comment Injection",
    obfuscationType: "Dead Code Injection",
    expectedIsPlagiarized: true,
    codeA: `
def fibonacci(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
`,
    codeB: `
# Author: Anonymous Student Submission 2026
# Module: Mathematics & Algorithm Analysis
def fibonacci(n):
    # Dummy unused variables injected
    unused_flag = True
    dummy_counter = 999
    
    if n <= 0:
        # Check negative bound
        return 0
    elif n == 1:
        # Check base unit case
        return 1
        
    # Unused helper loop
    for k in range(0, 1):
        dummy_counter += k
        
    a, b = 0, 1
    for idx in range(2, n + 1):
        a, b = b, a + b
    return b
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
`,
    codeB: `
def is_divisible(n, divisor):
    return n % divisor == 0

def check_prime(number):
    if number <= 1:
        return False
    limit = int(number ** 0.5) + 1
    for i in range(2, limit):
        if is_divisible(number, i):
            return False
    return True

def filter_prime_numbers(s_val, e_val):
    result_list = []
    for current in range(s_val, e_val + 1):
        if check_prime(current):
            result_list.append(current)
    return result_list
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
                C[i][j] += A[i][k] * B[k][j]
    return C
`,
    codeB: `
def multiply_matrices(mat1, mat2):
    r1 = len(mat1)
    c1 = len(mat1[0])
    c2 = len(mat2[0])
    res = [[0] * c2 for _ in range(r1)]
    for idx_i in range(0, r1):
        for idx_j in range(0, c2):
            for idx_k in range(0, c1):
                res[idx_i][idx_j] = res[idx_i][idx_j] + (mat1[idx_i][idx_k] * mat2[idx_k][idx_j])
    return res
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
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr
`,
    codeB: `
def bubble_sort(input_list):
    """Refactored by GenAI model"""
    list_length = len(input_list)
    for pass_num in range(list_length - 1):
        swapped = False
        for current in range(0, list_length - pass_num - 1):
            if input_list[current] > input_list[current + 1]:
                temp = input_list[current]
                input_list[current] = input_list[current + 1]
                input_list[current + 1] = temp
                swapped = True
        if not swapped:
            break
    return input_list
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
`,
    codeB: `
# Implement Kadane's Algorithm for Maximum Subarray Sum
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
