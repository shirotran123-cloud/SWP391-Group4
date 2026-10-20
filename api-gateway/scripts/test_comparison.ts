import { ASTNormalizer } from '../src/plagiarism/ast-engine/ast-normalizer';
import { WinnowingEngine } from '../src/plagiarism/ast-engine/winnowing';

const codeLeft = `package com.aita.autograder;

import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        if (!input.hasNextInt()) {
            input.close();
            return;
        }

        int count = input.nextInt();
        int[] values = new int[count];
        for (int index = 0; index < count; index++) {
            values[index] = input.nextInt();
        }
        input.close();

        mergeSort(values, new int[count], 0, count - 1);

        StringBuilder output = new StringBuilder();
        for (int index = 0; index < count; index++) {
            if (index > 0) output.append(' ');
            output.append(values[index]);
        }
        System.out.println(output);
    }
}`;

const codeRight = `package com.aita.autograder;

import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;

        int n = sc.nextInt();
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }

        // Thuat toan Bubble Sort O(N^2)
        sortAndPrintAndSaveToDatabase(arr);
    }
}`;

const normA = ASTNormalizer.normalize(codeLeft, 'java');
const normB = ASTNormalizer.normalize(codeRight, 'java');

console.log('Norm A tokens count:', normA.tokens.length);
console.log('Norm B tokens count:', normB.tokens.length);

const fpA = WinnowingEngine.computeFingerprints(normA.tokens);
const fpB = WinnowingEngine.computeFingerprints(normB.tokens);

const setA = new Set(fpA.map(f => f.hashValue));
const setB = new Set(fpB.map(f => f.hashValue));

let common = 0;
for (const h of setA) {
  if (setB.has(h)) common++;
}

console.log('fpA size:', setA.size);
console.log('fpB size:', setB.size);
console.log('Common hashes:', common);
console.log('Containment B in A:', ((common / setB.size) * 100).toFixed(1) + '%');
console.log('Containment A in B:', ((common / setA.size) * 100).toFixed(1) + '%');
console.log('Max Containment:', Math.max(common / setB.size, common / setA.size) * 100 + '%');
