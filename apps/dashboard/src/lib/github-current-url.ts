export function buildCurrentGitHubUrl(currentUrl: string): string {
	const url = new URL(currentUrl);

	url.protocol = "https:";
	url.hostname = "github.com";
	url.port = "";

	return url.toString();
}
