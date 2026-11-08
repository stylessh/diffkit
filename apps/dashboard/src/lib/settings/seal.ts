import { hsalsa, xsalsa20poly1305 } from "@noble/ciphers/salsa.js";
import { blake2b } from "@noble/hashes/blake2.js";

// GitHub only accepts an Actions secret sealed as libsodium's crypto_box_seal:
// an ephemeral X25519 key agrees a shared secret with the repository key,
// HSalsa20 derives the box key, the nonce is BLAKE2b-24 of both public keys,
// and the output is the ephemeral public key followed by the
// XSalsa20-Poly1305 box. X25519 itself comes from WebCrypto.

const SIGMA = new TextEncoder().encode("expand 32-byte k");

function toWords(bytes: Uint8Array) {
	return new Uint32Array(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
	);
}

export function boxKey(shared: Uint8Array) {
	const key = new Uint32Array(8);
	hsalsa(toWords(SIGMA), toWords(shared), new Uint32Array(4), key);
	return new Uint8Array(key.buffer);
}

function concat(a: Uint8Array, b: Uint8Array) {
	const joined = new Uint8Array(a.length + b.length);
	joined.set(a);
	joined.set(b, a.length);
	return joined;
}

export function sealNonce(
	ephemeralPublic: Uint8Array,
	recipientPublic: Uint8Array,
) {
	return blake2b(concat(ephemeralPublic, recipientPublic), { dkLen: 24 });
}

function fromBase64(text: string) {
	const binary = atob(text.trim());
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toBase64(bytes: Uint8Array) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

async function agreeSharedSecret(recipientPublic: Uint8Array) {
	const { subtle } = globalThis.crypto;
	const recipient = await subtle.importKey(
		"raw",
		recipientPublic as BufferSource,
		{ name: "X25519" },
		false,
		[],
	);
	const ephemeral = (await subtle.generateKey({ name: "X25519" }, true, [
		"deriveBits",
	])) as CryptoKeyPair;
	const ephemeralPublic = new Uint8Array(
		await subtle.exportKey("raw", ephemeral.publicKey),
	);
	const shared = new Uint8Array(
		await subtle.deriveBits(
			{ name: "X25519", public: recipient },
			ephemeral.privateKey,
			256,
		),
	);
	return { ephemeralPublic, shared };
}

export async function sealSecret(publicKey: string, value: string) {
	const recipientPublic = fromBase64(publicKey);
	if (recipientPublic.length !== 32) {
		throw new Error("GitHub's key for secrets is not a Curve25519 key");
	}
	const { ephemeralPublic, shared } = await agreeSharedSecret(recipientPublic);
	const sealed = xsalsa20poly1305(
		boxKey(shared),
		sealNonce(ephemeralPublic, recipientPublic),
	).encrypt(new TextEncoder().encode(value));
	return toBase64(concat(ephemeralPublic, sealed));
}
