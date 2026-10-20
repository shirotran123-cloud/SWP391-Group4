import { ASTNormalizer } from '../src/plagiarism/ast-engine/ast-normalizer';

const code1 = `
Scanner sc = new Scanner(System.in);
int n = sc.nextInt();
int[] arr = new int[n];
for (int i = 0; i < n; i++) {
    arr[i] = sc.nextInt();
}
`;

const code2 = `
Scanner input = new Scanner(System.in);
int count = input.nextInt();
int[] values = new int[count];
for (int index = 0; index < count; index++) {
    values[index] = input.nextInt();
}
`;

const norm1 = ASTNormalizer.normalize(code1, 'java');
const norm2 = ASTNormalizer.normalize(code2, 'java');

console.log('Norm 1:', norm1.tokenString);
console.log('Norm 2:', norm2.tokenString);
console.log('Equal?:', norm1.tokenString === norm2.tokenString);
