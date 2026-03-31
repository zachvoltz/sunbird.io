export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error: string; details?: Record<string, string[]> },
  ) {
    super(body.error);
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const json = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, json);
  }

  return json as T;
}
