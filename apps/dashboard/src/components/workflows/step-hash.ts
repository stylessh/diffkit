export function getStepHashId(name: string, fallbackNumber: number): string {
	const slug = slugify(name);
	return slug || `step-${fallbackNumber}`;
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
