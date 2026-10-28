import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export default async function globalSetup(): Promise<void> {
  await execFileAsync("npm", ["run", "build", "--workspace", "@gtm-observability/extension"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      TEST_PRODUCT_ACCESS_TOKEN: "test_admin_access_token_0001",
    },
  });
}
