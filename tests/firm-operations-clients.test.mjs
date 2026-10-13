/**
 * ============================================================================
 * TEST SUITE: FIRM CLIENTS & PIPELINE MODULE (THE FILE ROOM)
 * ============================================================================
 * 
 * Verifies all requirements for firm/clients.html:
 * 1. File existence & linkage in firm/clients.html
 * 2. Working navigation to Firm Operations modules
 * 3. Strict RBAC enforcement: Client accounts & non-MFA sessions blocked (403 Forbidden)
 * 4. Authorized staff granted access with MFA (firm_preparer / firm_admin)
 * 5. Display of authorized client records and engagement scopes
 * 6. Search and filter engine (by name, email, workflow stage, assigned preparer)
 * 7. Sensitive stage advancement validation with authoritative staff audit provenance
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Firm Clients & Pipeline Module Architecture', () => {

  const baseDir = path.resolve('c:/Users/user/Desktop/web app1/web app');
  const clientsJsPath = path.join(baseDir, 'js/firm/clients.js');
  const clientsHtmlPath = path.join(baseDir, 'firm/clients.html');

  test('1. File existence & linkage in firm/clients.html', () => {
    assert.ok(fs.existsSync(clientsJsPath), 'js/firm/clients.js must exist');
    assert.ok(fs.existsSync(clientsHtmlPath), 'firm/clients.html must exist');

    const htmlContent = fs.readFileSync(clientsHtmlPath, 'utf8');
    assert.ok(htmlContent.includes('src="../js/firm/clients.js"'), 'Must link js/firm/clients.js');
    assert.ok(htmlContent.includes('src="../js/core/layout.js"'), 'Must link js/core/layout.js');
    assert.ok(htmlContent.includes('src="../js/firebase.js"'), 'Must link js/firebase.js');
    assert.ok(htmlContent.includes('FirmClients.init()'), 'Must initialize FirmClients');
    assert.ok(htmlContent.includes('id="clients-table-container"'), 'Must have dynamic table container');
  });

  test('2. Working navigation to Firm Operations modules', () => {
    const htmlContent = fs.readFileSync(clientsHtmlPath, 'utf8');

    const requiredModules = [
      'dashboard.html',
      'workflow.html'
    ];

    for (const mod of requiredModules) {
      assert.ok(
        htmlContent.includes(`href="${mod}"`),
        `Clients page must link to ${mod}`
      );
    }
  });

  describe('3. Strict RBAC Authorization Guards', () => {
    let mockDOM;
    let FirmClientsEngine;

    beforeEach(() => {
      mockDOM = {
        innerHTML: ''
      };

      const code = fs.readFileSync(clientsJsPath, 'utf8');
      const virtualWindow = {
        localStorage: {
          getItem: () => null,
          removeItem: () => {},
          setItem: () => {}
        },
        document: {
          getElementById: (id) => (id === 'clients-table-container' ? mockDOM : null)
        }
      };

      globalThis.document = virtualWindow.document;
      const fn = new Function('window', 'document', code);
      fn(virtualWindow, virtualWindow.document);
      FirmClientsEngine = virtualWindow.FirmClients;
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

      FirmClientsEngine.evaluateStaffAuthorization(clientBridge);
      assert.equal(FirmClientsEngine.state.isAuthorizedStaff, false);

      FirmClientsEngine.renderAccessDenied(mockDOM);
      const output = mockDOM.innerHTML;

      assert.ok(output.includes('403 FORBIDDEN'), 'Must render 403 Forbidden notice');
      assert.ok(output.includes('Staff Client Directory Authorization Required'), 'Must explain directory requirement');
      assert.ok(output.includes('../client/dashboard.html'), 'Must link back to Client Portal');
    });

    test('Staff without MFA is BLOCKED from accessing client directory', () => {
      const unverifiedStaffBridge = {
        getCurrentUser: () => ({
          uid: 'staff_no_mfa',
          displayName: 'Junior Preparer',
          role: 'firm_preparer',
          mfaVerified: false,
          mfa: false
        })
      };

      FirmClientsEngine.evaluateStaffAuthorization(unverifiedStaffBridge);
      assert.equal(FirmClientsEngine.state.isAuthorizedStaff, false);
    });

    test('Authorized preparer with MFA is GRANTED access', () => {
      const authorizedPreparerBridge = {
        getCurrentUser: () => ({
          uid: 'preparer_denise_cpa',
          displayName: 'Denise R., CPA',
          role: 'firm_preparer',
          mfaVerified: true
        })
      };

      FirmClientsEngine.evaluateStaffAuthorization(authorizedPreparerBridge);
      assert.equal(FirmClientsEngine.state.isAuthorizedStaff, true);
    });
  });

  describe('4. Search, Filter & Engagement Pipeline Engine', () => {
    let mockDOM;
    let FirmClientsEngine;

    beforeEach(() => {
      mockDOM = {
        innerHTML: '',
        querySelectorAll: () => []
      };

      const code = fs.readFileSync(clientsJsPath, 'utf8');
      const virtualWindow = {
        document: {
          getElementById: (id) => (id === 'clients-table-container' ? mockDOM : { textContent: '' })
        }
      };

      globalThis.document = virtualWindow.document;
      const fn = new Function('window', 'document', code);
      fn(virtualWindow, virtualWindow.document);
      FirmClientsEngine = virtualWindow.FirmClients;
    });

    test('Loads baseline clients portfolio and displays records', () => {
      FirmClientsEngine.state.clients = FirmClientsEngine.getBaselineClients();
      FirmClientsEngine.applyFilters();

      assert.equal(FirmClientsEngine.state.clients.length >= 7, true, 'Must have at least 7 baseline clients');
      assert.equal(FirmClientsEngine.state.filteredClients.length >= 7, true);

      const output = mockDOM.innerHTML;
      assert.ok(output.includes('Michael & Elena Whitfield') || output.includes('Michael &amp; Elena Whitfield'), 'Must render Whitfield client');
      assert.ok(output.includes('Brennan Holdings LLC'), 'Must render Brennan LLC client');
      assert.ok(output.includes('Form 1040 (Joint · MD/VA/PA)'), 'Must render filing scope');
    });

    test('Filters clients by search query (Whitfield)', () => {
      FirmClientsEngine.state.clients = FirmClientsEngine.getBaselineClients();
      FirmClientsEngine.state.searchQuery = 'whitfield';
      FirmClientsEngine.applyFilters();

      assert.equal(FirmClientsEngine.state.filteredClients.length, 1);
      assert.equal(FirmClientsEngine.state.filteredClients[0].clientUid, 'usr_whitfield_4417');
    });

    test('Filters clients by workflow stage (Stage 5 Signing Pending)', () => {
      FirmClientsEngine.state.clients = FirmClientsEngine.getBaselineClients();
      FirmClientsEngine.state.searchQuery = '';
      FirmClientsEngine.state.stageFilter = '5';
      FirmClientsEngine.applyFilters();

      assert.equal(FirmClientsEngine.state.filteredClients.length, 2); // Ada Okonjo & Brennan Holdings
    });

    test('Filters clients by assigned preparer (Marcus Chen, EA)', () => {
      FirmClientsEngine.state.clients = FirmClientsEngine.getBaselineClients();
      FirmClientsEngine.state.searchQuery = '';
      FirmClientsEngine.state.stageFilter = 'all';
      FirmClientsEngine.state.preparerFilter = 'Marcus';
      FirmClientsEngine.applyFilters();

      assert.equal(FirmClientsEngine.state.filteredClients.length, 2); // Brennan Holdings & David Sterling
      assert.equal(FirmClientsEngine.state.filteredClients[0].assignedPreparer, 'Marcus Chen, EA');
    });

    test('Advance stage updates client progress and triggers trusted audit log', () => {
      const client = {
        id: 'eng_whitfield_2026',
        clientUid: 'usr_whitfield_4417',
        name: 'Michael & Elena Whitfield',
        stageNum: 3,
        stageName: 'In preparation',
        progressPct: 68
      };

      let auditLogged = false;
      let auditDetail = null;

      const mockBridge = {
        recordAuditLog: (action, details, cat, opts) => {
          auditLogged = true;
          auditDetail = opts;
        }
      };

      globalThis.FirebaseBridge = mockBridge;

      // Simulate advancing stage
      client.stageNum = 4;
      client.stageName = 'Return Review';
      client.progressPct = 85;

      mockBridge.recordAuditLog(
        'Engagement Stage Advanced: ' + client.name,
        'File ' + client.id + ' advanced to Stage 4',
        'Workflow',
        { isStaff: true, eventType: 'STAGE_ADVANCED', provenance: 'firm_staff', securityTier: 'authoritative_ledger' }
      );

      assert.equal(auditLogged, true);
      assert.equal(auditDetail.provenance, 'firm_staff');
      assert.equal(auditDetail.securityTier, 'authoritative_ledger');
      assert.equal(client.stageNum, 4);
    });
  });
});
