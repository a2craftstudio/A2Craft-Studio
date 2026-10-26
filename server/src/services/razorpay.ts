import type { Config } from '../config.js';
import { HttpError } from '../errors.js';
import { hmacHex, safeEqual } from '../util.js';

const API = 'https://api.razorpay.com/v1';
const basicAuth = (c: Config) => 'Basic ' + Buffer.from(`${c.razorpay.keyId}:${c.razorpay.keySecret}`).toString('base64');

export interface RazorpayOrder {
  id: string;
}
export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  status: string;
  amount: number;
  currency?: string;
  [k: string]: unknown;
}

/** Creates the Razorpay order (amount in paise). The receipt is our order id. */
export async function createRazorpayOrder(config: Config, p: { amountPaise: number; receipt: string }): Promise<RazorpayOrder> {
  let res: Response;
  try {
    res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: { Authorization: basicAuth(config), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: p.amountPaise, currency: 'INR', receipt: p.receipt.slice(0, 40), notes: { order_id: p.receipt } }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HttpError(502, 'The payment provider is unavailable. Please try again.');
  }
  if (!res.ok) throw new HttpError(502, 'The payment provider is unavailable. Please try again.');
  const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
  if (!body || typeof body.id !== 'string') throw new HttpError(502, 'The payment provider is unavailable. Please try again.');
  return { id: body.id };
}

/** Fetches a payment from Razorpay so we never trust the browser's word that it was captured. */
export async function fetchRazorpayPayment(config: Config, paymentId: string): Promise<RazorpayPayment> {
  if (!/^[A-Za-z0-9_]{5,64}$/.test(paymentId)) throw new HttpError(400, 'Missing payment details.');
  let res: Response;
  try {
    res = await fetch(`${API}/payments/${paymentId}`, { headers: { Authorization: basicAuth(config) }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new HttpError(502, 'Could not confirm the payment with the provider.');
  }
  if (!res.ok) throw new HttpError(502, 'Could not confirm the payment with the provider.');
  const body = (await res.json().catch(() => null)) as RazorpayPayment | null;
  if (!body || typeof body !== 'object') throw new HttpError(502, 'Could not confirm the payment with the provider.');
  return body;
}

/** Checkout signature: HMAC_SHA256(key_secret, order_id + '|' + payment_id), compared in constant time. */
export function checkoutSignatureValid(secret: string, orderId: string, paymentId: string, signature: string): boolean {
  return safeEqual(hmacHex(secret, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC_SHA256(webhook_secret, raw body), compared in constant time. */
export function webhookSignatureValid(secret: string, rawBody: Buffer, signature: string): boolean {
  return safeEqual(hmacHex(secret, rawBody), signature);
}
