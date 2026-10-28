import { runExperiments, ExperimentResult } from '../src/plagiarism/ast-engine/ieee-benchmark';

export { runExperiments, ExperimentResult };

if (require.main === module) {
  runExperiments()
    .then((results) => {
      console.log('=== IEEE BENCHMARK EXPERIMENTAL RESULTS ===');
      console.table(results);
    })
    .catch(console.error);
}
