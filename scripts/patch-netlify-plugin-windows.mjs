import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function findServerJs(root) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (name === ".git" || name === ".next") continue;
        stack.push(full);
      } else if (
        name === "server.js" &&
        full.includes(`${join("plugin-nextjs")}`) &&
        full.includes(`${join("dist", "build", "content")}`)
      ) {
        return full;
      }
    }
  }
  return null;
}

const plugin = findServerJs(join(process.cwd(), "node_modules"));
if (!plugin) throw new Error("plugin server.js not found");
console.log(`plugin=${plugin}`);

let s = readFileSync(plugin, "utf8");
let ops = 0;

if (!s.includes("Skipping styled-jsx hoist check on Windows")) {
  const from = `    try {
      const nextEntryAbsolutePath = serverHandlerRequire.resolve("next");
      const nextRequire = createRequire(nextEntryAbsolutePath);
      nextRequire.resolve("styled-jsx");
    } catch {
      throw new Error(
        "node_modules are not installed correctly, if you are using pnpm please set the public hoist pattern to: \`public-hoist-pattern[]=*\`.\\nRefer to your docs for more details: https://docs.netlify.com/integrations/frameworks/next-js/overview/#pnpm-support"
      );
    }`;
  const to = `    try {
      const nextEntryAbsolutePath = serverHandlerRequire.resolve("next");
      const nextRequire = createRequire(nextEntryAbsolutePath);
      nextRequire.resolve("styled-jsx");
    } catch {
      if (process.platform === "win32") {
        console.warn("Skipping styled-jsx hoist check on Windows local deploy after dereference copy.");
      } else {
        throw new Error(
          "node_modules are not installed correctly, if you are using pnpm please set the public hoist pattern to: \`public-hoist-pattern[]=*\`.\\nRefer to your docs for more details: https://docs.netlify.com/integrations/frameworks/next-js/overview/#pnpm-support"
        );
      }
    }`;
  if (!s.includes(from)) {
    // looser replace
    s = s.replace(
      /try \{\s*const nextEntryAbsolutePath = serverHandlerRequire\.resolve\("next"\);[\s\S]*?throw new Error\(\s*"node_modules are not installed correctly[\s\S]*?pnpm-support"\s*\);\s*\}/,
      `try {
      const nextEntryAbsolutePath = serverHandlerRequire.resolve("next");
      const nextRequire = createRequire(nextEntryAbsolutePath);
      nextRequire.resolve("styled-jsx");
    } catch {
      if (process.platform === "win32") {
        console.warn("Skipping styled-jsx hoist check on Windows local deploy after dereference copy.");
      } else {
        throw new Error(
          "node_modules are not installed correctly, if you are using pnpm please set the public hoist pattern to: \`public-hoist-pattern[]=*\`.\\nRefer to your docs for more details: https://docs.netlify.com/integrations/frameworks/next-js/overview/#pnpm-support"
        );
      }
    }`,
    );
  } else {
    s = s.replace(from, to);
  }
  ops += 1;
}

// Windows cannot create symlinks/junctions without Developer Mode; Next standalone
// uses junctions into the project node_modules. Dereference on win32 so cp copies files.
const beforeVerbatim = s;
s = s.replace(
  /await cp\(([^;]+),\s*\{\s*recursive:\s*true,\s*verbatimSymlinks:\s*(?:true|process\.platform\s*!==\s*"win32"),\s*force:\s*true,/g,
  (match, args) => {
    ops += 1;
    return `await cp(${args}, {
      recursive: true,
      dereference: process.platform === "win32",
      verbatimSymlinks: process.platform !== "win32",
      force: true,`;
  },
);
if (s === beforeVerbatim) {
  s = s.replace(/verbatimSymlinks:\s*true/g, 'verbatimSymlinks: process.platform !== "win32"');
  if (s !== beforeVerbatim) ops += 1;
  const beforeDeref = s;
  s = s.replace(
    /verbatimSymlinks:\s*process\.platform\s*!==\s*"win32"/g,
    'dereference: process.platform === "win32", verbatimSymlinks: process.platform !== "win32"',
  );
  if (s !== beforeDeref) ops += 1;
}

if (!s.includes('Skipping recreateNodeModuleSymlinks on win32')) {
  s = s.replace(
    /for \(const \{\n      source: nodeModulesLocationInStandalone,\n      destination: locationInServerHandler\n    \} of nodeModulesLocations\) \{\n      const relativeToRoot = posixRelative\(standaloneRootDir, nodeModulesLocationInStandalone\);\n      const locationInProject = posixJoin\(outputFileTracingRoot, relativeToRoot\);\n      promises\.push\(recreateNodeModuleSymlinks\(locationInProject, locationInServerHandler\)\);\n    \}\n    await Promise\.all\(promises\);/,
    `if (process.platform !== "win32") {
      for (const {
        source: nodeModulesLocationInStandalone,
        destination: locationInServerHandler
      } of nodeModulesLocations) {
        const relativeToRoot = posixRelative(standaloneRootDir, nodeModulesLocationInStandalone);
        const locationInProject = posixJoin(outputFileTracingRoot, relativeToRoot);
        promises.push(recreateNodeModuleSymlinks(locationInProject, locationInServerHandler));
      }
      await Promise.all(promises);
    } else {
      console.warn("Skipping recreateNodeModuleSymlinks on win32");
    }`,
  );
  ops += 1;
}

writeFileSync(plugin, s);
console.log(`ops=${ops}`);
console.log(`has_skip_styled=${s.includes("Skipping styled-jsx hoist check on Windows")}`);
console.log(`has_skip_recreate=${s.includes("Skipping recreateNodeModuleSymlinks on win32")}`);
console.log(`verbatim_left_true=${(s.match(/verbatimSymlinks:\\s*true/g) || []).length}`);
