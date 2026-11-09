type SyntaxRole =
	| "comment"
	| "keyword"
	| "string"
	| "constant"
	| "function"
	| "parameter"
	| "type"
	| "plain";

const SCOPES_BY_ROLE: Record<SyntaxRole, readonly string[]> = {
	comment: [
		"comment",
		"comment.doc",
		"hint",
		"predictive",
		"markup.quote",
		"markup.strikethrough",
	],
	keyword: [
		"keyword",
		"keyword.operator",
		"keyword.directive",
		"keyword.control",
		"keyword.control.at-rule",
		"keyword.declaration",
		"keyword.import",
		"keyword.important",
		"keyword.jsdoc",
		"at_keyword",
		"operator",
		"preproc",
		"punctuation.special",
		"markup.italic",
		"diff.minus",
		"link_uri",
	],
	string: [
		"string",
		"string.escape",
		"string.regex",
		"string.special",
		"string.special.symbol",
		"string.template",
		"template_string",
		"text.literal",
		"markup.raw",
		"markup.raw.inline",
		"markup.raw.block",
		"diff.plus",
	],
	constant: [
		"number",
		"number.unit",
		"unit",
		"boolean",
		"constant",
		"constant.builtin",
		"constant.css",
		"constant.color",
		"color",
		"value",
		"plain_value",
		"string.plain",
		"variant",
		"markup.bold",
		"diff.delta",
	],
	function: [
		"function",
		"function.method",
		"function.method.call",
		"function.builtin",
		"function.call",
		"function.definition",
		"function.special.definition",
		"method_definition",
		"decorator",
		"attribute.builtin",
		"selector.id",
		"id_name",
		"markup.link.text",
	],
	parameter: [
		"variable.parameter",
		"attribute",
		"attribute.jsx",
		"selector.pseudo",
		"pseudo_class_selector",
		"pseudo_element_selector",
	],
	type: [
		"type",
		"type.builtin",
		"type.class",
		"type.jsdoc",
		"constructor",
		"enum",
		"class",
		"class_name",
		"selector",
		"selector.class",
		"namespace",
		"label",
		"property",
		"property.css",
		"property.custom",
		"property.definition",
		"property.json_key",
		"property.object",
		"property_identifier",
		"property_name",
		"shorthand_property_identifier",
		"shorthand_property_identifier_pattern",
		"variable.member",
		"variable.css",
		"variable.scss",
		"tag",
		"tag.css",
		"tag.jsx",
		"tag.component",
		"tag.component.jsx",
		"tag.doctype",
		"tag_name",
		"title",
		"markup.heading",
		"markup.list",
		"markup.list.numbered",
		"markup.list.unnumbered",
		"markup.link.url",
		"link_text",
		"primary",
	],
	plain: [
		"variable",
		"variable.builtin",
		"variable.special",
		"variable.language",
		"variable.jsdoc",
		"this",
		"self",
		"punctuation",
		"punctuation.bracket",
		"punctuation.bracket.html",
		"punctuation.bracket.jsx",
		"punctuation.delimiter",
		"punctuation.delimiter.html",
		"punctuation.delimiter.jsx",
		"punctuation.list_marker",
		"punctuation.markup",
		"embedded",
		"emphasis",
		"emphasis.strong",
		"text.jsx",
	],
};

function scopeToVariable(scope: string) {
	return `--diffs-token-${scope.replaceAll(/[._]/g, "-")}`;
}

/**
 * Maps every Highlights syntax scope onto our `--syntax-*` palette so the
 * CSS-variables theme follows light/dark and colour themes without
 * re-highlighting.
 */
export const SYNTAX_TOKEN_DECLARATIONS = Object.entries(SCOPES_BY_ROLE)
	.flatMap(([role, scopes]) =>
		scopes.map((scope) => `${scopeToVariable(scope)}: var(--syntax-${role});`),
	)
	.concat(
		"--diffs-token-foreground: var(--syntax-plain);",
		"--diffs-token-comment-font-style: italic;",
	)
	.join("\n");
