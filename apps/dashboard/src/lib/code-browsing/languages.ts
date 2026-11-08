const EXT_TO_LANG: Record<string, string> = {
	ts: "typescript",
	mts: "typescript",
	cts: "typescript",
	tsx: "tsx",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jsx: "jsx",
	json: "json",
	jsonc: "json",
	json5: "json",
	md: "markdown",
	mdx: "markdown",
	html: "html",
	htm: "html",
	xhtml: "html",
	svg: "html",
	xml: "xml",
	css: "css",
	scss: "scss",
	sass: "sass",
	less: "less",
	py: "python",
	pyi: "python",
	pyw: "python",
	rs: "rust",
	go: "go",
	rb: "ruby",
	erb: "ruby",
	java: "java",
	c: "c",
	cpp: "cpp",
	cc: "cpp",
	cxx: "cpp",
	h: "c",
	hpp: "cpp",
	hxx: "cpp",
	cs: "csharp",
	swift: "swift",
	kt: "kotlin",
	kts: "kotlin",
	sql: "sql",
	graphql: "graphql",
	gql: "graphql",
	yml: "yaml",
	yaml: "yaml",
	toml: "toml",
	ini: "ini",
	cfg: "ini",
	conf: "ini",
	env: "bash",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	fish: "bash",
	ps1: "powershell",
	dockerfile: "dockerfile",
	diff: "diff",
	patch: "diff",
	lua: "lua",
	r: "r",
	R: "r",
	pl: "perl",
	pm: "perl",
	php: "php",
	ex: "elixir",
	exs: "elixir",
	erl: "erlang",
	hs: "haskell",
	scala: "scala",
	clj: "clojure",
	vim: "viml",
	tf: "hcl",
	tfvars: "hcl",
	proto: "protobuf",
	prisma: "prisma",
};

const NAME_TO_LANG: Record<string, string> = {
	dockerfile: "dockerfile",
	makefile: "bash",
	gemfile: "ruby",
	rakefile: "ruby",
	justfile: "bash",
	vagrantfile: "ruby",
	brewfile: "ruby",
	".gitignore": "bash",
	".gitattributes": "bash",
	".dockerignore": "bash",
	".editorconfig": "ini",
	".env": "bash",
	".env.local": "bash",
	".env.example": "bash",
	".npmrc": "ini",
	".eslintrc": "json",
	".prettierrc": "json",
	".babelrc": "json",
};

export function detectLang(path: string): string {
	const name = path.split("/").pop() ?? "";
	const lower = name.toLowerCase();
	const nameMatch = NAME_TO_LANG[lower];
	if (nameMatch) return nameMatch;
	const ext = lower.split(".").pop() ?? "";
	return EXT_TO_LANG[ext] ?? "text";
}

const MARKDOWN_EXTENSIONS = new Set(["md", "mdx", "markdown", "mdown", "mkd"]);

export function isMarkdownPath(path: string) {
	const name = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
	if (name === "readme") return true;
	const ext = name.slice(name.lastIndexOf(".") + 1);
	return name.includes(".") && MARKDOWN_EXTENSIONS.has(ext);
}

export function isSvgPath(path: string) {
	return path.toLowerCase().endsWith(".svg");
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
