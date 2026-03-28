// src/lib/github/analyzer.ts
// GitHub 仓库解析 — 通过 GitHub REST API 获取仓库信息
// 用于让 AI 理解用户的项目

/**
 * 从 GitHub URL 中提取 owner 和 repo 名称
 * 支持格式：
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/main/...
 *   github.com/owner/repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // 正则匹配 github.com/owner/repo 部分
  const match = url.match(/github\.com\/([^/]+)\/([^/\s#?]+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""), // 去掉可能的 .git 后缀
  };
}

/**
 * 仓库分析结果的类型定义
 */
export interface RepoAnalysis {
  name: string;           // 仓库名称
  fullName: string;       // owner/repo 完整名
  description: string;    // 仓库描述
  language: string;       // 主要编程语言
  stars: number;          // star 数
  topics: string[];       // 标签
  readme: string;         // README 内容（截断到合理长度）
  directoryTree: string;  // 目录结构（树形文本）
  packageInfo: string;    // package.json 或 pyproject.toml 等依赖信息
  hasDeployUrl: boolean;  // 是否有 homepage（已部署 URL）
  deployUrl: string;      // 部署地址
}

/**
 * 调用 GitHub API 的通用函数
 * 自动带上 token（如果环境变量里有的话）
 */
async function githubFetch(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "DemoGen",
  };
  // 如果有 GitHub token，带上可以提高速率限制（从 60 次/小时到 5000 次/小时）
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return fetch(`https://api.github.com${path}`, { headers });
}

/**
 * 分析 GitHub 仓库
 * 这是主函数，会并行调用多个 GitHub API 获取仓库信息
 *
 * @param owner - 仓库所有者
 * @param repo - 仓库名称
 * @returns 结构化的仓库分析结果
 */
export async function analyzeRepo(
  owner: string,
  repo: string
): Promise<RepoAnalysis> {
  // 并行请求三个 API，提高速度
  // Promise.allSettled 确保即使某个请求失败，其他的仍然继续
  const [repoRes, readmeRes, treeRes] = await Promise.allSettled([
    githubFetch(`/repos/${owner}/${repo}`),
    githubFetch(`/repos/${owner}/${repo}/readme`),
    githubFetch(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`),
  ]);

  // 1. 解析仓库基本信息
  let repoData: Record<string, unknown> = {};
  if (repoRes.status === "fulfilled" && repoRes.value.ok) {
    repoData = await repoRes.value.json();
  }

  // 2. 解析 README 内容
  // GitHub API 返回 base64 编码的内容，需要解码
  let readme = "";
  if (readmeRes.status === "fulfilled" && readmeRes.value.ok) {
    const readmeData = await readmeRes.value.json();
    if (readmeData.content) {
      readme = Buffer.from(readmeData.content, "base64").toString("utf-8");
      // 截断过长的 README（避免消耗太多 token）
      if (readme.length > 8000) {
        readme = readme.slice(0, 8000) + "\n\n... (README 内容过长，已截断)";
      }
    }
  }

  // 3. 解析目录树
  // 将 API 返回的文件列表转换为缩进的树形文本
  let directoryTree = "";
  if (treeRes.status === "fulfilled" && treeRes.value.ok) {
    const treeData = await treeRes.value.json();
    if (treeData.tree) {
      directoryTree = buildDirectoryTree(treeData.tree);
    }
  }

  // 4. 尝试获取 package.json（如果是 Node.js 项目）
  const packageInfo = await fetchFileContent(owner, repo, "package.json");

  return {
    name: (repoData.name as string) || repo,
    fullName: `${owner}/${repo}`,
    description: (repoData.description as string) || "",
    language: (repoData.language as string) || "Unknown",
    stars: (repoData.stargazers_count as number) || 0,
    topics: (repoData.topics as string[]) || [],
    readme,
    directoryTree,
    packageInfo,
    hasDeployUrl: !!(repoData.homepage as string),
    deployUrl: (repoData.homepage as string) || "",
  };
}

/**
 * 获取仓库中某个文件的内容
 * 如果文件不存在或太大，返回空字符串
 */
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  try {
    const res = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`);
    if (!res.ok) return "";
    const data = await res.json();
    if (!data.content) return "";
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    // 截断过长的文件
    return content.length > 3000
      ? content.slice(0, 3000) + "\n... (已截断)"
      : content;
  } catch {
    return "";
  }
}

/**
 * 将 GitHub API 返回的 tree 数组转换为可读的目录结构文本
 * 只展示前 80 个条目，过滤掉常见的无意义目录（node_modules 等）
 *
 * 例如输出：
 *   src/
 *     app/
 *       page.tsx
 *     components/
 *       Button.tsx
 *   package.json
 */
function buildDirectoryTree(
  tree: Array<{ path: string; type: string }>
): string {
  // 过滤掉不重要的文件和目录
  const ignorePaths = [
    "node_modules",
    ".git",
    ".next",
    "__pycache__",
    ".venv",
    "dist",
    "build",
    ".cache",
    "coverage",
  ];

  const filtered = tree.filter((item) => {
    return !ignorePaths.some(
      (ignore) =>
        item.path.startsWith(ignore + "/") || item.path === ignore
    );
  });

  // 只取前 80 个条目，避免输出太长
  const limited = filtered.slice(0, 80);
  const lines = limited.map((item) => {
    // tree 类型是目录，blob 类型是文件
    const suffix = item.type === "tree" ? "/" : "";
    return item.path + suffix;
  });

  if (filtered.length > 80) {
    lines.push(`... (还有 ${filtered.length - 80} 个文件/目录)`);
  }

  return lines.join("\n");
}
