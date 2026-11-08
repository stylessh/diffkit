import type { WorkspaceSpec } from "../types";
import { beacon } from "./beacon";
import { orbit } from "./orbit";
import { org, people } from "./people";
import { dotfiles, handbook, infra } from "./small-repos";

/**
 * The whole demo workspace. Edit freely: the seed fingerprint changes with this
 * file, so the next `pnpm dev:demo` reseeds instead of reusing saved state.
 */
export const workspace: WorkspaceSpec = {
	people,
	org,
	repos: [beacon, orbit, handbook, infra, dotfiles],
	forks: [{ from: "lumen-labs/beacon", by: "jun-park" }],
	stars: {
		nova: ["lumen-labs/beacon", "lumen-labs/orbit", "lumen-labs/handbook"],
		"jun-park": ["lumen-labs/beacon"],
		"theo-martin": ["lumen-labs/beacon", "lumen-labs/orbit"],
	},
	pinned: {
		nova: [
			"lumen-labs/beacon",
			"lumen-labs/orbit",
			"lumen-labs/handbook",
			"nova/dotfiles",
		],
		"jun-park": ["lumen-labs/beacon", "jun-park/beacon"],
	},
	notifications: [
		{
			repo: "lumen-labs/beacon",
			subject: "pull:feat/sse-headers",
			reason: "review_requested",
			unread: true,
			at: { d: 4, h: 7 },
		},
		{
			repo: "lumen-labs/orbit",
			subject: "pull:feat/button-loading",
			reason: "review_requested",
			unread: true,
			at: { d: 1, h: 8 },
		},
		{
			repo: "lumen-labs/handbook",
			subject: "pull:docs/on-call",
			reason: "mention",
			unread: true,
			at: { d: 1, h: 6 },
		},
		{
			repo: "lumen-labs/beacon",
			subject: "pull:chore/node-matrix",
			reason: "comment",
			unread: true,
			at: { d: 3, h: 2 },
		},
		{
			repo: "lumen-labs/beacon",
			subject: "issue:memory-leak",
			reason: "assign",
			unread: false,
			at: { d: 3, h: 4 },
		},
		{
			repo: "lumen-labs/orbit",
			subject: "issue:beacon-leak",
			reason: "assign",
			unread: true,
			at: { d: 3, h: 5 },
		},
		{
			repo: "lumen-labs/beacon",
			subject: "pull:stack/transport-interface",
			reason: "author",
			unread: false,
			at: { d: 4, h: 6 },
		},
		{
			repo: "lumen-labs/beacon",
			subject: "issue:docs-examples",
			reason: "state_change",
			unread: false,
			at: { d: 16, h: 3 },
		},
		{
			repo: "lumen-labs/infra",
			subject: "issue:tls",
			reason: "assign",
			unread: true,
			at: { d: 6, h: 3 },
		},
		{
			repo: "lumen-labs/orbit",
			subject: "issue:docs-search",
			reason: "subscribed",
			unread: false,
			at: { d: 6, h: 1 },
		},
	],
};
