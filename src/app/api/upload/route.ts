// 文件上传 API — 接收用户上传的文件，解析文本内容后返回
// 支持 .md / .txt / .pdf 格式（PDF 暂用简单提取，后续可接入更好的解析库）
import { NextResponse } from "next/server";

// 支持的文件类型及最大大小（5MB）
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".md", ".txt", ".pdf"];

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "未收到文件" },
        { status: 400 }
      );
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "文件过大，最大支持 5MB" },
        { status: 400 }
      );
    }

    // 检查文件扩展名
    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `不支持的文件格式: ${ext}，支持 ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // 根据文件类型解析内容
    let content: string;

    if (ext === ".md" || ext === ".txt") {
      // Markdown / 纯文本：直接读取
      content = await file.text();
    } else if (ext === ".pdf") {
      // PDF：读取为 ArrayBuffer，尝试简单文本提取
      // 注意：这是一个简化实现，复杂 PDF 可能提取不完整
      const buffer = await file.arrayBuffer();
      content = extractTextFromPdf(Buffer.from(buffer));
    } else {
      content = await file.text();
    }

    // 返回解析结果
    return NextResponse.json({
      filename: file.name,
      size: file.size,
      content: content.slice(0, 50000), // 限制返回内容大小
    });
  } catch (err) {
    console.error("文件上传处理失败:", err);
    return NextResponse.json(
      { error: "文件处理失败，请重试" },
      { status: 500 }
    );
  }
}

// 获取文件扩展名（小写）
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

/**
 * 简易 PDF 文本提取 — 从 PDF 二进制数据中提取可读文本
 * 这是一个简化实现，通过正则匹配 PDF 文本流中的字符串
 * 对于复杂 PDF（扫描件、加密等）可能无法提取，后续可接入 pdf-parse 等库
 */
function extractTextFromPdf(buffer: Buffer): string {
  const str = buffer.toString("latin1");
  const textParts: string[] = [];

  // 匹配 PDF 文本对象中的括号内容 (text)
  const textRegex = /\(([^)]*)\)/g;
  let match;
  while ((match = textRegex.exec(str)) !== null) {
    const text = match[1];
    // 过滤掉太短或看起来像控制字符的内容
    if (text.length > 1 && /[a-zA-Z\u4e00-\u9fff]/.test(text)) {
      textParts.push(text);
    }
  }

  if (textParts.length > 0) {
    return textParts.join(" ");
  }

  // 兜底：如果正则提取失败，返回提示
  return "[PDF 文件内容提取失败，建议将文档转为 Markdown 或文本格式上传]";
}
