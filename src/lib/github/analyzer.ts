// GitHub 仓库分析器 — 解析 GitHub URL，通过 API 获取仓库关键信息
// 纯工具函数，不依赖 AI，负责数据采集

// GitHub 仓库原始数据结构
export interface GitHubRepoData {
  owner: string;
  repo: string;
  description: string | null;
  stars: number;
  language: string | null;
  topics: string[];
  readme: string;
  directoryTree: string[];
  packageJson: Record<string, unknown> | null;
}

/**
 * 从 GitHub URL 中解析 owner 和 repo
 * 支持格式：
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/branch
 *   github.com/owner/repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // 移除末尾斜杠
  const cleaned = url.trim().replace(/\/+$/, "");

  // 匹配 github.com/owner/repo 格式
  const match = cleaned.match(
    /(?:https?:\/\/)?github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/
  );

  if (!match) return null;

  return {
    owner: match[1],
    // 去掉 .git 后缀（如果有）
    repo: match[2].replace(/\.git$/, ""),
  };
}

/**
 * 调用 GitHub API 获取仓库的关键信息
 * 并行请求：仓库信息、README、目录树、package.json
 */
export async function analyzeRepo(
  owner: string,
  repo: string
): Promise<GitHubRepoData> {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "DemoGen-Agent",
  };

  // 如果配置了 GitHub token，添加认证头（提高 rate limit）
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // 并行发起所有请求，加速数据采集
  const [repoInfo, readme, tree, packageJson] = await Promise.allSettled([
    fetchRepoInfo(baseUrl, headers),
    fetchReadme(baseUrl, headers),
    fetchDirectoryTree(baseUrl, headers),
    fetchPackageJson(baseUrl, headers),
  ]);

  // 提取仓库基本信息
  const info =
    repoInfo.status === "fulfilled"
      ? repoInfo.value
      : { description: null, stars: 0, language: null, topics: [] };

  return {
    owner,
    repo,
    description: info.description,
    stars: info.stars,
    language: info.language,
    topics: info.topics,
    readme: readme.status === "fulfilled" ? readme.value : "",
    directoryTree: tree.status === "fulfilled" ? tree.value : [],
    packageJson: packageJson.status === "fulfilled" ? packageJson.value : null,
  };
}

// --- 内部函数 ---

/** 获取仓库基本信息（描述、star、语言、标签） */
async function fetchRepoInfo(
  baseUrl: string,
  headers: Record<string, string>
) {
  const res = await fetch(baseUrl, { headers });
  if (!res.ok) throw new Error(`Failed to fetch repo info: ${res.status}`);
  const data = await res.json();
  return {
    description: data.description as string | null,
    stars: data.stargazers_count as number,
    language: data.language as string | null,
    topics: (data.topics || []) as string[],
  };
}

/** 获取 README 内容（Base64 解码） */
async function fetchReadme(
  baseUrl: string,
  headers: Record<string, string>
) {
  const res = await fetch(`${baseUrl}/readme`, { headers });
  if (!res.ok) return "";
  const data = await res.json();
  // README 内容是 Base64 编码的
  return Buffer.from(data.content, "base64").toString("utf-8");
}

/** 获取目录树（只取第一层 + 关键子目录） */
async function fetchDirectoryTree(
  baseUrl: string,
  headers: Record<string, string>
) {
  // 使用 recursive tree API，但限制深度避免请求过大
  const res = await fetch(`${baseUrl}/git/trees/HEAD?recursive=1`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  const paths: string[] = (data.tree || [])
    .map((item: { path: string }) => item.path)
    // 过滤掉深层文件，只保留前 3 层目录结构
    .filter((path: string) => path.split("/").length <= 3)
    // 限制总数，避免大型仓库数据过多
    .slice(0, 200);
  return paths;
}

/** 获取 package.json（如果存在） */
async function fetchPackageJson(
  baseUrl: string,
  headers: Record<string, string>
) {
  const res = await fetch(`${baseUrl}/contents/package.json`, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}
