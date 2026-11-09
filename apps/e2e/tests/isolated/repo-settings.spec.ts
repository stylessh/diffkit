import { emulator } from "../../support/emulator.ts";
import { expect, isolatedTest as test } from "../../support/test.ts";

type Repo = { description: string | null; archived: boolean };
type Label = { name: string };
type Named = { name: string };

test("an admin edits the repository description and GitHub receives it", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/settings");
	const description = page.getByRole("textbox", { name: "Description" });
	await description.fill("Realtime client for the lumen platform");
	await page.getByRole("button", { name: "Save changes" }).click();

	await expect(page.getByText("Saved", { exact: true })).toBeVisible();
	const repo = await emulator.rest<Repo>(
		"nova",
		"GET",
		"/repos/lumen-labs/beacon",
	);
	expect(repo.description).toBe("Realtime client for the lumen platform");
});

test("the last merge method cannot be switched off", async ({ page }) => {
	await page.goto("/lumen-labs/beacon/settings");
	for (const name of ["merge commits", "squash merging", "rebase merging"]) {
		await page.getByRole("switch", { name: new RegExp(name, "i") }).click();
	}

	await expect(
		page.getByText("Allow at least one merge method."),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Save changes" }),
	).toBeDisabled();
});

test("labels are created and deleted from settings", async ({ page }) => {
	await page.goto("/lumen-labs/beacon/settings/labels");
	await page.getByRole("button", { name: "New label" }).click();
	await page.getByRole("textbox", { name: "Name" }).fill("needs-triage");
	await page.getByRole("button", { name: "Create label" }).click();

	// The editor previews the name while saving; only the saved row can delete it.
	const deleteLabel = page.getByRole("button", {
		name: "Delete label needs-triage",
	});
	await expect(deleteLabel).toBeVisible();
	const created = await emulator.rest<Label[]>(
		"nova",
		"GET",
		"/repos/lumen-labs/beacon/labels?per_page=100",
	);
	expect(created.map((label) => label.name)).toContain("needs-triage");

	await deleteLabel.click();
	await page.getByRole("button", { name: "Delete", exact: true }).click();

	await expect(page.getByText("needs-triage", { exact: true })).toHaveCount(0);
	const remaining = await emulator.rest<Label[]>(
		"nova",
		"GET",
		"/repos/lumen-labs/beacon/labels?per_page=100",
	);
	expect(remaining.map((label) => label.name)).not.toContain("needs-triage");
});

test("an Actions secret is stored by name and its value never comes back", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/settings/actions");
	await page.getByRole("button", { name: "New secret" }).click();
	await page.getByRole("textbox", { name: "Name" }).fill("deploy_key");
	await page.getByRole("textbox", { name: "Secret" }).fill("hunter2-hunter2");
	await page.getByRole("button", { name: "Save secret" }).click();

	await expect(page.getByText("DEPLOY_KEY", { exact: true })).toBeVisible();
	await expect(page.getByText("hunter2-hunter2")).toHaveCount(0);
	const secrets = await emulator.rest<{ secrets: Named[] }>(
		"nova",
		"GET",
		"/repos/lumen-labs/beacon/actions/secrets",
	);
	expect(secrets.secrets.map((secret) => secret.name)).toContain("DEPLOY_KEY");
});

test("a variable is created and then updated in place", async ({ page }) => {
	await page.goto("/lumen-labs/beacon/settings/actions");
	await page.getByRole("button", { name: "New variable" }).click();
	await page.getByRole("textbox", { name: "Name" }).fill("api_url");
	await page
		.getByRole("textbox", { name: "Value" })
		.fill("https://api.lumen.dev");
	await page.getByRole("button", { name: "Save variable" }).click();
	await expect(page.getByText("https://api.lumen.dev")).toBeVisible();

	await page.getByRole("button", { name: "Edit API_URL" }).click();
	await page
		.getByRole("textbox", { name: "Value" })
		.fill("https://api.lumen.dev/v2");
	await page.getByRole("button", { name: "Save variable" }).click();

	await expect(page.getByText("https://api.lumen.dev/v2")).toBeVisible();
	await expect
		.poll(async () => {
			const variable = await emulator.rest<{ value: string }>(
				"nova",
				"GET",
				"/repos/lumen-labs/beacon/actions/variables/API_URL",
			);
			return variable.value;
		})
		.toBe("https://api.lumen.dev/v2");
});

type Invitation = { invitee: { login: string }; permissions: string };
type Collaborator = { login: string; role_name: string };
type Hook = { config: { url: string } };
type Delivery = { id: number };

test("a collaborator is added and another one's role changes", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/settings/access");
	await page.getByRole("button", { name: "Add people" }).click();
	await page
		.getByRole("textbox", { name: "GitHub username" })
		.fill("priya-rao");
	await page.getByRole("button", { name: "Add", exact: true }).click();
	await expect(page.getByText("Added", { exact: true })).toBeVisible();
	await expect(
		page.getByRole("combobox", { name: "Role for priya-rao" }),
	).toHaveText("Write");

	await page.getByRole("combobox", { name: "Role for lena-fischer" }).click();
	await page.getByRole("option", { name: "Write" }).click();
	await expect(page.getByText("Saved", { exact: true })).toBeVisible();

	const collaborators = await emulator.rest<Collaborator[]>(
		"nova",
		"GET",
		"/repos/lumen-labs/beacon/collaborators?affiliation=direct",
	);
	const roles = Object.fromEntries(
		collaborators.map((person) => [person.login, person.role_name]),
	);
	expect(roles).toMatchObject({
		"priya-rao": "write",
		"lena-fischer": "write",
	});
});

test("a pending invitation is cancelled after an inline confirmation", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/settings/access");
	await page
		.getByRole("button", { name: "Cancel invitation for mika-tanaka" })
		.click();
	await page.getByRole("button", { name: "Confirm" }).click();

	await expect(page.getByText("mika-tanaka")).toHaveCount(0);
	const invitations = await emulator.rest<Invitation[]>(
		"nova",
		"GET",
		"/repos/lumen-labs/beacon/invitations",
	);
	expect(invitations).toEqual([]);
});

test("a webhook is created and a failed delivery is redelivered", async ({
	page,
}) => {
	await page.goto("/lumen-labs/beacon/settings/webhooks");
	await page.getByRole("button", { name: "Add webhook" }).click();
	await page
		.getByRole("textbox", { name: "Payload URL" })
		.fill("https://example.com/hooks/beacon");
	await page.getByRole("button", { name: "Create webhook" }).click();

	await expect(
		page.getByText("https://example.com/hooks/beacon"),
	).toBeVisible();
	const hooks = await emulator.rest<Hook[]>(
		"nova",
		"GET",
		"/repos/lumen-labs/beacon/hooks",
	);
	expect(hooks.map((hook) => hook.config.url)).toContain(
		"https://example.com/hooks/beacon",
	);

	const failing = hooks.findIndex((hook) => hook.config.url.includes("ci."));
	const failingId = (hooks[failing] as unknown as { id: number }).id;
	const before = await emulator.rest<Delivery[]>(
		"nova",
		"GET",
		`/repos/lumen-labs/beacon/hooks/${failingId}/deliveries`,
	);
	await page
		.getByRole("button", {
			name: "Deliveries for https://ci.lumen-labs.example/webhooks/beacon",
		})
		.click();
	await page
		.getByRole("button", { name: /^Redeliver/ })
		.first()
		.click();

	await expect(page.getByText("Redelivery queued")).toBeVisible();
	const after = await emulator.rest<Delivery[]>(
		"nova",
		"GET",
		`/repos/lumen-labs/beacon/hooks/${failingId}/deliveries`,
	);
	expect(after.length).toBe(before.length + 1);
});
