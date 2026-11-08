/**
 * Repository Actions secrets and variables. Names are stored upper-case, like
 * GitHub. Secret values are never kept: `encrypted_value` is only validated.
 */
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import type { ShimContext } from "../server.ts";
import { notFound, type ShimRequestContext } from "./common.ts";
import {
	fail,
	guardRepo,
	invalidField,
	isResponse,
	pageWithLinks,
	readBody,
	settingsStores,
} from "./settings-common.ts";

const PKCS8_X25519_PREFIX = Buffer.from(
	"302e020100300506032b656e04220420",
	"hex",
);

/** One fixed X25519 key pair, so the public key is a real sealed-box key. */
const PUBLIC_KEY = (() => {
	const digest = createHash("sha256")
		.update("diffkit-emulator:actions-secrets")
		.digest();
	const privateKey = createPrivateKey({
		key: Buffer.concat([PKCS8_X25519_PREFIX, digest]),
		format: "der",
		type: "pkcs8",
	});
	const spki = createPublicKey(privateKey).export({
		format: "der",
		type: "spki",
	});
	return {
		key: spki.subarray(spki.length - 32).toString("base64"),
		key_id: (
			BigInt(`0x${digest.subarray(0, 8).toString("hex")}`) %
			10n ** 18n
		).toString(),
	};
})();

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;

function actionsName(raw: string) {
	const name = raw.toUpperCase();
	return /^[A-Z_][A-Z0-9_]*$/u.test(name) && !name.startsWith("GITHUB_")
		? name
		: null;
}

export function registerActionsShims(context: ShimContext) {
	const { app } = context;

	app.get("/repos/:owner/:repo/actions/secrets/public-key", (c) => {
		const repo = guardRepo(context, c, "admin");
		return isResponse(repo) ? repo : c.json(PUBLIC_KEY);
	});

	const secretJson = (row: {
		name: string;
		created_at: string;
		updated_at: string;
	}) => ({
		name: row.name,
		created_at: row.created_at,
		updated_at: row.updated_at,
	});
	const findSecret = (repoId: number, name: string) =>
		settingsStores(context)
			.gh.secrets.findBy("repo_id", repoId)
			.find((row) => row.org_id === null && row.name === name.toUpperCase());

	app.get("/repos/:owner/:repo/actions/secrets", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const rows = settingsStores(context)
			.gh.secrets.findBy("repo_id", repo.id)
			.filter((row) => row.org_id === null)
			.sort((a, b) => a.name.localeCompare(b.name));
		return c.json({
			total_count: rows.length,
			secrets: pageWithLinks(c, rows, { fallback: 30, max: 100 }).map(
				secretJson,
			),
		});
	});

	app.get("/repos/:owner/:repo/actions/secrets/:name", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const row = findSecret(repo.id, c.req.param("name"));
		return row ? c.json(secretJson(row)) : notFound(c);
	});

	app.put("/repos/:owner/:repo/actions/secrets/:name", async (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const name = actionsName(c.req.param("name"));
		if (!name) {
			return invalidField(c, "Secret", "name");
		}
		const body = await readBody(c);
		if (
			typeof body.encrypted_value !== "string" ||
			!BASE64.test(body.encrypted_value)
		) {
			return invalidField(c, "Secret", "encrypted_value", "missing_field");
		}
		if (body.key_id !== undefined && body.key_id !== PUBLIC_KEY.key_id) {
			return invalidField(c, "Secret", "key_id");
		}
		const { gh } = settingsStores(context);
		const existing = findSecret(repo.id, name);
		if (existing) {
			gh.secrets.update(existing.id, { visibility: existing.visibility });
			return c.body(null, 204);
		}
		gh.secrets.insert({
			repo_id: repo.id,
			org_id: null,
			name,
			visibility: "all",
		});
		return c.json({}, 201);
	});

	app.delete("/repos/:owner/:repo/actions/secrets/:name", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const row = findSecret(repo.id, c.req.param("name"));
		if (!row) {
			return notFound(c);
		}
		settingsStores(context).gh.secrets.delete(row.id);
		return c.body(null, 204);
	});

	const variableJson = (row: {
		name: string;
		value: string;
		created_at: string;
		updated_at: string;
	}) => ({
		name: row.name,
		value: row.value,
		created_at: row.created_at,
		updated_at: row.updated_at,
	});
	const findVariable = (repoId: number, name: string) =>
		settingsStores(context)
			.settings.variables.findBy("repo_id", repoId)
			.find((row) => row.name === name.toUpperCase());

	const conflict = (c: ShimRequestContext) =>
		fail(c, 409, "Variable already exists");

	app.get("/repos/:owner/:repo/actions/variables", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const rows = settingsStores(context)
			.settings.variables.findBy("repo_id", repo.id)
			.sort((a, b) => a.name.localeCompare(b.name));
		return c.json({
			total_count: rows.length,
			variables: pageWithLinks(c, rows, { fallback: 10, max: 30 }).map(
				variableJson,
			),
		});
	});

	app.post("/repos/:owner/:repo/actions/variables", async (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const body = await readBody(c);
		const name = typeof body.name === "string" ? actionsName(body.name) : null;
		if (!name) {
			return invalidField(c, "Variable", "name");
		}
		if (typeof body.value !== "string") {
			return invalidField(c, "Variable", "value", "missing_field");
		}
		if (findVariable(repo.id, name)) {
			return conflict(c);
		}
		settingsStores(context).settings.variables.insert({
			repo_id: repo.id,
			name,
			value: body.value,
		});
		return c.json({}, 201);
	});

	app.get("/repos/:owner/:repo/actions/variables/:name", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const row = findVariable(repo.id, c.req.param("name"));
		return row ? c.json(variableJson(row)) : notFound(c);
	});

	app.patch("/repos/:owner/:repo/actions/variables/:name", async (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const row = findVariable(repo.id, c.req.param("name"));
		if (!row) {
			return notFound(c);
		}
		const body = await readBody(c);
		const patch: { name?: string; value?: string } = {};
		if (body.name !== undefined) {
			const name =
				typeof body.name === "string" ? actionsName(body.name) : null;
			if (!name) {
				return invalidField(c, "Variable", "name");
			}
			if (name !== row.name && findVariable(repo.id, name)) {
				return conflict(c);
			}
			patch.name = name;
		}
		if (body.value !== undefined) {
			if (typeof body.value !== "string") {
				return invalidField(c, "Variable", "value");
			}
			patch.value = body.value;
		}
		settingsStores(context).settings.variables.update(row.id, patch);
		return c.body(null, 204);
	});

	app.delete("/repos/:owner/:repo/actions/variables/:name", (c) => {
		const repo = guardRepo(context, c, "admin");
		if (isResponse(repo)) {
			return repo;
		}
		const row = findVariable(repo.id, c.req.param("name"));
		if (!row) {
			return notFound(c);
		}
		settingsStores(context).settings.variables.delete(row.id);
		return c.body(null, 204);
	});
}
