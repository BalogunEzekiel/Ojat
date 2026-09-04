import bcrypt from "bcryptjs";
import { performance } from "node:perf_hooks";

const password = "BenchmarkPassword123!";

for (const rounds of [10, 11, 12]) {
  const start = performance.now();

  const hash = await bcrypt.hash(password, rounds);

  const hashTime = performance.now() - start;

  const compareStart = performance.now();

  await bcrypt.compare(password, hash);

  const compareTime = performance.now() - compareStart;

  console.log(
    `[BCRYPT] rounds=${rounds} hash=${Math.round(hashTime)}ms compare=${Math.round(compareTime)}ms`
  );
}
