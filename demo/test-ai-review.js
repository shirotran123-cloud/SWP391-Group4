const testCode = `
public class GodManager {
    public static void sortAndPrintAndSave() {
        int a = 500;
        int b = 999;
        System.out.println(a + b);
    }
}
`;

async function testReview() {
  try {
    const res = await fetch('http://localhost:3001/api/v1/ai/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: 'TEST-SUBMISSION-001',
        language: 'java',
        sourceFiles: [{ filename: 'GodManager.java', content: testCode }],
        assignmentTopic: 'Thuat toan & Huong doi tuong SOLID',
        learningOutcomes: ['Clean Code', 'SOLID Principles']
      })
    });

    const d = await res.json();
    console.log('=== KET QUA REVIEW TU GENAI HUB (PORT 3001) ===');
    console.log('Clean Code Score:', d.clean_code_score + ' / 10.0');
    console.log('SOLID Average Score:', d.solid_score + ' / 10.0');
    console.log('SOLID 5-Axis Breakdown:', d.solid_breakdown);
    console.log('\n--- NHAN XET TONG THE ---');
    console.log(d.overall_summary);
    console.log('\n--- DANH SACH CODE SMELLS & GOI Y SUA TU AI ---');
    console.log(`Phat hien ${d.feedback_json?.length || 0} van de:`);
    (d.feedback_json || []).forEach((smell, i) => {
      console.log(`\n[Loi ${i + 1}] Dong ${smell.line_start}-${smell.line_end} [${smell.severity}]`);
      console.log(` - Nguyen ly vi pham: ${smell.rule}`);
      console.log(` - Loai loi: ${smell.smell_type}`);
      console.log(` - Goi y sua tu AI: ${smell.suggestion}`);
    });
  } catch (err) {
    console.error('Loi khi goi GenAI Hub:', err.message);
  }
}

testReview();
