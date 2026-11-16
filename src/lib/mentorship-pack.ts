import fs from "fs";
import path from "path";
import type { PackKind } from "./beginner-pack";

export const MENTORSHIP_MODULES = [
  {
    id: "mentor-1",
    folder: "01-market-structure-liquidity",
    title: "Market Structure & Liquidity",
    short: "Material 1",
  },
  {
    id: "mentor-2",
    folder: "02-contract-expansion-supply-demand",
    title: "Contract Expansion & Supply/Demand",
    short: "Material 2",
  },
  {
    id: "mentor-3",
    folder: "03-qm-fractal-qm-in-a-range",
    title: "QM Fractal & QM in a Range",
    short: "Material 3",
  },
  {
    id: "mentor-4",
    folder: "04-daily-range-power-of-3",
    title: "Daily Range & Power of 3",
    short: "Material 4",
  },
] as const;

export type MentorshipModuleId = (typeof MENTORSHIP_MODULES)[number]["id"];

export const MENTORSHIP_MODULE_IDS = MENTORSHIP_MODULES.map((m) => m.id);

export function isMentorshipModule(id: string | null | undefined): id is MentorshipModuleId {
  return MENTORSHIP_MODULE_IDS.includes(id as MentorshipModuleId);
}

export function findMentorshipModule(id: string) {
  return MENTORSHIP_MODULES.find((m) => m.id === id) || null;
}

export type MentorshipFile = {
  relPath: string;
  name: string;
  kind: PackKind | "file";
  mime: string;
};

const MIME: Record<string, { mime: string; kind: PackKind | "file" }> = {
  ".mp4": { mime: "video/mp4", kind: "video" },
  ".webm": { mime: "video/webm", kind: "video" },
  ".jpg": { mime: "image/jpeg", kind: "image" },
  ".jpeg": { mime: "image/jpeg", kind: "image" },
  ".png": { mime: "image/png", kind: "image" },
  ".webp": { mime: "image/webp", kind: "image" },
  ".gif": { mime: "image/gif", kind: "image" },
  ".pdf": { mime: "application/pdf", kind: "pdf" },
  ".pptx": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "slides",
  },
  ".ppt": { mime: "application/vnd.ms-powerpoint", kind: "slides" },
};

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function walk(dir: string, prefix = ""): MentorshipFile[] {
  if (!fs.existsSync(dir)) return [];
  const out: MentorshipFile[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (/^readme\.txt$/i.test(entry.name)) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, rel));
      continue;
    }
    if (!entry.isFile()) continue;
    const meta = MIME[extOf(entry.name)] || {
      mime: "application/octet-stream",
      kind: "file" as const,
    };
    out.push({ relPath: rel.replace(/\\/g, "/"), name: entry.name, kind: meta.kind, mime: meta.mime });
  }
  return out;
}

export function mentorshipDir(folder: string) {
  return path.join(process.cwd(), "data", "mentorship", folder);
}

export function readMentorshipReadme(moduleId: string) {
  const mod = findMentorshipModule(moduleId);
  if (!mod) return "";
  const file = path.join(mentorshipDir(mod.folder), "README.txt");
  if (!fs.existsSync(file)) return "";
  return fs.readFileSync(file, "utf8");
}

export function listMentorshipFiles(moduleId: string): MentorshipFile[] {
  const mod = findMentorshipModule(moduleId);
  if (!mod) return [];
  const dir = mentorshipDir(mod.folder);
  fs.mkdirSync(dir, { recursive: true });
  return walk(dir).sort((a, b) =>
    a.relPath.localeCompare(b.relPath, undefined, { numeric: true, sensitivity: "base" })
  );
}

export function resolveMentorshipFile(moduleId: string, relPath: string) {
  const mod = findMentorshipModule(moduleId);
  if (!mod) return null;
  const safe = relPath.replace(/\\/g, "/").split("/").filter((p) => p && p !== "." && p !== "..");
  if (safe.length === 0) return null;
  const full = path.join(mentorshipDir(mod.folder), ...safe);
  const root = mentorshipDir(mod.folder);
  if (!full.startsWith(root)) return null;
  const files = listMentorshipFiles(moduleId);
  const hit = files.find((f) => f.relPath === safe.join("/"));
  if (!hit) return null;
  return { ...hit, fullPath: full };
}
