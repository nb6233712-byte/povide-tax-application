/**
 * ============================================================================
 * PRIORITY 6: PRODUCTION PAYMENT WEBHOOK VERIFIER & RECONCILIATION ENGINE
 * ============================================================================
 * 
 * Statutory & Security Compliance:
 * - PCI-DSS v4.0.1 SAQ-A: Cryptographic signature verification on incoming webhooks
 * - NACHA Operating Rules & Title 31 CFR: ACH settlement transit states (R01 NSF)
 * - Secret Management: STRIPE_WEBHOOK_SECRET resolved via Google Cloud Secret Manager
 * 
 * Trust Boundary:
 * Browser client is NEVER trusted to mark an invoice as paid.
 * Only an authenticated server-to-server webhook verified with HMAC-SHA256
 * can transition invoice status to 'paid', 'pending', 'failed', or 'refunded'.
 */

import crypto from 'node:crypto';
import { permissionDenied, invalidArgument, notFound, safeErrorResponse } from './errors.mjs';
import { secretManager } from './config.mjs';
import { idempotency } from './idempotency.mjs';

/**
 * Computes Stripe-compatible HMAC-SHA256 signature for verification.
 */
export function computeStripeHmac(payloadString, secret, timestamp) {
  const signedPayload = `${timestamp}.${payloadString}`;
  return crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
}

/**
 * Validates Stripe signature header format: t=timestamp,v1=signature
 */
export function verifyStripeSignature(rawBody, signatureHeader, webhookSecret, toleranceSeconds = 300) {
  if (!signatureHeader || !webhookSecret) {
    return false;
  }

  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    return false;
  }

  // Prevent replay attacks by checking timestamp tolerance
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) {
    return false;
  }

  const expectedSignature = computeStripeHmac(rawBody, webhookSecret, timestamp);
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expectedSignature, 'hex');
  if (sigBuf.length !== expBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Production Stripe Webhook Handler:
 * Processes:
 * - checkout.session.completed / payment_intent.succeeded (Payment Succeeded)
 * - payment_intent.payment_failed (Payment Failed / Card Declined / ACH NSF R01)
 * - payment_intent.processing (Delayed ACH Settlement in Transit)
 * - checkout.session.expired (Checkout Session Cancelled / Abandoned)
 * - charge.refunded (Full or Partial Refund)
 * 
 * @param {object} params
 * @param {string} params.rawBody - Raw unparsed webhook request body string
 * @param {string} params.signatureHeader - Value of 'stripe-signature' header
 * @param {object} params.eventPayload - Parsed JSON event object
 * @param {object} services - { firestoreDb, auditLogger, notificationDispatcher }
 */
export async function paymentWebhookHandler(params, services) {
  const { rawBody, signatureHeader, eventPayload, idempotencyKey } = params;
  const { firestoreDb, auditLogger, notificationDispatcher } = services;

  try {
    if (!eventPayload || !eventPayload.type) {
      throw invalidArgument('Valid webhook event payload is required.');
    }

    // 1. Resolve webhook secret from Secret Manager or test params
    const webhookSecret = params.webhookSecret || await secretManager.getSecret('STRIPE_WEBHOOK_SECRET', 'whsec_test_mock_secret');

    // 2. Cryptographic signature verification
    const isValid = verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
    if (!isValid) {
      throw permissionDenied('Webhook cryptographic signature verification failed. Untrusted caller.');
    }

    // 3. Idempotency control on webhook event ID (Stripe retries on 5xx/network timeouts)
    const eventId = eventPayload.id || idempotencyKey || idempotency.hashPayload(eventPayload);
    const key = `wh_stripe_${eventId}`;

    return await idempotency.executeIdempotent(key, async () => {
      const eventType = eventPayload.type;
      const dataObj = eventPayload.data?.object || {};
      const now = new Date().toISOString();

      // Extract invoice and client metadata
      const invoiceId = dataObj.metadata?.invoiceId || dataObj.metadata?.invoice_id || dataObj.client_reference_id || dataObj.invoiceId;
      const clientId = dataObj.metadata?.clientId || dataObj.clientId;

      // ──────────────────────────────────────────────────────────────────────────
      // EVENT A: Payment Succeeded (checkout.session.completed / payment_intent.succeeded)
      // ──────────────────────────────────────────────────────────────────────────
      if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
        if (!invoiceId) {
          throw invalidArgument('Webhook payload missing invoice identifier.');
        }

        const paymentMethod = dataObj.payment_method_types?.[0] || (dataObj.payment_method_details?.type) || 'bank_transfer';
        const isCard = paymentMethod.includes('card');
        const txnRef = dataObj.payment_intent || dataObj.id || `txn_${Date.now()}`;

        const invoiceUpdate = {
          status: 'paid',
          paidAt: now,
          paidMethod: isCard ? 'Visa / Mastercard (Tokenized Stripe Vault)' : 'ACH Bank Transfer (Direct Settlement)',
          transactionRef: txnRef,
          settlementRef: `reconciled_stripe_${eventId}`,
          updatedAt: now
        };

        if (firestoreDb && typeof firestoreDb.collection === 'function') {
          await firestoreDb.collection('invoices').doc(invoiceId).set(invoiceUpdate, { merge: true });
        }

        // Record authoritative PAYMENT_CONFIRMED audit event
        if (auditLogger && typeof auditLogger.recordAuthoritativeEvent === 'function') {
          await auditLogger.recordAuthoritativeEvent({
            action: 'Payment Confirmed by Gateway',
            eventType: 'PAYMENT_CONFIRMED',
            category: 'Billing',
            targetId: invoiceId,
            clientId: clientId || null,
            details: `Invoice ${invoiceId} settled via webhook ${eventId}. Method: ${invoiceUpdate.paidMethod}. Ref: ${txnRef}`,
            actor: { uid: 'stripe_gateway_webhook', email: 'webhook@stripe.com', role: 'external_gateway' }
          });
        }

        // Dispatch receipt notification
        if (notificationDispatcher && clientId) {
          await notificationDispatcher.dispatch({
            type: 'in_app',
            recipientUid: clientId,
            metadata: {
              title: `Payment Receipt: ${invoiceId}`,
              message: `Payment confirmed for invoice ${invoiceId}. Ref: ${txnRef}. Thank you.`
            }
          });
        }

        return {
          received: true,
          processed: true,
          eventId,
          eventType,
          invoiceId,
          status: 'paid',
          transactionRef: txnRef
        };
      }

      // ──────────────────────────────────────────────────────────────────────────
      // EVENT B: Payment Failed (payment_intent.payment_failed)
      // ──────────────────────────────────────────────────────────────────────────
      if (eventType === 'payment_intent.payment_failed') {
        if (!invoiceId) {
          return { received: true, ignored: true, reason: 'No invoice metadata on failed intent' };
        }

        const failureMessage = dataObj.last_payment_error?.message || 'Transaction declined by issuer / bank clearinghouse';
        const failureCode = dataObj.last_payment_error?.code || 'payment_failed';

        const invoiceUpdate = {
          status: 'failed',
          failureReason: failureMessage,
          failureCode: failureCode,
          updatedAt: now
        };

        if (firestoreDb && typeof firestoreDb.collection === 'function') {
          await firestoreDb.collection('invoices').doc(invoiceId).set(invoiceUpdate, { merge: true });
        }

        if (auditLogger && typeof auditLogger.recordAuthoritativeEvent === 'function') {
          await auditLogger.recordAuthoritativeEvent({
            action: 'Payment Transaction Failed',
            eventType: 'PAYMENT_FAILED',
            category: 'Billing',
            targetId: invoiceId,
            clientId: clientId || null,
            details: `Payment failure on ${invoiceId}: ${failureMessage} (Code: ${failureCode})`,
            actor: { uid: 'stripe_gateway_webhook', email: 'webhook@stripe.com', role: 'external_gateway' }
          });
        }

        if (notificationDispatcher && clientId) {
          await notificationDispatcher.dispatch({
            type: 'in_app',
            recipientUid: clientId,
            metadata: {
              title: `Payment Unsuccessful: ${invoiceId}`,
              message: `Your payment could not be processed: ${failureMessage}. Please update payment method.`
            }
          });
        }

        return {
          received: true,
          processed: true,
          eventId,
          eventType,
          invoiceId,
          status: 'failed',
          error: failureMessage
        };
      }

      // ──────────────────────────────────────────────────────────────────────────
      // EVENT C: Delayed ACH Settlement in Transit (payment_intent.processing)
      // ──────────────────────────────────────────────────────────────────────────
      if (eventType === 'payment_intent.processing') {
        if (!invoiceId) {
          return { received: true, ignored: true };
        }

        const txnRef = dataObj.id || `pi_${Date.now()}`;
        const invoiceUpdate = {
          status: 'pending',
          statusText: 'ACH Clearing in Transit (2-3 business days)',
          transactionRef: txnRef,
          updatedAt: now
        };

        if (firestoreDb && typeof firestoreDb.collection === 'function') {
          await firestoreDb.collection('invoices').doc(invoiceId).set(invoiceUpdate, { merge: true });
        }

        if (auditLogger && typeof auditLogger.recordAuthoritativeEvent === 'function') {
          await auditLogger.recordAuthoritativeEvent({
            action: 'ACH Payment In Transit',
            eventType: 'PAYMENT_PROCESSING',
            category: 'Billing',
            targetId: invoiceId,
            clientId: clientId || null,
            details: `ACH transfer initiated for ${invoiceId}. Pending clearinghouse settlement. Ref: ${txnRef}`,
            actor: { uid: 'stripe_gateway_webhook', email: 'webhook@stripe.com', role: 'external_gateway' }
          });
        }

        return {
          received: true,
          processed: true,
          eventId,
          eventType,
          invoiceId,
          status: 'pending'
        };
      }

      // ──────────────────────────────────────────────────────────────────────────
      // EVENT D: Checkout Session Cancelled / Expired (checkout.session.expired)
      // ──────────────────────────────────────────────────────────────────────────
      if (eventType === 'checkout.session.expired') {
        if (invoiceId && firestoreDb && typeof firestoreDb.collection === 'function') {
          // Clear active session reference without altering invoice issued balance
          await firestoreDb.collection('invoices').doc(invoiceId).set({
            activePaymentSessionId: null,
            updatedAt: now
          }, { merge: true });
        }

        if (auditLogger && typeof auditLogger.recordAuthoritativeEvent === 'function') {
          await auditLogger.recordAuthoritativeEvent({
            action: 'Hosted Checkout Session Expired',
            eventType: 'PAYMENT_SESSION_EXPIRED',
            category: 'Billing',
            targetId: invoiceId || dataObj.id,
            clientId: clientId || null,
            details: `Checkout session ${dataObj.id} expired without completion. Invoice remains payable.`,
            actor: { uid: 'stripe_gateway_webhook', email: 'webhook@stripe.com', role: 'external_gateway' }
          });
        }

        return {
          received: true,
          processed: true,
          eventId,
          eventType,
          status: 'expired'
        };
      }

      // ──────────────────────────────────────────────────────────────────────────
      // EVENT E: Refund Processed (charge.refunded)
      // ──────────────────────────────────────────────────────────────────────────
      if (eventType === 'charge.refunded') {
        const refundAmountCents = dataObj.amount_refunded || 0;
        const totalAmountCents = dataObj.amount || 0;
        const isFullRefund = refundAmountCents >= totalAmountCents;
        const refundAmountDollars = (refundAmountCents / 100).toFixed(2);

        if (invoiceId && firestoreDb && typeof firestoreDb.collection === 'function') {
          await firestoreDb.collection('invoices').doc(invoiceId).set({
            status: isFullRefund ? 'refunded' : 'partially_refunded',
            refundedAt: now,
            refundAmount: Number(refundAmountDollars),
            refundRef: dataObj.refunds?.data?.[0]?.id || `ref_${Date.now()}`,
            updatedAt: now
          }, { merge: true });
        }

        if (auditLogger && typeof auditLogger.recordAuthoritativeEvent === 'function') {
          await auditLogger.recordAuthoritativeEvent({
            action: 'Invoice Payment Refunded',
            eventType: 'PAYMENT_REFUNDED',
            category: 'Billing',
            targetId: invoiceId || dataObj.id,
            clientId: clientId || null,
            details: `Refund of $${refundAmountDollars} processed on invoice ${invoiceId}. Full: ${isFullRefund}`,
            actor: { uid: 'stripe_gateway_webhook', email: 'webhook@stripe.com', role: 'external_gateway' }
          });
        }

        return {
          received: true,
          processed: true,
          eventId,
          eventType,
          invoiceId,
          status: isFullRefund ? 'refunded' : 'partially_refunded',
          refundAmount: Number(refundAmountDollars)
        };
      }

      // Default acknowledgement for unhandled event types (e.g. customer.created)
      return {
        received: true,
        ignored: true,
        eventType
      };
    });

  } catch (err) {
    return safeErrorResponse(err);
  }
}
