import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import JSZip from "https://esm.sh/jszip@3.10.1";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.10.38/legacy/build/pdf.mjs";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const CONTRIBUTOR_ROLES = new Set(["owner", "leader", "committee_lead", "contributor"]);
const EXTRACTABLE_MIME_TYPES = new Set(["text/plain", "text/csv", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]);
const MAX_EXTRACTABLE_BYTES = 25 * 1024 * 1024;
const MAX_FRAGMENTS = 500;
const MAX_FRAGMENT_CHARS = 4000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function message(error) {
  return error instanceof Error ? error.message : "Source extraction failed.";
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fragmentText(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];
  const blocks = /\n\s*\n/.test(normalized)
    ? normalized.split(/\n\s*\n+/)
    : normalized.split("\n");
  const fragments = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    for (let offset = 0; offset < trimmed.length; offset += MAX_FRAGMENT_CHARS) {
      fragments.push(trimmed.slice(offset, offset + MAX_FRAGMENT_CHARS));
      if (fragments.length >= MAX_FRAGMENTS) return fragments;
    }
  }
  return fragments;
}

function decodeXml(value) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function zipText(bytes, filename) {
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file(filename);
  if (!entry) throw new Error("The office document is missing " + filename + ".");
  return entry.async("text");
}

async function extractDocx(bytes) {
  const xml = await zipText(bytes, "word/document.xml");
  return decodeXml(xml.replace(/<w:tab\s*\/?\s*>/g, "\t").replace(/<w:br\s*\/?\s*>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, ""));
}

async function extractXlsx(bytes) {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
  const sheets = workbook.SheetNames.slice(0, 20).map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    return "Sheet: " + sheetName + "\n" + XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
  });
  return sheets.join("\n\n");
}

async function extractPdf(bytes) {
  const document = await pdfjsLib.getDocument({ data: bytes, disableWorker: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => typeof item.str === "string" ? item.str : "").join(" ").trim();
    if (text) pages.push("Page " + pageNumber + "\n" + text);
    if (pages.length >= 100) break;
  }
  return pages.join("\n\n");
}

async function extractText(file, mimeType) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (mimeType === "text/plain" || mimeType === "text/csv") return new TextDecoder().decode(bytes);
  if (mimeType === "application/pdf") return extractPdf(bytes);
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return extractDocx(bytes);
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimeType === "application/vnd.ms-excel") return extractXlsx(bytes);
  throw new Error("This file type is not supported by the extraction worker.");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Only POST is supported." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: "Function configuration or authorization is missing." }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "You must be signed in to extract a source." }, 401);

  let sourceDocumentId;
  try {
    const body = await request.json();
    sourceDocumentId = typeof body?.source_document_id === "string" ? body.source_document_id : "";
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  if (!/^[0-9a-f-]{36}$/i.test(sourceDocumentId)) {
    return json({ error: "A valid source_document_id is required." }, 400);
  }

  const { data: source, error: sourceError } = await adminClient
    .from("source_documents")
    .select("id, organization_id, storage_path, mime_type, extraction_status, title")
    .eq("id", sourceDocumentId)
    .single();
  if (sourceError || !source) return json({ error: "Source document not found." }, 404);

  const { data: membership, error: membershipError } = await adminClient
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", source.organization_id)
    .eq("user_id", user.id)
    .single();
  if (membershipError || !membership || !CONTRIBUTOR_ROLES.has(membership.role)) {
    return json({ error: "You do not have permission to extract this organization's sources." }, 403);
  }

  if (source.extraction_status !== "pending") {
    return json({ error: `This source is already ${source.extraction_status}.` }, 409);
  }

  const fail = async (reason, status = 422) => {
    await adminClient.from("source_documents").update({ extraction_status: "failed" }).eq("id", source.id);
    return json({ error: reason, document_id: source.id, status: "failed" }, status);
  };

  if (!source.storage_path) return fail("This source has no private storage path.");
  if (!EXTRACTABLE_MIME_TYPES.has(source.mime_type)) return fail("This file type is not supported by the extraction worker.");

  try {
    const { data: file, error: downloadError } = await adminClient.storage
      .from("eagle-source-documents")
      .download(source.storage_path);
    if (downloadError || !file) throw downloadError ?? new Error("The source file could not be downloaded.");
    if (file.size > MAX_EXTRACTABLE_BYTES) {
      return await fail("This source is larger than the 25 MB extraction limit.");
    }

    const text = await extractText(file, source.mime_type);
    const fragments = fragmentText(text);
    if (!fragments.length) return await fail("The source file did not contain extractable text.");

    const fragmentRows = [];
    for (let index = 0; index < fragments.length; index += 1) {
      const content = fragments[index];
      fragmentRows.push({
        organization_id: source.organization_id,
        source_document_id: source.id,
        fragment_type: "paragraph",
        locator: `paragraph:${index + 1}`,
        content,
        content_hash: await sha256(content),
      });
    }

    const { data: createdFragments, error: fragmentError } = await adminClient
      .from("source_fragments")
      .insert(fragmentRows)
      .select("id, content");
    if (fragmentError || !createdFragments) throw fragmentError ?? new Error("Source fragments could not be created.");

    const evidenceRows = createdFragments.map((fragment) => ({
      organization_id: source.organization_id,
      source_fragment_id: fragment.id,
      label: "claimed",
      claim: fragment.content,
      extracted_by: "multi-format-extractor",
      model_version: "extract-v2",
    }));
    const { error: evidenceError } = await adminClient.from("evidence").insert(evidenceRows);
    if (evidenceError) throw evidenceError;

    const { error: updateError } = await adminClient
      .from("source_documents")
      .update({ extraction_status: "complete", extracted_at: new Date().toISOString() })
      .eq("id", source.id);
    if (updateError) throw updateError;

    return json({
      document_id: source.id,
      status: "complete",
      fragments_created: createdFragments.length,
      evidence_created: evidenceRows.length,
    });
  } catch (error) {
    return await fail(message(error), 500);
  }
});
