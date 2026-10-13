/**
 * ============================================================================
 * THE FILE ROOM — FIREBASE CLOUD FUNCTIONS ENTRY POINT (TRUSTED BACKEND)
 * ============================================================================
 * 
 * Production Deployment:
 * firebase deploy --only functions
 * 
 * Governing Standards:
 * - FTC Safeguards Rule (16 CFR Part 314 § 314.4)
 * - Internal Revenue Code § 7216 & § 6694
 * - IRS Publication 1345 & IRM 10.10.1
 * - PCI-DSS v4.0.1 SAQ-A
 * - Treasury Department Circular 230 § 10.22
 */

// Priority Modules
export { provisionStaffRoleHandler } from './src/auth-roles.mjs';
export { documentReviewHandler } from './src/document-review.mjs';
export { publishPreparedReturnHandler, clientApproveReturnHandler } from './src/return-workflow.mjs';
export { auditLedger, AuditLedgerService } from './src/audit-ledger.mjs';
export { createPaymentCheckoutSessionHandler } from './src/payment-checkout.mjs';
export { paymentWebhookHandler } from './src/payment-webhook.mjs';
export { signingProviderCallbackHandler } from './src/signing-callback.mjs';
export { createDocuSignEnvelopeSessionHandler, docuSignConnectWebhookHandler } from './src/docusign-service.mjs';
export { fileScanStatusHandler } from './src/malware-scanner.mjs';
export { notificationDispatcher, NotificationDispatcherService } from './src/notification-dispatcher.mjs';
export { staffIssueInvoiceHandler, staffRefundInvoiceHandler } from './src/invoice-service.mjs';
export { grantConsentHandler, revokeConsentHandler, verifyActiveConsentHandler, MANDATORY_7216_STATUTORY_WARNING } from './src/consent-service.mjs';
export { evaluateRetentionScheduleHandler, executeSecureDisposalHandler, RETENTION_POLICIES } from './src/data-retention-service.mjs';
export { secretManager } from './src/config.mjs';
export { idempotency } from './src/idempotency.mjs';
export { ErrorCode, AppError, safeErrorResponse } from './src/errors.mjs';

/**
 * Convenience Firebase Cloud Functions v2 Handler Registry
 * For use when running inside live Firebase Functions runtime.
 */
export function createFunctionHandlers(services = {}) {
  const {
    adminAuth,
    firestoreDb,
    auditLogger,
    notificationDispatcher: notifService,
    stripeMock,
    postmarkMock
  } = services;

  return {
    // 1. Staff Role Provisioning (Callable)
    provisionStaffRole: async (data, context) => {
      const { provisionStaffRoleHandler } = await import('./src/auth-roles.mjs');
      return provisionStaffRoleHandler({ context, ...data }, { adminAuth, firestoreDb, auditLogger });
    },

    // 2. Document Review (Callable)
    reviewDocument: async (data, context) => {
      const { documentReviewHandler } = await import('./src/document-review.mjs');
      return documentReviewHandler({ context, ...data }, { firestoreDb, auditLogger, notificationDispatcher: notifService });
    },

    // 3. Return Publication & Approval (Callable)
    publishReturn: async (data, context) => {
      const { publishPreparedReturnHandler } = await import('./src/return-workflow.mjs');
      return publishPreparedReturnHandler({ context, ...data }, { firestoreDb, auditLogger, notificationDispatcher: notifService });
    },
    approveReturn: async (data, context) => {
      const { clientApproveReturnHandler } = await import('./src/return-workflow.mjs');
      return clientApproveReturnHandler({ context, ...data }, { firestoreDb, auditLogger, notificationDispatcher: notifService });
    },

    // 4. Trusted Audit Event (Callable)
    recordAuditEvent: async (data, context) => {
      const { auditLedger } = await import('./src/audit-ledger.mjs');
      return auditLedger.recordAuthoritativeEvent({ ...data, actor: context });
    },

    // 5. Payment Checkout Session (Callable)
    createPaymentCheckoutSession: async (data, context) => {
      const { createPaymentCheckoutSessionHandler } = await import('./src/payment-checkout.mjs');
      return createPaymentCheckoutSessionHandler({ context, ...data }, { firestoreDb, auditLogger, stripeClientMock: stripeMock });
    },

    // 6. Payment Webhook (Raw HTTP)
    stripePaymentWebhook: async (req, res) => {
      const { paymentWebhookHandler } = await import('./src/payment-webhook.mjs');
      const result = await paymentWebhookHandler(
        {
          rawBody: req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body),
          signatureHeader: req.headers['stripe-signature'],
          eventPayload: req.body
        },
        { firestoreDb, auditLogger, notificationDispatcher: notifService }
      );
      res.status(result.success === false ? 400 : 200).json(result);
    },

    // 7. Signing Callback (Raw HTTP / Callable)
    signingCallback: async (data, context) => {
      const { signingProviderCallbackHandler } = await import('./src/signing-callback.mjs');
      return signingProviderCallbackHandler(data, { firestoreDb, auditLogger, notificationDispatcher: notifService });
    },

    // 8. Malware Scan Status (Storage Trigger / Webhook)
    updateFileScanStatus: async (data, context) => {
      const { fileScanStatusHandler } = await import('./src/malware-scanner.mjs');
      return fileScanStatusHandler(data, { firestoreDb, auditLogger });
    },

    // 9. Notification Trigger (Callable / Background)
    dispatchNotification: async (data, context) => {
      const { notificationDispatcher } = await import('./src/notification-dispatcher.mjs');
      return notificationDispatcher.dispatch(data);
    }
  };
}
