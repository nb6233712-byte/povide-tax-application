/**
 * ============================================================================
 * PRIORITY 2: DOCUMENT ACCEPTANCE AND REJECTION (TRUSTED BACKEND HANDLER)
 * ============================================================================
 * 
 * Statutory & Compliance Authority:
 * - Treasury Department Circular 230 § 10.22 (Diligence as to accuracy)
 * - IRC § 6694 (Understatement of taxpayer liability by tax return preparer)
 * 
 * Trust Boundary:
 * A taxpayer / client must NEVER be able to accept or reject their own documents.
 * Circular 230 mandates that a licensed practitioner verify the document.
 * Therefore, acceptance/rejection MUST be committed by staff on the trusted backend.
 */

import { unauthenticated, permissionDenied, invalidArgument, notFound, safeErrorResponse } from './errors.mjs';
import { idempotency } from './idempotency.mjs';

export const ReviewAction = Object.freeze({
  ACCEPT: 'accept',
  REJECT: 'reject'
});

/**
 * Handles trusted document review decisions.
 * 
 * @param {object} params
 * @param {object} params.context - Caller authentication context { uid, email, role, mfaVerified, displayName }
 * @param {string} params.documentId - Document or request ID
 * @param {string} params.action - 'accept' | 'reject'
 * @param {string} [params.notes] - Practitioner verification notes or rejection explanation
 * @param {string} [params.idempotencyKey]
 * @param {object} services - { firestoreDb, auditLogger, notificationDispatcher }
 */
export async function documentReviewHandler(params, services) {
  const { context, documentId, action, notes, idempotencyKey } = params;
  const { firestoreDb, auditLogger, notificationDispatcher } = services;

  try {
    // 1. Authenticate caller
    if (!context || !context.uid) {
      throw unauthenticated('Authentication required to review documents.');
    }

    // 2. Authorize caller — Must be firm_preparer or firm_admin with MFA
    const isStaff = (context.role === 'firm_preparer' || context.role === 'firm_admin');
    if (!isStaff) {
      throw permissionDenied('Taxpayers cannot accept or reject documents. Practitioner review required under Circular 230.');
    }
    if (!context.mfaVerified) {
      throw permissionDenied('MFA verification required for tax practitioner operations.');
    }

    // 3. Validate input
    if (!documentId || typeof documentId !== 'string') {
      throw invalidArgument('Valid document ID is required.');
    }

    const cleanAction = (action || '').toLowerCase().trim();
    if (cleanAction !== ReviewAction.ACCEPT && cleanAction !== ReviewAction.REJECT) {
      throw invalidArgument(`Action must be either '${ReviewAction.ACCEPT}' or '${ReviewAction.REJECT}'.`);
    }

    if (cleanAction === ReviewAction.REJECT && (!notes || !notes.trim())) {
      throw invalidArgument('A clear rejection reason is required to notify the taxpayer under Circular 230 § 10.22.');
    }

    // 4. Wrap with idempotency
    const key = idempotencyKey || `doc_rev_${documentId}_${cleanAction}`;
    return await idempotency.executeIdempotent(key, async () => {
      const timestamp = new Date().toISOString();
      const reviewerName = context.displayName || context.email || 'Assigned Practitioner, CPA';

      let docRecord = null;
      let targetCollection = 'documentRequests';

      if (firestoreDb && typeof firestoreDb.collection === 'function') {
        // Look up in documentRequests first
        let snap = await firestoreDb.collection('documentRequests').doc(documentId).get();
        if (snap.exists) {
          docRecord = snap.data();
          targetCollection = 'documentRequests';
        } else {
          // Check documents collection
          snap = await firestoreDb.collection('documents').doc(documentId).get();
          if (snap.exists) {
            docRecord = snap.data();
            targetCollection = 'documents';
          }
        }
      }

      const newStatus = cleanAction === ReviewAction.ACCEPT ? 'accepted' : 'rejected';

      const updatePayload = {
        status: newStatus,
        reviewedAt: timestamp,
        reviewedBy: reviewerName,
        reviewerUid: context.uid,
        reviewNotes: notes || (cleanAction === ReviewAction.ACCEPT ? 'Verified accurate by CPA' : 'Scan rejected'),
        rejectionReason: cleanAction === ReviewAction.REJECT ? notes : null
      };

      if (firestoreDb && typeof firestoreDb.collection === 'function') {
        await firestoreDb.collection(targetCollection).doc(documentId).set(updatePayload, { merge: true });
      }

      // Record authoritative audit record
      const eventType = cleanAction === ReviewAction.ACCEPT ? 'DOCUMENT_ACCEPTED' : 'DOCUMENT_REJECTED';
      const actionName = cleanAction === ReviewAction.ACCEPT ? 'Document Accepted by CPA' : 'Document Rejected by CPA';

      if (auditLogger && typeof auditLogger.recordAuthoritativeEvent === 'function') {
        await auditLogger.recordAuthoritativeEvent({
          action: actionName,
          eventType,
          category: 'Documents',
          targetId: documentId,
          clientId: docRecord?.clientId || null,
          details: `${actionName} (${documentId}): ${updatePayload.reviewNotes}`,
          actor: context
        });
      }

      // If rejected, trigger automated notification to client
      if (cleanAction === ReviewAction.REJECT && notificationDispatcher) {
        await notificationDispatcher.dispatch({
          type: 'document_rejected',
          recipientUid: docRecord?.clientId || 'taxpayer',
          recipientName: docRecord?.clientName || 'Taxpayer',
          recipientEmail: docRecord?.clientEmail || null,
          metadata: {
            documentId,
            documentTitle: docRecord?.title || docRecord?.name || 'Tax Document',
            rejectionReason: notes
          }
        });
      }

      return {
        success: true,
        documentId,
        status: newStatus,
        reviewedBy: reviewerName,
        reviewedAt: timestamp,
        notes: updatePayload.reviewNotes
      };
    });

  } catch (err) {
    return safeErrorResponse(err);
  }
}
