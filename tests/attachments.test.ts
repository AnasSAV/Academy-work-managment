import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type Db } from "@/db";
import {
  attachmentsForOwners,
  createAttachment,
  deleteAttachment,
  describeOwner,
  listAttachments,
  ownersUnderModule,
  ownersUnderSemester,
} from "@/db/attachments";
import { NotFoundError } from "@/db/errors";
import { assessments, attachments, pastPapers } from "@/db/schema";
import {
  addChapters,
  createModule,
  createSemester,
  deleteChapter,
  deleteModule,
  deleteSemester,
  getChapterDeleteImpact,
  getModuleDeleteImpact,
  getSemesterDeleteImpact,
} from "@/db/services";
import {
  handleFile,
  handleUpload,
  isSameOrigin,
  parseRange,
  type HttpContext,
} from "@/server/attachments-http";
import { parseInput } from "@/lib/validation/parse";
import { moduleSchema } from "@/lib/validation/schemas";
import {
  deleteStored,
  detectMime,
  extensionOf,
  resolveStored,
  sanitizeFileName,
  saveUpload,
} from "@/lib/storage";

const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
]);
const HTML = new TextEncoder().encode("<html><script>alert(1)</script></html>");

let root: string;
let db: Db;
let ctx: HttpContext;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-"));
  db = createDatabase(":memory:");
  ctx = { db, root, maxBytes: 1024 * 1024 };
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const listFiles = (dir = root): string[] =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)],
        )
    : [];

function moduleInput(name: string) {
  const parsed = parseInput(moduleSchema, { name, color: "#3b82f6" });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

function makeModule(name = "M") {
  const semester = createSemester(db, { name: "S", startDate: null, endDate: null });
  return { semester, module: createModule(db, semester.id, moduleInput(name)) };
}

function upload(
  fields: Record<string, string>,
  file?: { name: string; bytes: Uint8Array; type?: string },
) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (file)
    form.set("file", new File([file.bytes as BlobPart], file.name, { type: file.type ?? "" }));
  return new Request("http://localhost:3000/api/attachments", { method: "POST", body: form });
}

describe("file names and types", () => {
  it("strips paths and unsafe characters from names", () => {
    expect(sanitizeFileName("..\\..\\evil/../notes: v2?.pdf")).toBe("notes v2.pdf");
    expect(sanitizeFileName("C:\\Users\\me\\slides.pptx")).toBe("slides.pptx");
    expect(sanitizeFileName("  a\u0000b   c\t.txt ")).toBe("ab c.txt");
    expect(sanitizeFileName("")).toBe("file");
    expect(sanitizeFileName("..")).toBe("file");
    expect(sanitizeFileName("x".repeat(300) + ".pdf").length).toBeLessThanOrEqual(150);
    expect(sanitizeFileName("x".repeat(300) + ".pdf").endsWith(".pdf")).toBe(true);
  });

  it("reads extensions safely", () => {
    expect(extensionOf("Report.PDF")).toBe(".pdf");
    expect(extensionOf("archive.tar.gz")).toBe(".gz");
    expect(extensionOf("noext")).toBe("");
    expect(extensionOf("weird.ext$")).toBe("");
  });

  it("trusts an inline type only when the bytes match", () => {
    expect(detectMime("a.pdf", PDF)).toBe("application/pdf");
    expect(detectMime("a.png", PNG)).toBe("image/png");
    expect(detectMime("a.pdf", HTML)).toBe("application/octet-stream");
    expect(detectMime("a.png", PDF)).toBe("application/octet-stream");
    expect(detectMime("a.jpg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectMime("a.gif", new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(detectMime("a.webp", new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe(
      "image/webp",
    );
  });

  it("keeps known non-inline types and identifies extension-less files by content", () => {
    expect(detectMime("notes.docx", HTML)).toContain("wordprocessingml");
    expect(detectMime("logo.svg", HTML)).toBe("image/svg+xml");
    expect(detectMime("weird.xyz", HTML)).toBe("application/octet-stream");
    expect(detectMime("screenshot", PNG)).toBe("image/png");
  });
});

describe("storage", () => {
  it("saves under a random name inside owner folders", () => {
    const saved = saveUpload(root, "module", 7, { name: "Outline.PDF", bytes: PDF });
    expect(saved).toMatchObject({
      mime: "application/pdf",
      size: PDF.byteLength,
      originalName: "Outline.PDF",
    });
    expect(saved.path).toMatch(/^module\/7\/[0-9a-f-]{36}\.pdf$/);
    expect(fs.readFileSync(resolveStored(root, saved.path))).toEqual(Buffer.from(PDF));
  });

  it("gives an extension-less image a matching extension", () => {
    expect(saveUpload(root, "chapter", 1, { name: "shot", bytes: PNG }).path).toMatch(/\.png$/);
  });

  it("never lets two uploads share a file", () => {
    const a = saveUpload(root, "module", 1, { name: "a.pdf", bytes: PDF });
    const b = saveUpload(root, "module", 1, { name: "a.pdf", bytes: PDF });
    expect(a.path).not.toBe(b.path);
  });

  it("refuses paths that escape the uploads root", () => {
    expect(() => resolveStored(root, "../secrets.txt")).toThrow();
    expect(() => resolveStored(root, "module/../../secrets.txt")).toThrow();
    expect(() => resolveStored(root, path.resolve(root, "..", "x"))).toThrow();
    expect(resolveStored(root, "module/1/a.pdf")).toBe(path.resolve(root, "module/1/a.pdf"));
  });

  it("deletes files and empty folders, ignores missing files and never touches outside", () => {
    const outside = path.join(path.dirname(root), `outside-${path.basename(root)}.txt`);
    fs.writeFileSync(outside, "keep me");
    const a = saveUpload(root, "module", 1, { name: "a.pdf", bytes: PDF });
    const b = saveUpload(root, "module", 1, { name: "b.pdf", bytes: PDF });

    deleteStored(root, [a.path, "module/1/missing.pdf", "../" + path.basename(outside)]);
    expect(fs.existsSync(resolveStored(root, b.path))).toBe(true);
    expect(fs.existsSync(outside)).toBe(true);

    deleteStored(root, [b.path]);
    expect(fs.existsSync(path.join(root, "module"))).toBe(false); // emptied folders removed
    expect(fs.existsSync(root)).toBe(true);
    fs.rmSync(outside);
  });
});

describe("attachment service", () => {
  it("creates, lists and deletes rows, and validates the owner", () => {
    const { module } = makeModule();
    const row = createAttachment(db, {
      ownerType: "module",
      ownerId: module.id,
      kind: "outline",
      path: "module/1/x.pdf",
      originalName: "Outline.pdf",
      mime: "application/pdf",
      size: 10,
    });
    expect(listAttachments(db, "module", module.id)).toHaveLength(1);
    expect(listAttachments(db, "module", 999)).toHaveLength(0);
    expect(listAttachments(db, "chapter", module.id)).toHaveLength(0);
    expect(deleteAttachment(db, row.id).path).toBe("module/1/x.pdf");
    expect(() => deleteAttachment(db, row.id)).toThrow(NotFoundError);
    expect(() =>
      createAttachment(db, {
        ownerType: "chapter",
        ownerId: 999,
        kind: "other",
        path: "p",
        originalName: "n",
        mime: "m",
        size: 1,
      }),
    ).toThrow(NotFoundError);
  });

  it("describes every owner type with a link", () => {
    const { semester, module } = makeModule("Networks");
    const [chapter] = addChapters(db, module.id, ["Intro"]);
    const assessment = db
      .insert(assessments)
      .values({ moduleId: module.id, name: "Quiz", weight: 5 })
      .returning()
      .get();
    const paper = db
      .insert(pastPapers)
      .values({ moduleId: module.id, title: "2024" })
      .returning()
      .get();

    expect(describeOwner(db, "semester", semester.id)).toEqual({
      label: "S",
      href: `/semesters/${semester.id}`,
    });
    expect(describeOwner(db, "module", module.id)?.href).toBe(`/modules/${module.id}`);
    expect(describeOwner(db, "chapter", chapter.id)?.href).toBe(`/chapters/${chapter.id}`);
    expect(describeOwner(db, "assessment", assessment.id)).toEqual({
      label: "Quiz",
      href: `/modules/${module.id}`,
    });
    expect(describeOwner(db, "past_paper", paper.id)).toEqual({
      label: "2024",
      href: `/modules/${module.id}`,
    });
    expect(describeOwner(db, "chapter", 999)).toBeNull();
  });
});

describe("deleting owners removes their files", () => {
  function fixture() {
    const { semester, module } = makeModule();
    const other = createModule(db, semester.id, moduleInput("Other"));
    const [chapter, chapter2] = addChapters(db, module.id, ["One", "Two"]);
    const assessment = db
      .insert(assessments)
      .values({ moduleId: module.id, name: "A", weight: 1 })
      .returning()
      .get();
    const paper = db
      .insert(pastPapers)
      .values({ moduleId: module.id, title: "P" })
      .returning()
      .get();

    const add = (
      ownerType: "semester" | "module" | "chapter" | "assessment" | "past_paper",
      ownerId: number,
    ) => {
      const saved = saveUpload(root, ownerType, ownerId, { name: "f.pdf", bytes: PDF });
      createAttachment(db, {
        ownerType,
        ownerId,
        kind: "other",
        path: saved.path,
        originalName: saved.originalName,
        mime: saved.mime,
        size: saved.size,
      });
      return saved.path;
    };
    return {
      semester,
      module,
      other,
      chapter,
      chapter2,
      paths: {
        semester: add("semester", semester.id),
        module: add("module", module.id),
        chapter: add("chapter", chapter.id),
        chapter2: add("chapter", chapter2.id),
        assessment: add("assessment", assessment.id),
        paper: add("past_paper", paper.id),
        other: add("module", other.id),
      },
    };
  }

  const exists = (rel: string) => fs.existsSync(resolveStored(root, rel));

  it("finds every owner under a module and a semester", () => {
    const f = fixture();
    const types = (owners: { type: string }[]) => owners.map((o) => o.type).sort();
    expect(types(ownersUnderModule(db, f.module.id))).toEqual([
      "assessment",
      "chapter",
      "chapter",
      "module",
      "past_paper",
    ]);
    expect(ownersUnderSemester(db, f.semester.id).filter((o) => o.type === "module")).toHaveLength(
      2,
    );
    expect(attachmentsForOwners(db, [])).toEqual([]);
  });

  it("deleting a chapter removes only that chapter's files", () => {
    const f = fixture();
    expect(getChapterDeleteImpact(db, f.chapter.id).files).toBe(1);
    const { files } = deleteChapter(db, f.chapter.id);
    expect(files).toEqual([f.paths.chapter]);
    deleteStored(root, files);
    expect(exists(f.paths.chapter)).toBe(false);
    expect(exists(f.paths.chapter2)).toBe(true);
    expect(db.select().from(attachments).all()).toHaveLength(6);
  });

  it("deleting a module removes its own, its chapters', assessments' and past papers' files", () => {
    const f = fixture();
    expect(getModuleDeleteImpact(db, f.module.id).files).toBe(5);
    const { files } = deleteModule(db, f.module.id);
    expect(files.sort()).toEqual(
      [f.paths.module, f.paths.chapter, f.paths.chapter2, f.paths.assessment, f.paths.paper].sort(),
    );
    deleteStored(root, files);
    expect(
      listFiles()
        .map((p) => path.relative(root, p).replaceAll("\\", "/"))
        .sort(),
    ).toEqual([f.paths.semester, f.paths.other].sort());
    expect(db.select().from(attachments).all()).toHaveLength(2);
  });

  it("deleting a semester removes every file beneath it", () => {
    const f = fixture();
    expect(getSemesterDeleteImpact(db, f.semester.id).files).toBe(7);
    const { files } = deleteSemester(db, f.semester.id);
    expect(files).toHaveLength(7);
    deleteStored(root, files);
    expect(listFiles()).toEqual([]);
    expect(db.select().from(attachments).all()).toHaveLength(0);
  });

  it("rolls back the row deletion if the delete fails", () => {
    const f = fixture();
    expect(() => deleteChapter(db, 99999)).toThrow(NotFoundError);
    expect(db.select().from(attachments).all()).toHaveLength(7);
    expect(exists(f.paths.chapter)).toBe(true);
  });
});

describe("upload handler", () => {
  it("stores a PDF, records metadata and detects the type from content", async () => {
    const { module } = makeModule();
    const res = await handleUpload(
      upload(
        { ownerType: "module", ownerId: String(module.id), kind: "outline" },
        { name: "Outline.pdf", bytes: PDF, type: "text/html" },
      ),
      ctx,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      ownerType: "module",
      kind: "outline",
      originalName: "Outline.pdf",
      mime: "application/pdf",
      size: PDF.byteLength,
    });
    expect(listFiles()).toHaveLength(1);
  });

  it("defaults the kind to other", async () => {
    const { module } = makeModule();
    const res = await handleUpload(
      upload({ ownerType: "module", ownerId: String(module.id) }, { name: "a.pdf", bytes: PDF }),
      ctx,
    );
    expect((await res.json()).kind).toBe("other");
  });

  it("stores a file that lies about its type as a download-only blob", async () => {
    const { module } = makeModule();
    const res = await handleUpload(
      upload(
        { ownerType: "module", ownerId: String(module.id) },
        { name: "trick.pdf", bytes: HTML, type: "application/pdf" },
      ),
      ctx,
    );
    expect((await res.json()).mime).toBe("application/octet-stream");
  });

  it("rejects bad input with helpful statuses and stores nothing", async () => {
    const { module } = makeModule();
    const ok = { ownerType: "module", ownerId: String(module.id) };
    const file = { name: "a.pdf", bytes: PDF };
    const status = async (req: Request) => (await handleUpload(req, ctx)).status;

    expect(await status(upload({ ...ok }, undefined))).toBe(400); // no file
    expect(await status(upload({ ...ok }, { name: "empty.pdf", bytes: new Uint8Array() }))).toBe(
      400,
    );
    expect(await status(upload({ ...ok, ownerType: "bogus" }, file))).toBe(400);
    expect(await status(upload({ ...ok, ownerId: "abc" }, file))).toBe(400);
    expect(await status(upload({ ...ok, ownerId: "-1" }, file))).toBe(400);
    expect(await status(upload({ ...ok, kind: "virus" }, file))).toBe(400);
    expect(await status(upload({ ...ok, ownerId: "9999" }, file))).toBe(404);
    expect(
      await status(
        new Request("http://localhost/api/attachments", {
          method: "POST",
          body: "not multipart",
          headers: { "content-type": "text/plain" },
        }),
      ),
    ).toBe(400);
    expect(listFiles()).toEqual([]);
    expect(db.select().from(attachments).all()).toHaveLength(0);
  });

  it("enforces the size limit both by header and by file", async () => {
    const { module } = makeModule();
    const fields = { ownerType: "module", ownerId: String(module.id) };
    const big = new Uint8Array(ctx.maxBytes + 1);
    big.set(PDF);
    const res = await handleUpload(upload(fields, { name: "big.pdf", bytes: big }), ctx);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain("1 MB");

    const huge = upload(fields, { name: "a.pdf", bytes: PDF });
    huge.headers.set("content-length", String(ctx.maxBytes * 10));
    expect((await handleUpload(huge, ctx)).status).toBe(413);
    expect(listFiles()).toEqual([]);

    const exact = new Uint8Array(ctx.maxBytes);
    exact.set(PDF);
    expect(
      (await handleUpload(upload(fields, { name: "exact.pdf", bytes: exact }), ctx)).status,
    ).toBe(201);
  });

  it("rejects cross-site requests", async () => {
    const { module } = makeModule();
    const fields = { ownerType: "module", ownerId: String(module.id) };
    const withHeaders = (headers: Record<string, string>) => {
      const req = upload(fields, { name: "a.pdf", bytes: PDF });
      for (const [k, v] of Object.entries(headers)) req.headers.set(k, v);
      return req;
    };
    expect(
      (
        await handleUpload(
          withHeaders({ origin: "https://evil.example", host: "localhost:3000" }),
          ctx,
        )
      ).status,
    ).toBe(403);
    expect((await handleUpload(withHeaders({ "sec-fetch-site": "cross-site" }), ctx)).status).toBe(
      403,
    );
    expect(
      (await handleUpload(withHeaders({ origin: "not a url", host: "localhost:3000" }), ctx))
        .status,
    ).toBe(403);
    expect(
      (
        await handleUpload(
          withHeaders({ origin: "http://localhost:3000", host: "localhost:3000" }),
          ctx,
        )
      ).status,
    ).toBe(201);
    expect(listFiles()).toHaveLength(1);
  });

  it("isSameOrigin treats a missing Origin as a non-browser client", () => {
    expect(isSameOrigin(new Request("http://localhost/x", { method: "POST" }))).toBe(true);
  });
});

describe("download handler", () => {
  async function stored(name: string, bytes: Uint8Array, kind = "other") {
    const { module } = makeModule();
    const res = await handleUpload(
      upload({ ownerType: "module", ownerId: String(module.id), kind }, { name, bytes }),
      ctx,
    );
    return (await res.json()) as { id: number };
  }
  const get = (id: number, init?: RequestInit, query = "") =>
    handleFile(new Request(`http://localhost/api/attachments/${id}${query}`, init), id, ctx);

  it("serves a PDF inline with safe headers and the exact bytes", async () => {
    const { id } = await stored("Outline.pdf", PDF);
    const res = await get(id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toMatch(/^inline; filename="Outline.pdf"/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-length")).toBe(String(PDF.byteLength));
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
  });

  it("serves images inline with a sandboxing CSP", async () => {
    const { id } = await stored("shot.png", PNG);
    const res = await get(id);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")).toMatch(/^inline/);
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
  });

  it("forces a download for ?download=1 and for anything not safe to show", async () => {
    const pdf = await stored("a.pdf", PDF);
    expect(
      (await get(pdf.id, undefined, "?download=1")).headers.get("content-disposition"),
    ).toMatch(/^attachment/);

    const docx = await stored("notes.docx", HTML);
    expect((await get(docx.id)).headers.get("content-disposition")).toMatch(/^attachment/);

    const svg = await stored("logo.svg", HTML);
    const svgRes = await get(svg.id);
    expect(svgRes.headers.get("content-disposition")).toMatch(/^attachment/);

    const fake = await stored("fake.pdf", HTML);
    const fakeRes = await get(fake.id);
    expect(fakeRes.headers.get("content-type")).toBe("application/octet-stream");
    expect(fakeRes.headers.get("content-disposition")).toMatch(/^attachment/);
  });

  it("encodes awkward file names in the header", async () => {
    const { id } = await stored("Résumé (final) 'v2'.pdf", PDF);
    const disposition = (await get(id)).headers.get("content-disposition")!;
    expect(disposition).toContain("filename=\"R_sum_ (final) 'v2'.pdf\"");
    expect(disposition).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9%20%28final%29%20%27v2%27.pdf");
  });

  it("supports byte ranges", async () => {
    const { id } = await stored("a.pdf", PDF);
    const part = await get(id, { headers: { range: "bytes=2-6" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe(`bytes 2-6/${PDF.byteLength}`);
    expect(new Uint8Array(await part.arrayBuffer())).toEqual(PDF.slice(2, 7));

    const tail = await get(id, { headers: { range: "bytes=-4" } });
    expect(new Uint8Array(await tail.arrayBuffer())).toEqual(PDF.slice(-4));

    const bad = await get(id, { headers: { range: `bytes=${PDF.byteLength + 5}-` } });
    expect(bad.status).toBe(416);
    expect(bad.headers.get("content-range")).toBe(`bytes */${PDF.byteLength}`);
  });

  it("answers HEAD without a body", async () => {
    const { id } = await stored("a.pdf", PDF);
    const res = await get(id, { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(String(PDF.byteLength));
    expect(await res.text()).toBe("");
  });

  it("returns 404 for an unknown id, and for a row whose file has vanished", async () => {
    expect((await get(12345)).status).toBe(404);
    const { id } = await stored("a.pdf", PDF);
    for (const f of listFiles()) fs.rmSync(f);
    const res = await get(id);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain("missing from disk");
  });

  it("never serves a path outside the uploads root, even from a tampered row", async () => {
    const outside = path.join(path.dirname(root), `secret-${path.basename(root)}.txt`);
    fs.writeFileSync(outside, "top secret");
    const { module } = makeModule();
    const row = createAttachment(db, {
      ownerType: "module",
      ownerId: module.id,
      kind: "other",
      path: "../" + path.basename(outside),
      originalName: "x.txt",
      mime: "text/plain",
      size: 10,
    });
    expect((await get(row.id)).status).toBe(404);
    fs.rmSync(outside);
  });
});

describe("parseRange", () => {
  it("handles the range forms and rejects nonsense", () => {
    expect(parseRange("bytes=0-9", 100)).toEqual({ start: 0, end: 9 });
    expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=50-500", 100)).toEqual({ start: 50, end: 99 });
    expect(parseRange("bytes=-500", 100)).toEqual({ start: 0, end: 99 });
    for (const bad of [
      "bytes=-",
      "bytes=5-2",
      "bytes=100-",
      "bytes=-0",
      "items=0-1",
      "bytes=0-1,5-6",
      "junk",
    ]) {
      expect(parseRange(bad, 100)).toBeNull();
    }
  });
});
