import {
  cleanupTopicBuilderMatrix,
  seedTopicBuilderMatrix,
  topicBuilderMatrix,
} from "./topic-builder-matrix-fixture.mjs";

// node scripts/e2e/topic-builder-matrix-cli.mjs seed|cleanup [--allow-dev-db]
// Mặc định chỉ chạy trên runtime E2E cô lập (cổng 45441); `--allow-dev-db` cho phép Owner
// thêm/gỡ khóa học tổng hợp này trên database dev local để QA bằng tay.
const [command, ...flags] = process.argv.slice(2);
try {
  process.loadEnvFile(".env.local");
} catch {
  // Môi trường có thể đã được truyền từ bên ngoài.
}
const options = { allowDevDatabase: flags.includes("--allow-dev-db") };

try {
  if (command === "seed") {
    const rows = await seedTopicBuilderMatrix(process.env, options);
    console.log(`Seeded the TFEAT4 topic builder matrix (password ${topicBuilderMatrix.password}):`);
    for (const row of rows) {
      const email = topicBuilderMatrix.users[row.user].email;
      console.log(`  ${row.topic.padEnd(9)} ${row.status.padEnd(9)} canEdit=${row.canEdit} ${email} ${row.url}`);
    }
  } else if (command === "cleanup") {
    await cleanupTopicBuilderMatrix(process.env, options);
    console.log("Removed the TFEAT4 topic builder matrix.");
  } else {
    throw new Error("Usage: topic-builder-matrix-cli.mjs seed|cleanup [--allow-dev-db]");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
