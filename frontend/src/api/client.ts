import { storage } from "@/src/utils/storage";

const RAW_BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";
export const API_BASE = `${RAW_BASE}/api`;
export const TOKEN_KEY = "traksha_token";

export function wsUrl(token: string): string {
  const base = RAW_BASE.replace(/^http/, "ws");
  return `${base}/api/ws?token=${encodeURIComponent(token)}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string>(TOKEN_KEY, "");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) Object.assign(headers, await authHeader());

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("You appear to be offline. Check your connection.", 0);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = data?.detail;
    const msg = typeof detail === "string" ? detail : "Something went wrong.";
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>(p),
  post: <T = any>(p: string, body?: any) => request<T>(p, { method: "POST", body }),
  put: <T = any>(p: string, body?: any) => request<T>(p, { method: "PUT", body }),
  del: <T = any>(p: string, body?: any) => request<T>(p, { method: "DELETE", body }),
};

/** Resolve a possibly-relative media path (e.g. "/api/files/..") to an absolute URL. */
export function mediaUrl(uri?: string | null): string | undefined {
  if (!uri) return undefined;
  if (/^https?:\/\//.test(uri)) return uri;
  return `${RAW_BASE}${uri}`;
}

export async function getToken(): Promise<string> {
  return storage.secureGet<string>(TOKEN_KEY, "");
}

const isWeb = typeof window !== "undefined" && !!(globalThis as any).document;

/** Append a picked file to FormData in a way that works on web + native. */
async function appendFile(form: FormData, asset: { uri: string; name: string; type: string }) {
  if (isWeb) {
    const res = await fetch(asset.uri);
    let blob = await res.blob();
    if (!blob.type || blob.type === "application/octet-stream") {
      blob = new Blob([blob], { type: asset.type });
    }
    form.append("file", blob, asset.name);
  } else {
    form.append("file", { uri: asset.uri, name: asset.name, type: asset.type } as any);
  }
}

/** Upload a picked/normalized image to the backend; returns the updated Me. */
export async function uploadProfilePhoto(asset: { uri: string; mimeType?: string | null; fileName?: string | null }) {
  const token = await getToken();
  const type = asset.mimeType || "image/jpeg";
  const name = asset.fileName || `photo.${type.split("/")[1] || "jpg"}`;
  const form = new FormData();
  await appendFile(form, { uri: asset.uri, name, type });
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/profile/photo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ApiError("You appear to be offline. Check your connection.", 0);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(data?.detail || "Upload failed", res.status);
  return data;
}

/** Upload a chat attachment (image or document); returns the created message. */
export async function uploadAttachment(
  connectionId: string,
  asset: { uri: string; mimeType: string; fileName: string; width?: number; height?: number },
  context: string,
  clientId: string,
) {
  const token = await getToken();
  const form = new FormData();
  await appendFile(form, { uri: asset.uri, name: asset.fileName, type: asset.mimeType });
  form.append("context", context);
  form.append("client_id", clientId);
  if (asset.width) form.append("width", String(Math.round(asset.width)));
  if (asset.height) form.append("height", String(Math.round(asset.height)));
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/conversations/${connectionId}/attachments`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ApiError("You appear to be offline. Check your connection.", 0);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(data?.detail || "Could not send attachment", res.status);
  return data;
}
