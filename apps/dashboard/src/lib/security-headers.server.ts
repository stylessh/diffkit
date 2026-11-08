export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
	"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

// Response.redirect() and fetch() results have immutable headers; setting
// them would throw and turn a redirect into a 1101.
export function applySecurityHeaders(response: Response): Response {
	try {
		for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
			response.headers.set(key, value);
		}
		return response;
	} catch {
		const copy = new Response(response.body, response);
		for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
			copy.headers.set(key, value);
		}
		return copy;
	}
}

export function unhandledErrorResponse(pathname: string): Response {
	const headers = { "Cache-Control": "no-store", "Retry-After": "5" };
	if (pathname.startsWith("/api/")) {
		return Response.json(
			{ error: "service_unavailable" },
			{ status: 503, headers },
		);
	}
	return new Response("Service temporarily unavailable. Please try again.", {
		status: 503,
		headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
	});
}
