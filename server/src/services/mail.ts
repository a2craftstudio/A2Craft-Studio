import type { Config } from '../config.js';
import type { Db } from '../db.js';
import type { Logger } from '../log.js';
import { esc } from '../util.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export interface Mailer {
  /** Sends one email. Never throws: failures are logged and swallowed (the business action already succeeded). */
  send(m: MailMessage): Promise<void>;
  /** Fire-and-forget send that is tracked so tests (and shutdown) can await it with `idle()`. */
  queue(m: MailMessage): void;
  idle(): Promise<void>;
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').slice(0, 200);

export function createMailer(config: Config, log: Logger): Mailer {
  const inflight = new Set<Promise<void>>();

  async function send(m: MailMessage): Promise<void> {
    const subject = oneLine(m.subject);
    if (!config.mail.resendApiKey) {
      // Development convenience: a one-line summary only (no body, so no links or tokens end up in logs).
      log.info(`[mail] not sent (RESEND_API_KEY unset): to=${oneLine(m.to)} subject="${subject}"`);
      return;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.mail.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: config.mail.from,
          to: [m.to],
          subject,
          html: m.html,
          ...(m.replyTo ? { reply_to: m.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) log.error(`[mail] Resend rejected "${subject}" with status ${res.status}`);
    } catch (e) {
      log.error(`[mail] could not send "${subject}"`, e);
    }
  }

  return {
    send,
    queue(m) {
      const p = send(m).finally(() => inflight.delete(p));
      inflight.add(p);
    },
    async idle() {
      while (inflight.size) await Promise.all([...inflight]);
    },
  };
}

// ---------------------------------------------------------------- notification builders

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const ref = (orderId: string) => `#${orderId.slice(0, 8).toUpperCase()}`;
const owner = (config: Config) => config.mail.ownerEmail;

interface OrderMailRow {
  id: string;
  email: string;
  customer_name: string;
  phone: string;
  total: number;
}

function orderLines(db: Db, orderId: string) {
  return db.all<{ title: string; qty: number; unit_price: number }>('SELECT title, qty, unit_price FROM order_items WHERE order_id = ? ORDER BY id', orderId);
}

/** Order confirmation to the customer plus an alert to the owner. Call only on the FIRST successful paid-marking. */
export async function notifyOrderPaid(config: Config, db: Db, mail: Mailer, orderId: string): Promise<void> {
  const o = await db.get<OrderMailRow>('SELECT id, email, customer_name, phone, total FROM orders WHERE id = ?', orderId);
  if (!o) return;
  const rows = (await orderLines(db, orderId))
    .map((i) => `<li>${esc(i.title)} × ${i.qty}: ${inr(i.unit_price * i.qty)}</li>`)
    .join('');
  await mail.send({
    to: o.email,
    subject: `Your order ${ref(o.id)} is confirmed`,
    html: `<p>Hi ${esc(o.customer_name)}, thank you for your order!</p><ul>${rows}</ul><p><b>Total: ${inr(o.total)}</b></p>
<p>Ready-made files are in your account under Downloads. Personalized and video items are prepared by hand; we will email you when they are ready.</p>
<p><a href="${esc(config.siteOrigin)}/order/${esc(o.id)}">View your order</a></p>`,
  });
  if (owner(config)) {
    await mail.send({
      to: owner(config),
      subject: `New paid order ${inr(o.total)} from ${o.customer_name}`,
      html: `<p>Order ${esc(ref(o.id))}</p><ul>${rows}</ul><p>${esc(o.customer_name)} · ${esc(o.email)} · ${esc(o.phone)}</p>`,
      replyTo: o.email,
    });
  }
}

export async function notifyDeliveryReady(config: Config, db: Db, mail: Mailer, orderId: string, productId: string): Promise<void> {
  const o = await db.get<OrderMailRow>('SELECT id, email, customer_name, phone, total FROM orders WHERE id = ?', orderId);
  if (!o) return;
  const item = await db.get<{ title: string }>('SELECT title FROM order_items WHERE order_id = ? AND product_id = ? LIMIT 1', orderId, productId);
  await mail.send({
    to: o.email,
    subject: 'Your files are ready',
    html: `<p>Hi ${esc(o.customer_name)}, your ${esc(item?.title ?? 'order')} is ready to download.</p><p><a href="${esc(config.siteOrigin)}/order/${esc(orderId)}">Open your order</a></p>`,
  });
}

export function notifyInquiry(config: Config, mail: Mailer, i: { id: string; name: string; email: string; productType: string; occasion: string; deadline: string; budget: string; style: string; description: string }): void {
  if (!owner(config)) return;
  mail.queue({
    to: owner(config),
    subject: `New custom request: ${i.productType}`,
    replyTo: i.email,
    html: `<p><b>${esc(i.name)}</b> (${esc(i.email)}) · ${esc(i.id)}</p><p>${esc(i.productType)} / ${esc(i.occasion)} / deadline ${esc(i.deadline || 'n/a')} / ${esc(i.budget)} / ${esc(i.style)}</p><p>${esc(i.description)}</p>`,
  });
}

export function notifyContact(config: Config, mail: Mailer, c: { name: string; email: string; message: string }): void {
  if (!owner(config)) return;
  mail.queue({
    to: owner(config),
    subject: `New contact message from ${c.name}`,
    replyTo: c.email,
    html: `<p><b>${esc(c.name)}</b> (${esc(c.email)})</p><p>${esc(c.message)}</p>`,
  });
}

export function notifyCallback(config: Config, mail: Mailer, r: { name: string; phone: string; topic: string; preferred: string; note: string }): void {
  if (!owner(config)) return;
  mail.queue({
    to: owner(config),
    subject: `Call-back request: ${r.name}`,
    html: `<p><b>${esc(r.name)}</b> asked for a call on <b>${esc(r.phone)}</b></p><p>${esc(r.topic)} · ${esc(r.preferred)}</p><p>${esc(r.note)}</p>`,
  });
}

export function sendPasswordReset(config: Config, mail: Mailer, to: string, name: string, token: string): void {
  const link = `${config.siteOrigin}/account?reset=${token}`;
  mail.queue({
    to,
    subject: 'Reset your A2 Craft Studio password',
    html: `<p>Hi ${esc(name)},</p><p>Use this link to choose a new password. It works once and expires in 1 hour.</p><p><a href="${esc(link)}">Reset my password</a></p><p>If you did not ask for this, you can ignore this email.</p>`,
  });
}
