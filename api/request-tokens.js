import { ethers } from "ethers";
import { Buffer } from "buffer";

const COOLDOWN_SECONDS = 3600; // 1 jam
const FAUCET_AMOUNT = "0.1"; // OCTRA
const lastRequestMap = new Map();

// BASE64 PRIVATE KEY
const PRIVATE_KEY_BASE64 = process.env.PRIVATE_KEY_BASE64; // set via Vercel dashboard
const decodedPrivateKey = "0x" + Buffer.from(PRIVATE_KEY_BASE64, "base64").toString("hex");

const RPC_URL = process.env.RPC_URL;
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(decodedPrivateKey, provider);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { address } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  if (!address || !address.startsWith("oct")) {
    return res.status(400).json({ error: "Invalid Octra address" });
  }

  // Cooldown check
  const now = Date.now();
  const last = lastRequestMap.get(address) || 0;
  if (now - last < COOLDOWN_SECONDS * 1000) {
    const wait = Math.ceil(COOLDOWN_SECONDS - (now - last) / 1000);
    return res.status(429).json({ error: `Cooldown active. Try again in ${wait}s` });
  }

  try {
    const tx = await wallet.sendTransaction({
      to: address,
      value: ethers.parseUnits(FAUCET_AMOUNT, 18),
    });

    lastRequestMap.set(address, now);

    return res.status(200).json({ success: true, txHash: tx.hash });
  } catch (err) {
    console.error("Faucet TX Error:", err);
    return res.status(500).json({ success: false, error: "Transaction failed" });
  }
}
