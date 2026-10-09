import {
  cleanupLearningWorkspaceMatrix,
  seedLearningWorkspaceMatrix,
} from "./learning-workspace-matrix-fixture.mjs";

// node scripts/e2e/learning-workspace-matrix-cli.mjs seed|cleanup [--allow-dev-db]
// Without --allow-dev-db it only accepts the isolated E2E runtime (port 45441); the
// flag lets the Owner add or remove the synthetic course in the root local dev database.
const [command, ...flags] = process.argv.slice(2);
try {
  process.loadEnvFile(".env.local");
} catch {
  // The caller may already provide the environment.
}
const options = { allowDevDatabase: flags.includes("--allow-dev-db") };

try {
  if (command === "seed") {
    const result = await seedLearningWorkspaceMatrix(process.env, options);
    console.log(`Seeded /learn/${result.courseSlug}/<topic> for student@gmail.com:`);
    for (const topic of Object.values(result.topics)) console.log(`  ${topic.slug}`);
  } else if (command === "cleanup") {
    await cleanupLearningWorkspaceMatrix(process.env, options);
    console.log("Removed the D8 learning matrix.");
  } else {
    throw new Error("Usage: learning-workspace-matrix-cli.mjs seed|cleanup [--allow-dev-db]");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
