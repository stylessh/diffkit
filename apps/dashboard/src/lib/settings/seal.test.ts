import { xsalsa20poly1305 } from "@noble/ciphers/salsa.js";
import { describe, expect, it } from "vitest";
import { boxKey, sealNonce, sealSecret } from "./seal";

async function openSealed(
	sealed: string,
	recipient: CryptoKeyPair,
	recipientPublic: Uint8Array,
) {
	const bytes = Uint8Array.from(atob(sealed), (char) => char.charCodeAt(0));
	const ephemeralPublic = bytes.slice(0, 32);
	const ephemeral = await crypto.subtle.importKey(
		"raw",
		ephemeralPublic,
		{ name: "X25519" },
		false,
		[],
	);
	const shared = new Uint8Array(
		await crypto.subtle.deriveBits(
			{ name: "X25519", public: ephemeral },
			recipient.privateKey,
			256,
		),
	);
	const opened = xsalsa20poly1305(
		boxKey(shared),
		sealNonce(ephemeralPublic, recipientPublic),
	).decrypt(bytes.slice(32));
	return new TextDecoder().decode(opened);
}

describe("sealSecret", () => {
	it("produces a box only the repository key can open", async () => {
		const recipient = (await crypto.subtle.generateKey(
			{ name: "X25519" },
			true,
			["deriveBits"],
		)) as CryptoKeyPair;
		const recipientPublic = new Uint8Array(
			await crypto.subtle.exportKey("raw", recipient.publicKey),
		);
		const publicKey = btoa(String.fromCharCode(...recipientPublic));

		const sealed = await sealSecret(publicKey, "s3cr€t value");

		expect(await openSealed(sealed, recipient, recipientPublic)).toBe(
			"s3cr€t value",
		);
		expect(await sealSecret(publicKey, "s3cr€t value")).not.toBe(sealed);
	});

	it("rejects a key that is not 32 bytes", async () => {
		await expect(sealSecret(btoa("short"), "value")).rejects.toThrow(
			/Curve25519/,
		);
	});
});
