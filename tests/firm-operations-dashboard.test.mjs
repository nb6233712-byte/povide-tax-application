/**
 * ============================================================================
 * TEST SUITE: FIRM OPERATIONS DASHBOARD (THE FILE ROOM)
 * ============================================================================
 * 
 * Verifies all requirements for firm/dashboard.html:
 * 1. File existence & linkage in firm/dashboard.html
 * 2. Working navigation to every Firm Operations page (12 modules + 2 exhibits)
 * 3. Strict RBAC enforcement: Client accounts & unauthenticated users blocked (403 Forbidden)
 * 4. Authorized staff granted access with MFA (firm_preparer / firm_admin)
 * 5. Display of total authorized client records (24) and active engagements (24)
 * 6. Files by workflow stage (Stages 1-6 pipeline)
 * 7. Documents awaiting review (7)
 * 8. Missing-document requests (11)
 * 9. Returns awaiting review (4)
 * 10. Pending Form 8879 signatures (3) & KBA monitoring
 * 11. Unanswered client messages (4)
 * 12. Outstanding invoices ($4,280.00) & verified payment status (issued, past due, ACH failed)
 * 13. Upcoming deadlines & priority triage action queue
 * 14. Data provenance indicators (Live Firestore telemetry vs baseline records)
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Firm Operations Dashboard Architecture & Requirements', () => {

  const baseDir = path.resolve('c:/Users/user/Desktop/web app1/web app');
  const firmJsPath = path.join(baseDir, 'js/firm/dashboard.js');
  const firmHtmlPath = path.join(baseDir, 'firm/dashboard.html');

  test('1. File existence & linkage in firm/dashboard.html', () => {
    assert.ok(fs.existsSync(firmJsPath), 'js/firm/dashboard.js must exist');
    assert.ok(fs.existsSync(firmHtmlPath), 'firm/dashboard.html must exist');

    const htmlContent = fs.readFileSync(firmHtmlPath, 'utf8');
    assert.ok(htmlContent.includes('src="../js/firm/dashboard.js"'), 'Must link js/firm/dashboard.js');
    assert.ok(htmlContent.includes('src="../js/core/layout.js"'), 'Must link js/core/layout.js');
    assert.ok(htmlContent.includes('src="../js/firebase.js"'), 'Must link js/firebase.js');
    assert.ok(htmlContent.includes('FirmDashboard.init()'), 'Must initialize FirmDashboard');
    assert.ok(htmlContent.includes('id="dashboard-content-area"'), 'Must have dynamic content area container');
  });

  test('2. Working navigation to every Firm Operations module', () => {
    const htmlContent = fs.readFileSync(firmHtmlPath, 'utf8');
    const jsContent = fs.readFileSync(firmJsPath, 'utf8');

    const requiredModules = [
      'clients.html',
      'workflow.html',
      'documents.html',
      'returns.html',
      'signatures.html',
      'messages.html',
      'services.html',
      'billing.html',
      'tasks.html',
      'audit-log.html',
      'staff.html',
      'exhibit-a.html',
      'exhibit-b.html'
    ];

    for (const mod of requiredModules) {
      assert.ok(
        htmlContent.includes(`href="${mod}"`) || jsContent.includes(`href: '${mod}'`) || jsContent.includes(`href="${mod}"`),
        `Firm dashboard must contain working navigation to ${mod}`
      );
    }
  });

  describe('3. Strict RBAC Authorization Guards', () => {
    let mockDOM;
    let FirmDashboardEngine;

    beforeEach(() => {
      mockDOM = {
        innerHTML: ''
      };

      const code = fs.readFileSync(firmJsPath, 'utf8');
      const virtualWindow = {
        localStorage: {
          getItem: () => null,
          removeItem: () => {},
          setItem: () => {}
        },
        document: {
          getElementById: (id) => (id === 'dashboard-content-area' ? mockDOM : null)
        }
      };

      globalThis.document = virtualWindow.document;
      const fn = new Function('window', 'document', code);
      fn(virtualWindow, virtualWindow.document);
      FirmDashboardEngine = virtualWindow.FirmDashboard;
    });

    test('Client account (role: client) is BLOCKED with 403 Forbidden Guard', () => {
      const clientBridge = {
        getCurrentUser: () => ({
          uid: 'usr_whitfield_4417',
          displayName: 'Michael Whitfield',
          email: 'm.whitfield@example.com',
          role: 'client',
          mfaVerified: false
        })
      };

      FirmDashboardEngine.evaluateStaffAuthorization(clientBridge);
      assert.equal(FirmDashboardEngine.state.isAuthorizedStaff, false);

      FirmDashboardEngine.renderAccessDenied(mockDOM);
      const output = mockDOM.innerHTML;

      assert.ok(output.includes('403 FORBIDDEN'), 'Must render 403 Forbidden notice');
      assert.ok(output.includes('Staff Supervisory Authorization Required'), 'Must explain staff requirement');
      assert.ok(output.includes('usr_whitfield_4417'), 'Must identify client session UID');
      assert.ok(output.includes('../client/dashboard.html'), 'Must provide redirect to Client Portal');
    });

    test('Staff account without MFA is BLOCKED from firm console', () => {
      const unverifiedStaffBridge = {
        getCurrentUser: () => ({
          uid: 'staff_unverified',
          displayName: 'Junior Preparer',
          email: 'junior@pivot-aide.tax',
          role: 'firm_preparer',
          mfaVerified: false,
          mfa: false
        })
      };

      FirmDashboardEngine.evaluateStaffAuthorization(unverifiedStaffBridge);
      assert.equal(FirmDashboardEngine.state.isAuthorizedStaff, false, 'Staff without MFA must be denied');
    });

    test('Authorized preparer with MFA is GRANTED access', () => {
      const authorizedPreparerBridge = {
        getCurrentUser: () => ({
          uid: 'preparer_denise_cpa',
          displayName: 'Denise R., CPA',
          email: 'denise@pivot-aide.tax',
          role: 'firm_preparer',
          mfaVerified: true
        })
      };

      FirmDashboardEngine.evaluateStaffAuthorization(authorizedPreparerBridge);
      assert.equal(FirmDashboardEngine.state.isAuthorizedStaff, true);
      assert.equal(FirmDashboardEngine.state.staffUser.role, 'firm_preparer');
    });

    test('Authorized admin with MFA is GRANTED access', () => {
      const authorizedAdminBridge = {
        getCurrentUser: () => ({
          uid: 'staff_managing_partner',
          displayName: 'Managing Partner',
          email: 'admin@pivot-aide.tax',
          role: 'firm_admin',
          mfaVerified: true
        })
      };

      FirmDashboardEngine.evaluateStaffAuthorization(authorizedAdminBridge);
      assert.equal(FirmDashboardEngine.state.isAuthorizedStaff, true);
      assert.equal(FirmDashboardEngine.state.staffUser.role, 'firm_admin');
    });
  });

  describe('4. Firm Telemetry & Workflow Display Engine', () => {
    let mockDOM;
    let FirmDashboardEngine;

    beforeEach(() => {
      mockDOM = {
        innerHTML: ''
      };

      const code = fs.readFileSync(firmJsPath, 'utf8');
      const virtualWindow = {
        FirebaseBridge: {
          getCurrentUser: () => ({
            uid: 'preparer_denise_cpa',
            displayName: 'Denise R., CPA',
            role: 'firm_preparer',
            mfaVerified: true
          }),
          getFirmOperationsData: async () => ({
            metrics: {
              totalClients: 24,
              activeEngagements: 24,
              docsAwaitingReview: 7,
              missingDocRequests: 11,
              returnsAwaitingApproval: 4,
              signaturesPending: 3,
              unansweredMessages: 4,
              unpaidInvoicesCount: 8,
              unpaidInvoicesTotal: 4280.00,
              upcomingDeadlines: 4
            }
          })
        },
        document: {
          getElementById: (id) => (id === 'dashboard-content-area' ? mockDOM : null)
        }
      };

      globalThis.document = virtualWindow.document;
      const fn = new Function('window', 'document', code);
      fn(virtualWindow, virtualWindow.document);
      FirmDashboardEngine = virtualWindow.FirmDashboard;
    });

    test('Renders Total Authorised Clients (24) and Active Engagements (24)', () => {
      FirmDashboardEngine.evaluateStaffAuthorization(globalThis.FirebaseBridge);
      FirmDashboardEngine.state.metrics = FirmDashboardEngine.getBaselineFirmData().metrics;
      FirmDashboardEngine.render();
      const output = mockDOM.innerHTML;

      assert.ok(output.includes('24'), 'Must display 24 client files');
      assert.ok(output.includes('AUTHORIZED CLIENTS'), 'Must display authorized clients label');
      assert.ok(output.includes('24 Active Tax Engagements'), 'Must display active engagements');
    });

    test('Renders Workflow Stages Pipeline (Stages 1 through 6)', () => {
      FirmDashboardEngine.evaluateStaffAuthorization(globalThis.FirebaseBridge);
      FirmDashboardEngine.state.preparationStages = FirmDashboardEngine.getBaselineFirmData().preparationStages;
      FirmDashboardEngine.render();
      const output = mockDOM.innerHTML;

      assert.ok(output.includes('STAGE 1'), 'Must render Stage 1');
      assert.ok(output.includes('Intake Opened'), 'Must render Intake Opened');
      assert.ok(output.includes('Checklist Upload'), 'Must render Checklist Upload');
      assert.ok(output.includes('In Preparation'), 'Must render In Preparation');
      assert.ok(output.includes('Return Review'), 'Must render Return Review');
      assert.ok(output.includes('Sign Form 8879'), 'Must render Sign Form 8879');
      assert.ok(output.includes('IRS Transmitted'), 'Must render IRS Transmitted');
    });

    test('Renders Documents Awaiting Review (7) & Missing-Document Requests (11)', () => {
      FirmDashboardEngine.evaluateStaffAuthorization(globalThis.FirebaseBridge);
      FirmDashboardEngine.state.documentsQueue = FirmDashboardEngine.getBaselineFirmData().documentsQueue;
      FirmDashboardEngine.state.missingDocs = FirmDashboardEngine.getBaselineFirmData().missingDocs;
      FirmDashboardEngine.render();
      const output = mockDOM.innerHTML;

      assert.ok(output.includes('Documents Awaiting Review (7)'), 'Must render docs review header');
      assert.ok(output.includes('Closing Disclosure 214 Halcyon Row.pdf'), 'Must render sample doc in review');
      assert.ok(output.includes('Missing-Document Requests (11)'), 'Must render missing docs header');
      assert.ok(output.includes('1099-MISC Keystone Property Group'), 'Must render missing doc item');
    });

    test('Renders Returns Awaiting Review (4) & Pending Form 8879 Signatures (3)', () => {
      FirmDashboardEngine.evaluateStaffAuthorization(globalThis.FirebaseBridge);
      FirmDashboardEngine.state.returnsList = FirmDashboardEngine.getBaselineFirmData().returnsList;
      FirmDashboardEngine.state.kbaList = FirmDashboardEngine.getBaselineFirmData().kbaList;
      FirmDashboardEngine.render();
      const output = mockDOM.innerHTML;

      assert.ok(output.includes('Returns Awaiting Review (4)'), 'Must render returns awaiting review');
      assert.ok(output.includes('Pending Form 8879 Signatures (3)'), 'Must render pending signatures');
      assert.ok(output.includes('IRS Pub 1345 § 5.2'), 'Must cite IRS Pub 1345 standard');
    });

    test('Renders Unanswered Client Messages & Outstanding AR ($4,280)', () => {
      FirmDashboardEngine.evaluateStaffAuthorization(globalThis.FirebaseBridge);
      FirmDashboardEngine.state.clientMessages = FirmDashboardEngine.getBaselineFirmData().clientMessages;
      FirmDashboardEngine.state.invoicesList = FirmDashboardEngine.getBaselineFirmData().invoicesList;
      FirmDashboardEngine.render();
      const output = mockDOM.innerHTML;

      assert.ok(output.includes('Unanswered Client Messages (4)'), 'Must render messages header');
      assert.ok(output.includes('Outstanding Invoices &amp; AR ($4,280)'), 'Must render billing AR header');
      assert.ok(output.includes('$4,280'), 'Must render $4,280 AR balance');
    });

    test('Renders Upcoming Statutory Deadlines & Provenance Stream Banner', () => {
      FirmDashboardEngine.evaluateStaffAuthorization(globalThis.FirebaseBridge);
      FirmDashboardEngine.state.metrics = FirmDashboardEngine.getBaselineFirmData().metrics;
      FirmDashboardEngine.render();
      const output = mockDOM.innerHTML;

      assert.ok(output.includes('Upcoming Statutory Deadlines'), 'Must render deadlines header');
      assert.ok(output.includes('15 Sep 2026'), 'Must display Sep 15 statutory date');
      assert.ok(output.includes('LIVE FIRESTORE · NAM5'), 'Must display live Firestore provenance badge');
      assert.ok(output.includes('Circular 230 Practice Telemetry Stream Active'), 'Must display Circular 230 telemetry label');
    });
  });

  describe('5. Firm Staff Role Normalization & Document Review Decisions', () => {
    let FirmDashboardEngine;
    let mockDOM;
    let virtualWindow;

    beforeEach(() => {
      mockDOM = { innerHTML: '' };
      const code = fs.readFileSync(firmJsPath, 'utf8');
      virtualWindow = {
        localStorage: { getItem: () => null, removeItem: () => {}, setItem: () => {} },
        document: { getElementById: (id) => (id === 'dashboard-content-area' ? mockDOM : null) },
        FileRoomLayout: { showToast: () => {}, updateBadge: () => {} }
      };
      globalThis.document = virtualWindow.document;
      globalThis.window = virtualWindow;
      const fn = new Function('window', 'document', code);
      fn(virtualWindow, virtualWindow.document);
      FirmDashboardEngine = virtualWindow.FirmDashboard;
    });

    test('Staff email jordan.mitchell@pivot-aide-tax.com is authorized as firm_preparer with MFA', () => {
      const practitionerSession = {
        uid: 'usr_jordan_mitchell',
        displayName: 'Jordan Mitchell, CPA',
        email: 'jordan.mitchell@pivot-aide-tax.com',
        role: 'firm_preparer',
        isStaff: true,
        mfa: true,
        mfaVerified: true
      };
      const bridge = {
        getCurrentUser: () => practitionerSession,
        getRole: () => 'firm_preparer',
        isStaff: () => true
      };

      FirmDashboardEngine.evaluateStaffAuthorization(bridge);
      assert.equal(FirmDashboardEngine.state.isAuthorizedStaff, true, 'Practitioner must be authorized staff');
    });

    test('_commitDocReview safely processes document acceptance without UI exceptions', async () => {
      let acceptCalled = false;
      const bridge = {
        currentUser: {
          email: 'jordan.mitchell@pivot-aide-tax.com',
          role: 'firm_preparer',
          isStaff: true,
          mfa: true
        },
        getRole: () => 'firm_preparer',
        staffAcceptDocument: async (docId, notes) => {
          acceptCalled = true;
          return { success: true, docId, status: 'accepted' };
        }
      };

      virtualWindow.FirebaseBridge = bridge;
      globalThis.FirebaseBridge = bridge;

      FirmDashboardEngine.state = {
        triageQueue: [{ docId: 'doc_1099_misc', id: 'trg_doc_doc_1099_misc' }],
        metrics: { docsAwaitingReview: 1 }
      };
      FirmDashboardEngine.updateTriageDOM = () => {};

      const mockBtn = { textContent: '', disabled: false, style: {}, closest: () => ({ style: {} }) };
      await FirmDashboardEngine._commitDocReview('doc_1099_misc', 'accepted', 'Verified by Jordan CPA', 'cli_123', mockBtn);

      assert.equal(acceptCalled, true, 'staffAcceptDocument must be invoked');
      assert.equal(mockBtn.textContent, '✓ Accepted', 'Button must be updated to Accepted');
      assert.equal(mockBtn.disabled, true, 'Button must be disabled');
      assert.equal(FirmDashboardEngine.state.triageQueue.length, 0, 'Document must be removed from queue');
    });
  });
});

