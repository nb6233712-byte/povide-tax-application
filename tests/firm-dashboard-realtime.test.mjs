/**
 * ============================================================================
 * TEST SUITE: FIRM DASHBOARD LIVE REAL-TIME FIREBASE CONNECTION & ZERO METRICS
 * ============================================================================
 * 
 * Verifies requirements:
 * 1. "DOCS AWAITING REVIEW" KPI card displays 0 when zero documents are pending review.
 * 2. Connects to backend Firebase Firestore via real-time listeners (onSnapshot).
 * 3. Dynamically updates #metric-docs-awaiting-review in real time as documents transition
 *    between missing, in_review, and accepted.
 * 4. Connects live signatures and invoices telemetry from backend Firebase.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Firm Dashboard Live Firebase Connection & Zero Metric Display', () => {
  const baseDir = path.resolve('c:/Users/user/Desktop/web app1/web app');
  const firmJsPath = path.join(baseDir, 'js/firm/dashboard.js');
  const code = fs.readFileSync(firmJsPath, 'utf8');

  let mockDOM;
  let virtualWindow;
  let FirmDashboard;
  let queryListeners;
  let mockDb;
  let mockAuth;

  beforeEach(() => {
    mockDOM = { innerHTML: '', querySelector: () => null };
    queryListeners = [];
    mockDb = { type: 'cloud_firestore_instance' };
    mockAuth = {
      currentUser: {
        uid: 'preparer_denise_cpa',
        displayName: 'Denise Rosenthal, CPA',
        email: 'denise@pivot-aide.tax',
        role: 'firm_preparer',
        mfaVerified: true
      }
    };

    virtualWindow = {
      firebaseAuth: mockAuth,
      firebaseDb: mockDb,
      collection: (dbInstance, collectionName) => ({ name: collectionName }),
      onSnapshot: (target, onNext, onError) => {
        const listener = { target, onNext, onError };
        queryListeners.push(listener);
        return () => {
          const idx = queryListeners.indexOf(listener);
          if (idx !== -1) queryListeners.splice(idx, 1);
        };
      },
      document: {
        getElementById: (id) => {
          if (id === 'dashboard-content-area') return mockDOM;
          if (id === 'metric-docs-awaiting-review') {
            return {
              set textContent(val) {
                mockDOM.metricDocsVal = val;
              },
              get textContent() {
                return mockDOM.metricDocsVal;
              }
            };
          }
          if (id === 'metric-signatures-pending') {
            return {
              set textContent(val) {
                mockDOM.metricSigsVal = val;
              }
            };
          }
          if (id === 'metric-outstanding-ar') {
            return {
              set textContent(val) {
                mockDOM.metricArVal = val;
              },
              get textContent() {
                return mockDOM.metricArVal;
              }
            };
          }
          if (id === 'metric-outstanding-ar-count') {
            return {
              set innerHTML(val) {
                mockDOM.metricArCountVal = val;
              },
              get innerHTML() {
                return mockDOM.metricArCountVal;
              }
            };
          }
          if (id === 'metric-total-clients') {
            return {
              set textContent(val) {
                mockDOM.metricTotalClientsVal = val;
              },
              get textContent() {
                return mockDOM.metricTotalClientsVal;
              }
            };
          }
          if (id === 'metric-active-engagements') {
            return {
              set textContent(val) {
                mockDOM.metricActiveEngagementsVal = val;
              },
              get textContent() {
                return mockDOM.metricActiveEngagementsVal;
              }
            };
          }
          if (id === 'pipeline-heading') {
            return {
              set textContent(val) {
                mockDOM.pipelineHeadingVal = val;
              },
              get textContent() {
                return mockDOM.pipelineHeadingVal;
              }
            };
          }
          if (id.startsWith('pipeline-stage-count-')) {
            const st = id.replace('pipeline-stage-count-', '');
            return {
              set textContent(val) {
                mockDOM['stageCount_' + st] = val;
              },
              get textContent() {
                return mockDOM['stageCount_' + st];
              }
            };
          }
          if (id.startsWith('pipeline-stage-pct-')) {
            const st = id.replace('pipeline-stage-pct-', '');
            return {
              set textContent(val) {
                mockDOM['stagePct_' + st] = val;
              },
              get textContent() {
                return mockDOM['stagePct_' + st];
              }
            };
          }
          if (id === 'metric-returns-awaiting') {
            return {
              set textContent(val) {
                mockDOM.metricReturnsVal = val;
              },
              get textContent() {
                return mockDOM.metricReturnsVal;
              }
            };
          }
          if (id === 'triage-queue-body') {
            return {
              set innerHTML(val) {
                mockDOM.triageBodyVal = val;
              },
              get innerHTML() {
                return mockDOM.triageBodyVal;
              }
            };
          }
          if (id === 'triage-count-badge') {
            return {
              set textContent(val) {
                mockDOM.triageBadgeVal = val;
              },
              get textContent() {
                return mockDOM.triageBadgeVal;
              },
              set className(val) {
                mockDOM.triageBadgeClass = val;
              },
              get className() {
                return mockDOM.triageBadgeClass;
              }
            };
          }
          if (id === 'docs-queue-list-container') {
            return {
              set innerHTML(val) {
                mockDOM.docsQueueListVal = val;
              },
              get innerHTML() {
                return mockDOM.docsQueueListVal;
              }
            };
          }
          if (id === 'docs-queue-heading') {
            return {
              set textContent(val) {
                mockDOM.docsQueueHeadingVal = val;
              },
              get textContent() {
                return mockDOM.docsQueueHeadingVal;
              }
            };
          }
          if (id === 'missing-docs-list-container') {
            return {
              set innerHTML(val) {
                mockDOM.missingDocsListVal = val;
              },
              get innerHTML() {
                return mockDOM.missingDocsListVal;
              }
            };
          }
          if (id === 'missing-docs-heading') {
            return {
              set textContent(val) {
                mockDOM.missingDocsHeadingVal = val;
              },
              get textContent() {
                return mockDOM.missingDocsHeadingVal;
              }
            };
          }
          if (id === 'header-review-next-btn') {
            return {
              set textContent(val) {
                mockDOM.headerReviewNextBtnVal = val;
              },
              get textContent() {
                return mockDOM.headerReviewNextBtnVal;
              }
            };
          }
          return null;
        }
      },
      localStorage: {
        getItem: (k) => {
          if (k === 'tfr_user_session') {
            return JSON.stringify(mockAuth.currentUser);
          }
          return null;
        },
        setItem: () => {},
        removeItem: () => {}
      },
      FirebaseBridge: {
        db: mockDb,
        collection: (dbInstance, name) => ({ name }),
        onSnapshot: (target, onNext, onError) => {
          const listener = { target, onNext, onError };
          queryListeners.push(listener);
          return () => {
            const idx = queryListeners.indexOf(listener);
            if (idx !== -1) queryListeners.splice(idx, 1);
          };
        },
        getCurrentUser: () => mockAuth.currentUser,
        getFirmOperationsData: async () => ({
          metrics: {
            totalClients: 0,
            activeEngagements: 0,
            docsAwaitingReview: 0,
            missingDocRequests: 11,
            returnsAwaitingApproval: 4,
            signaturesPending: 1,
            unansweredMessages: 4,
            unpaidInvoicesCount: 0,
            unpaidInvoicesTotal: 0.00,
            upcomingDeadlines: 4
          },
          triageQueue: [],
          preparationStages: [
            { stage: 1, name: 'Intake Opened', count: 0, pct: '0%', color: 'var(--ink-2)' },
            { stage: 2, name: 'Documents Pending', count: 0, pct: '0%', color: 'var(--accent)' },
            { stage: 3, name: 'In Preparation', count: 0, pct: '0%', color: 'var(--gold)' },
            { stage: 4, name: 'Senior CPA Review', count: 0, pct: '0%', color: 'var(--accent)' },
            { stage: 5, name: 'Client Signature (8879)', count: 0, pct: '0%', color: 'var(--gold)' },
            { stage: 6, name: 'E-File Transmitted', count: 0, pct: '0%', color: 'var(--ok)' }
          ]
        })
      }
    };

    const fn = new Function('window', 'document', code);
    fn(virtualWindow, virtualWindow.document);
    FirmDashboard = virtualWindow.FirmDashboard;
  });

  test('1. "DOCS AWAITING REVIEW" metric renders 0 by default when zero items are in review', async () => {
    await FirmDashboard.init();
    const html = mockDOM.innerHTML;

    assert.ok(html.includes('DOCS AWAITING REVIEW'), 'Must render DOCS AWAITING REVIEW card');
    assert.ok(html.includes('id="metric-docs-awaiting-review">0</div>'), 'DOCS AWAITING REVIEW must render 0 (not 6 or 7)');
  });

  test('2. Connects to backend Firebase and binds live onSnapshot listener on documentRequests', async () => {
    await FirmDashboard.init();

    // Verify onSnapshot was bound to collection documentRequests
    const docReqListener = queryListeners.find(l => l.target && l.target.name === 'documentRequests');
    assert.ok(docReqListener, 'Must bind live onSnapshot listener to documentRequests collection');

    // Simulate empty collection in Firestore (0 documents awaiting review)
    docReqListener.onNext({
      forEach: (cb) => {
        // Only missing or accepted documents
        cb({ id: 'req_w2', data: () => ({ status: 'accepted', title: 'W-2' }) });
        cb({ id: 'req_1099', data: () => ({ status: 'missing', title: '1099-MISC' }) });
      }
    });

    assert.equal(mockDOM.metricDocsVal, '0', 'Live listener must update metric to 0');
    assert.equal(FirmDashboard.state.metrics.docsAwaitingReview, 0);
  });

  test('3. Dynamically updates "DOCS AWAITING REVIEW" in real time when files are uploaded and accepted', async () => {
    await FirmDashboard.init();

    const docReqListener = queryListeners.find(l => l.target && l.target.name === 'documentRequests');
    assert.ok(docReqListener);

    // Initial state: 0 docs awaiting review
    docReqListener.onNext({
      forEach: (cb) => {
        cb({ id: 'req_w2', data: () => ({ status: 'accepted' }) });
      }
    });
    assert.equal(mockDOM.metricDocsVal, '0');

    // Taxpayer uploads 2 documents (status transitions to in_review):
    docReqListener.onNext({
      forEach: (cb) => {
        cb({ id: 'req_w2', data: () => ({ status: 'accepted' }) });
        cb({ id: 'req_1099', data: () => ({ status: 'in_review', title: '1099-MISC' }) });
        cb({ id: 'req_closing', data: () => ({ status: 'in_review', title: 'Closing Disclosure' }) });
      }
    });
    assert.equal(mockDOM.metricDocsVal, '2', 'Metric must update to 2 when 2 documents enter review queue');
    assert.equal(FirmDashboard.state.metrics.docsAwaitingReview, 2);

    // Practitioner accepts both documents under Circular 230:
    docReqListener.onNext({
      forEach: (cb) => {
        cb({ id: 'req_w2', data: () => ({ status: 'accepted' }) });
        cb({ id: 'req_1099', data: () => ({ status: 'accepted' }) });
        cb({ id: 'req_closing', data: () => ({ status: 'accepted' }) });
      }
    });
    assert.equal(mockDOM.metricDocsVal, '0', 'Metric must immediately return to 0 when all documents are accepted');
    assert.equal(FirmDashboard.state.metrics.docsAwaitingReview, 0);
  });

  test('4. "OUTSTANDING AR" metric renders $0 and 0 Invoices · Stripe Connected by default when zero invoices are unpaid', async () => {
    await FirmDashboard.init();
    const html = mockDOM.innerHTML;

    assert.ok(html.includes('OUTSTANDING AR'), 'Must render OUTSTANDING AR card');
    assert.ok(html.includes('id="metric-outstanding-ar">$0</div>'), 'OUTSTANDING AR must render $0 (not $1,360)');
    assert.ok(html.includes('id="metric-outstanding-ar-count">0 Invoices &middot; Stripe Connected</div>'), 'Invoice count must render 0 Invoices · Stripe Connected');
  });

  test('5. Connects to backend Firebase and binds live onSnapshot listener on invoices, updating AR and count dynamically in real time', async () => {
    await FirmDashboard.init();

    // Verify onSnapshot was bound to collection invoices
    const invsListener = queryListeners.find(l => l.target && l.target.name === 'invoices');
    assert.ok(invsListener, 'Must bind live onSnapshot listener to invoices collection');

    // Initial state: all invoices paid (0 unpaid)
    invsListener.onNext({
      forEach: (cb) => {
        cb({ id: 'inv_paid_1', data: () => ({ status: 'paid', totalAmount: 1240.00 }) });
      }
    });

    assert.equal(mockDOM.metricArVal, '$0', 'AR total must update to $0 when all invoices are paid');
    assert.ok(mockDOM.metricArCountVal.includes('0 Invoices'), 'AR count must show 0 Invoices');
    assert.equal(FirmDashboard.state.metrics.unpaidInvoicesCount, 0);
    assert.equal(FirmDashboard.state.metrics.unpaidInvoicesTotal, 0);

    // Firm issues 2 new invoices (status: unpaid & past_due):
    invsListener.onNext({
      forEach: (cb) => {
        cb({ id: 'inv_paid_1', data: () => ({ status: 'paid', totalAmount: 1240.00 }) });
        cb({ id: 'inv_unpaid_1', data: () => ({ status: 'unpaid', amountDue: 500.00 }) });
        cb({ id: 'inv_past_due_1', data: () => ({ status: 'past_due', amountDue: 750.00 }) });
      }
    });

    assert.equal(mockDOM.metricArVal, '$1,250', 'AR total must update dynamically to $1,250');
    assert.ok(mockDOM.metricArCountVal.includes('2 Invoices'), 'AR count must update dynamically to 2 Invoices');
    assert.equal(FirmDashboard.state.metrics.unpaidInvoicesCount, 2);
    assert.equal(FirmDashboard.state.metrics.unpaidInvoicesTotal, 1250);

    // Clients settle all outstanding balances via Stripe:
    invsListener.onNext({
      forEach: (cb) => {
        cb({ id: 'inv_paid_1', data: () => ({ status: 'paid', totalAmount: 1240.00 }) });
        cb({ id: 'inv_unpaid_1', data: () => ({ status: 'paid', amountDue: 0, totalAmount: 500.00 }) });
        cb({ id: 'inv_past_due_1', data: () => ({ status: 'paid', amountDue: 0, totalAmount: 750.00 }) });
      }
    });

    assert.equal(mockDOM.metricArVal, '$0', 'AR total must revert to $0 when all invoices are settled');
    assert.ok(mockDOM.metricArCountVal.includes('0 Invoices'), 'AR count must revert to 0 Invoices');
    assert.equal(FirmDashboard.state.metrics.unpaidInvoicesCount, 0);
    assert.equal(FirmDashboard.state.metrics.unpaidInvoicesTotal, 0);
  });

  test('6. "AUTHORIZED CLIENTS" metric and Practice Workflow Pipeline render 0 by default when zero engagements are in backend', async () => {
    await FirmDashboard.init();
    const html = mockDOM.innerHTML;

    assert.ok(html.includes('AUTHORIZED CLIENTS'), 'Must render AUTHORIZED CLIENTS card');
    assert.ok(html.includes('id="metric-total-clients">0</div>'), 'Total clients must render 0');
    assert.ok(html.includes('id="metric-active-engagements">0 Active Tax Engagements</div>'), 'Active engagements must render 0 Active Tax Engagements');
    assert.ok(html.includes('Practice Workflow Pipeline (0 Engagements)'), 'Pipeline heading must show (0 Engagements)');
  });

  test('7. Connects to backend Firebase and binds live onSnapshot listener on engagements, updating clients and pipeline heading dynamically in real time', async () => {
    await FirmDashboard.init();

    // Verify onSnapshot was bound to collection engagements
    const engListener = queryListeners.find(l => l.target && l.target.name === 'engagements');
    assert.ok(engListener, 'Must bind live onSnapshot listener to engagements collection');

    // Initial state: 0 engagements
    engListener.onNext({
      forEach: () => {}
    });

    assert.equal(mockDOM.metricTotalClientsVal, '0', 'Client count must update to 0');
    assert.equal(mockDOM.metricActiveEngagementsVal, '0 Active Tax Engagements', 'Active engagements subtitle must update to 0');
    assert.ok(mockDOM.pipelineHeadingVal.includes('(0 Engagements)'), 'Pipeline heading must show (0 Engagements)');
    assert.equal(FirmDashboard.state.metrics.totalClients, 0);

    // Add 3 active engagements
    engListener.onNext({
      forEach: (cb) => {
        cb({ id: 'eng_1', data: () => ({ name: 'Client 1', stage: 'in_preparation' }) });
        cb({ id: 'eng_2', data: () => ({ name: 'Client 2', stage: 'review' }) });
        cb({ id: 'eng_3', data: () => ({ name: 'Client 3', stage: 'signing_pending' }) });
      }
    });

    assert.equal(mockDOM.metricTotalClientsVal, '3', 'Client count must dynamically update to 3');
    assert.equal(mockDOM.metricActiveEngagementsVal, '3 Active Tax Engagements', 'Active engagements subtitle must dynamically update to 3');
    assert.ok(mockDOM.pipelineHeadingVal.includes('(3 Engagements)'), 'Pipeline heading must show (3 Engagements)');
    assert.equal(FirmDashboard.state.metrics.totalClients, 3);

    // Verify all 6 workflow pipeline stage cards and percentages updated dynamically
    assert.equal(mockDOM.stageCount_1, '0', 'Stage 1 count must be 0');
    assert.equal(mockDOM.stagePct_1, '0%', 'Stage 1 percentage must be 0%');
    assert.equal(mockDOM.stageCount_2, '0', 'Stage 2 count must be 0');
    assert.equal(mockDOM.stagePct_2, '0%', 'Stage 2 percentage must be 0%');
    assert.equal(mockDOM.stageCount_3, '1', 'Stage 3 count must be 1');
    assert.equal(mockDOM.stagePct_3, '33%', 'Stage 3 percentage must be 33%');
    assert.equal(mockDOM.stageCount_4, '1', 'Stage 4 count must be 1');
    assert.equal(mockDOM.stagePct_4, '33%', 'Stage 4 percentage must be 33%');
    assert.equal(mockDOM.stageCount_5, '1', 'Stage 5 count must be 1');
    assert.equal(mockDOM.stagePct_5, '33%', 'Stage 5 percentage must be 33%');
    assert.equal(mockDOM.stageCount_6, '0', 'Stage 6 count must be 0');
    assert.equal(mockDOM.stagePct_6, '0%', 'Stage 6 percentage must be 0%');
  });

  test('8. Operational Triage Action Queue renders 0 Items Pending and all-clear empty state by default when live queue is clear', async () => {
    await FirmDashboard.init();
    const html = mockDOM.innerHTML;

    assert.ok(html.includes('Operational Triage Action Queue'), 'Must render Operational Triage Action Queue');
    assert.ok(html.includes('id="triage-queue-table"'), 'Must have table id triage-queue-table');
    assert.ok(html.includes('id="triage-queue-body"'), 'Must have tbody id triage-queue-body');
    assert.ok(html.includes('0 Items Pending'), 'Count badge must display 0 Items Pending');
    assert.ok(html.includes('All Operational Queues Clear'), 'Must display All Operational Queues Clear empty state');
    assert.equal(FirmDashboard.state.triageQueue.length, 0, 'triageQueue state must have 0 items');
  });

  test('9. Connects to backend Firebase live onSnapshot listeners, updating Triage Action Queue and count badge dynamically in real time', async () => {
    await FirmDashboard.init();

    const invsListener = queryListeners.find(l => l.target && l.target.name === 'invoices');
    const retListener = queryListeners.find(l => l.target && l.target.name === 'tax_returns');
    assert.ok(invsListener, 'Must bind live onSnapshot listener to invoices');
    assert.ok(retListener, 'Must bind live onSnapshot listener to tax_returns');

    // 1. Initial live state: all invoices paid, all returns authorized/approved
    invsListener.onNext({
      forEach: (cb) => {
        cb({ id: 'inv_1', data: () => ({ status: 'paid', totalAmount: 1240 }) });
      }
    });
    retListener.onNext({
      forEach: (cb) => {
        cb({ id: 'ret_1', data: () => ({ approvalStatus: 'approved', clientAuthorized: true }) });
      }
    });

    assert.equal(FirmDashboard.state.triageQueue.length, 0, 'Triage queue must have 0 items when all are paid and approved');
    assert.equal(mockDOM.triageBadgeVal, '0 Items Pending', 'Badge must show 0 Items Pending');
    assert.ok(mockDOM.triageBodyVal.includes('All Operational Queues Clear'), 'Must render clear zero state in table body');

    // 2. A taxpayer return awaits Form 8879 signature and an invoice fails:
    retListener.onNext({
      forEach: (cb) => {
        cb({ id: 'ret_1', data: () => ({ clientName: 'm.whitfield', taxYear: 2026, approvalStatus: 'pending_review', clientAuthorized: false }) });
      }
    });
    invsListener.onNext({
      forEach: (cb) => {
        cb({ id: 'inv_2026_failed', data: () => ({ clientId: 'usr_m_whitfield_example_com', status: 'failed', total: 120, failureReason: 'ACH Debit Returned: R01 Insufficient Funds (Auto-retry stopped)' }) });
      }
    });

    assert.equal(FirmDashboard.state.triageQueue.length, 2, 'Triage queue must dynamically update to 2 items');
    assert.equal(mockDOM.triageBadgeVal, '2 Pending', 'Badge must show 2 Pending');
    assert.ok(mockDOM.triageBodyVal.includes('m.whitfield'), 'Must render pending return row');
    assert.ok(mockDOM.triageBodyVal.includes('PENDING 8879'), 'Must render PENDING 8879 stage');
    assert.ok(mockDOM.triageBodyVal.includes('ACH FAILED'), 'Must render ACH FAILED stage');

    // 3. Taxpayer signs Form 8879 and ACH payment clears:
    retListener.onNext({
      forEach: (cb) => {
        cb({ id: 'ret_1', data: () => ({ clientName: 'm.whitfield', taxYear: 2026, approvalStatus: 'approved', clientAuthorized: true }) });
      }
    });
    invsListener.onNext({
      forEach: (cb) => {
        cb({ id: 'inv_2026_failed', data: () => ({ clientId: 'usr_m_whitfield_example_com', status: 'paid', total: 120 }) });
      }
    });

    assert.equal(FirmDashboard.state.triageQueue.length, 0, 'Triage queue must immediately revert to 0 items');
    assert.equal(mockDOM.triageBadgeVal, '0 Items Pending', 'Badge must revert to 0 Items Pending');
    assert.ok(mockDOM.triageBodyVal.includes('All Operational Queues Clear'), 'Triage body must revert to zero state');
  });

  test('10. Documents Awaiting Review (0) & Missing-Document Requests (0) render clear zero-states by default and dynamically update via live onSnapshot', async () => {
    await FirmDashboard.init();
    const html = mockDOM.innerHTML;

    // 1. Initial zero state assertions
    assert.ok(html.includes('Documents Awaiting Review (0)'), 'Must render Documents Awaiting Review (0) in initial render');
    assert.ok(html.includes('id="docs-queue-empty"'), 'Must render #docs-queue-empty in initial render');
    assert.ok(html.includes('Queue Cleared: 0 Documents Awaiting Review'), 'Must render Queue Cleared zero banner');
    assert.equal(FirmDashboard.state.documentsQueue.length, 0, 'documentsQueue state must have 0 items');

    assert.ok(html.includes('Missing-Document Requests (0)'), 'Must render Missing-Document Requests (0) in initial render');
    assert.ok(html.includes('id="missing-docs-empty"'), 'Must render #missing-docs-empty in initial render');
    assert.ok(html.includes('All Checklists Complete: 0 Missing Documents'), 'Must render All Checklists Complete zero banner');
    assert.equal(FirmDashboard.state.missingDocs.length, 0, 'missingDocs state must have 0 items');

    // 2. Real-time live update: 1 document enters review and 1 checklist item becomes missing
    const docReqListener = queryListeners.find(l => l.target && l.target.name === 'documentRequests');
    assert.ok(docReqListener);

    docReqListener.onNext({
      forEach: (cb) => {
        cb({ id: 'req_closing', data: () => ({ status: 'in_review', title: 'Closing Disclosure — 214 Halcyon Row.pdf', clientName: 'Michael Whitfield' }) });
        cb({ id: 'req_1099misc', data: () => ({ status: 'missing', title: 'Rental Property 1099-MISC', clientName: 'Michael Whitfield', daysOverdue: 6 }) });
      }
    });

    assert.equal(FirmDashboard.state.documentsQueue.length, 1, 'documentsQueue must update to 1');
    assert.equal(FirmDashboard.state.missingDocs.length, 1, 'missingDocs must update to 1');
    assert.equal(mockDOM.docsQueueHeadingVal, 'Documents Awaiting Review (1)', 'Heading must update to (1)');
    assert.ok(mockDOM.docsQueueListVal.includes('Closing Disclosure — 214 Halcyon Row.pdf'), 'Must render new document in queue');
    assert.equal(mockDOM.missingDocsHeadingVal, 'Missing-Document Requests (1)', 'Missing heading must update to (1)');
    assert.ok(mockDOM.missingDocsListVal.includes('Rental Property 1099-MISC'), 'Must render new missing request in list');

    // 3. Document reviewed and missing checklist received (queue cleared to 0)
    docReqListener.onNext({
      forEach: (cb) => {
        cb({ id: 'req_closing', data: () => ({ status: 'accepted', title: 'Closing Disclosure — 214 Halcyon Row.pdf' }) });
        cb({ id: 'req_1099misc', data: () => ({ status: 'accepted', title: 'Rental Property 1099-MISC' }) });
      }
    });

    assert.equal(FirmDashboard.state.documentsQueue.length, 0, 'documentsQueue must revert to 0');
    assert.equal(FirmDashboard.state.missingDocs.length, 0, 'missingDocs must revert to 0');
    assert.equal(mockDOM.docsQueueHeadingVal, 'Documents Awaiting Review (0)', 'Heading must revert to (0)');
    assert.ok(mockDOM.docsQueueListVal.includes('Queue Cleared: 0 Documents Awaiting Review'), 'List container must display zero banner');
    assert.equal(mockDOM.missingDocsHeadingVal, 'Missing-Document Requests (0)', 'Missing heading must revert to (0)');
    assert.ok(mockDOM.missingDocsListVal.includes('All Checklists Complete: 0 Missing Documents'), 'Missing list container must display zero banner');
  });
});

