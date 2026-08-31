import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const required = [
  'PROJECT_CONTEXT.md', 'AGENTS.md', 'CLAUDE.md', 'GEMINI.md',
  'CONTRIBUTING.md', 'docs/decisions/README.md',
];
const errors = [];
for (const path of required) if (!existsSync(path)) errors.push(`Missing ${path}`);

if (!errors.length) {
  const context = readFileSync('PROJECT_CONTEXT.md', 'utf8');
  for (const key of ['schema', 'updated', 'phase', 'state', 'next', 'lang', 'repo']) {
    if (!new RegExp(`^${key}:\\s*\\S+`, 'm').test(context)) errors.push(`Missing header key: ${key}`);
  }
  for (const section of ['Goal + laws', 'Cost policy', 'Architecture', 'Scheduler', 'Intelligence', 'Quality', 'Roadmap', 'Current state', 'Hand-off', 'Decisions']) {
    if (!context.includes(section)) errors.push(`Missing context section: ${section}`);
  }

  const handoff = context.match(/## 13 Hand-off[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[1] ?? '';
  const handoffCount = handoff.split('\n').filter((line) => line.startsWith('- ')).length;
  if (handoffCount > 3) errors.push(`Hand-off has ${handoffCount} entries; maximum is 3`);

  const links = [...context.matchAll(/\]\((docs\/decisions\/[^)]+\.md)\)/g)].map((m) => m[1]);
  if (!links.length) errors.push('No ADR links in PROJECT_CONTEXT.md');
  for (const path of links) if (!existsSync(path)) errors.push(`Broken ADR link: ${path}`);

  const index = readFileSync('docs/decisions/README.md', 'utf8');
  for (const path of links) {
    const name = path.split('/').at(-1);
    if (!index.includes(name)) errors.push(`ADR missing from index: ${name}`);
  }

  for (const path of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.github/copilot-instructions.md']) {
    if (existsSync(path)) {
      const text = readFileSync(path, 'utf8');
      if (!text.includes('AGENTS.md') && !text.includes('PROJECT_CONTEXT.md')) errors.push(`${path} does not point to canonical instructions`);
    }
  }
}

const base = process.env.CONTEXT_BASE_SHA;
if (base && /^[0-9a-f]{7,40}$/i.test(base)) {
  try {
    const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    const implementation = changed.some((p) => /^(src\/|tests\/|public\/|package\.json$|package-lock\.json$|.*config\.[cm]?[jt]s$)/.test(p));
    if (implementation && !changed.includes('PROJECT_CONTEXT.md')) errors.push('Implementation changed without PROJECT_CONTEXT.md in this change set');
  } catch (error) {
    errors.push(`Could not compare context with base ${base}: ${error.message}`);
  }
}

if (errors.length) {
  console.error(`Project context validation failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('Project context validation passed.');
