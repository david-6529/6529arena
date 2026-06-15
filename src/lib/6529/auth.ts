import { Wallet } from "ethers";

type NonceResponse = {
  nonce: string;
  server_signature: string;
};

type LoginResponse = {
  token: string;
};

let cachedToken: { token: string; expiresAt: number } | undefined;

export function get6529ApiBaseUrl() {
  const configured = process.env["6529_API_BASE_URL"] ?? "https://api.6529.io";
  const trimmed = configured.replace(/\/$/, "");

  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(
      `6529 API request failed: ${response.status} ${response.statusText} - ${await response.text()}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function getNonce(walletAddress: string) {
  const url = new URL(`${get6529ApiBaseUrl()}/auth/nonce`);
  url.searchParams.set("signer_address", walletAddress);
  url.searchParams.set("short_nonce", "true");

  return readJson<NonceResponse>(
    await fetch(url, {
      headers: { accept: "application/json" },
      method: "GET",
      cache: "no-store",
    }),
  );
}

export async function signNonce(nonce: string, privateKey?: string) {
  const key = privateKey ?? process.env["6529_BOT_PRIVATE_KEY"];

  if (!key) {
    throw new Error("6529_BOT_PRIVATE_KEY is required to sign a 6529 nonce.");
  }

  const wallet = new Wallet(key);

  return wallet.signMessage(nonce);
}

export async function exchangeSignatureForJwt(params: {
  walletAddress: string;
  clientSignature: string;
  serverSignature: string;
}) {
  const url = new URL(`${get6529ApiBaseUrl()}/auth/login`);
  url.searchParams.set("signer_address", params.walletAddress);

  return readJson<LoginResponse>(
    await fetch(url, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        client_address: params.walletAddress,
        client_signature: params.clientSignature,
        server_signature: params.serverSignature,
      }),
      cache: "no-store",
    }),
  );
}

export async function getBearerToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const walletAddress = process.env["6529_BOT_WALLET_ADDRESS"];

  if (!walletAddress) {
    throw new Error("6529_BOT_WALLET_ADDRESS is required to authenticate the bot.");
  }

  const nonce = await getNonce(walletAddress);
  const clientSignature = await signNonce(nonce.nonce);
  const login = await exchangeSignatureForJwt({
    walletAddress,
    clientSignature,
    serverSignature: nonce.server_signature,
  });

  cachedToken = {
    token: login.token,
    expiresAt: Date.now() + 45 * 60 * 1000,
  };

  return login.token;
}
