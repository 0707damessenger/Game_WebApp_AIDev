import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const forbiddenRootDirectories = [
  'docs',
  'output',
  'test-results',
  'tests',
  'playwright-report',
];

const errors = [];
const rootEntries = readdirSync(workspaceRoot, { withFileTypes: true });
const projectEntries = rootEntries.filter(
  (entry) => entry.isDirectory() && /^Project_\d+_/.test(entry.name),
);

for (const directoryName of forbiddenRootDirectories) {
  const directoryPath = join(workspaceRoot, directoryName);
  if (existsSync(directoryPath) && statSync(directoryPath).isDirectory()) {
    errors.push(`根目录不允许存在 ${directoryName}/`);
  }
}

if (projectEntries.length === 0) {
  errors.push('根目录没有找到任何 Project_<数字>_项目名/ 项目目录');
}

for (const projectEntry of projectEntries) {
  for (const requiredDirectory of ['docs', 'prototype']) {
    const requiredPath = join(workspaceRoot, projectEntry.name, requiredDirectory);
    if (!existsSync(requiredPath) || !statSync(requiredPath).isDirectory()) {
      errors.push(`${projectEntry.name}/ 缺少必需目录 ${requiredDirectory}/`);
    }
  }
}

if (errors.length > 0) {
  console.error('工作区布局检查失败：');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`工作区布局检查通过：${projectEntries.length} 个项目，根目录无项目产物目录。`);
}
