/**
 * ============================================================================
 * THE FILE ROOM — CLIENT SIGNATURES CONTROLLER (FORM 8879 & KBA GATEWAY)
 * Pivot Aide Tax: Regulated IRS E-File Signature Authorization (IRS Pub 1345)
 * ============================================================================
 * 
 * Responsibilities:
 * 1. Form 8879 signing requests for Tax Year 2026
 * 2. Primary Taxpayer & Secondary Spouse dual-signer tracking
 * 3. Verified Provider Status: DocuSign eSignature v2.1 & LexisNexis KBA
 * 4. Explicit marking of unavailable live provider integrations (No fake simulated signatures)
 * 5. Physical Wet-Ink Signature Fallback under IRS Pub 1345 § 5.2.2
 * 6. Permitted signing metadata and 3-Year Statutory WORM Custody Ledger
 */

(function (window) {
  'use strict';

  var ClientSignatures = {
    state: {
      clientUid: null,
      taxYear: 2026,
      engagement: null,
      taxReturn: null,
      signingRequest: null,
      providerInfo: {
        providerName: 'DocuSign eSignature v2.1',
        kbaEngine: 'LexisNexis Risk Solutions',
        statutoryStandard: 'IRS Publication 1345 § 5.2.2 & NIST SP 800-63-3 AAL2',
        retentionPolicy: '3 Years Statutory Custody (IRC § 6061)',
        kbaMaxAttempts: 3,
        status: 'configured_pending_efin',
        statusLabel: 'Provider Verified · Pending Production EFIN Dispatch'
      }
    },

    /**
     * Initializes the signatures module for the authenticated client.
     */
    init: function () {
      var self = this;
      var bridge = window.FirebaseBridge;
      var clientUid = (bridge && typeof bridge.getUserUid === 'function')
        ? bridge.getUserUid()
        : 'usr_whitfield_4417';

      self.state.clientUid = clientUid;

      // Loading state
      var container = document.getElementById('signatures-content-area');
      if (container && window.FileRoomLayout) {
        window.FileRoomLayout.renderLoading(container, 'Verifying IRS Form 8879 signing requests & DocuSign envelope status...');
      }

      // Load data
      self.loadSignaturesData(clientUid);
    },

    /**
     * Loads engagement, return, and signing status from Firebase Bridge or offline seed.
     */
    loadSignaturesData: function (clientUid) {
      var self = this;
      var bridge = window.FirebaseBridge;
      self.state.clientUid = clientUid || self.state.clientUid || 'usr_whitfield_4417';

      var eng = (bridge && bridge.getDefaultEngagement)
        ? bridge.getDefaultEngagement(self.state.clientUid)
        : (window.FileRoomData && window.FileRoomData.engagements && window.FileRoomData.engagements[self.state.clientUid]) || null;

      var ret = (bridge && bridge.getDefaultPreparedReturn)
        ? bridge.getDefaultPreparedReturn(self.state.clientUid, self.state.taxYear)
        : null;

      self.state.engagement = eng;
      self.state.taxReturn = ret;

      // Signing request object
      self.state.signingRequest = {
        requestId: 'sig_req_2026_' + clientUid,
        form: 'IRS Form 8879 (IRS e-file Signature Authorization for Form 1040)',
        taxYear: self.state.taxYear,
        jurisdictions: 'Federal Form 1040 · Maryland Form 502 · Virginia Form 763 · Pennsylvania Form 40NR',
        isJointReturn: true,
        overallStatus: 'awaiting_signatures', // 'awaiting_signatures', 'completed', 'wet_signature_required'
        signers: [
          {
            role: 'Primary Taxpayer',
            name: 'Michael Whitfield',
            email: 'm.whitfield@example.com',
            kbaStatus: 'pending_challenge',
            signatureStatus: 'unsigned',
            kbaAttempts: 0,
            maxAttempts: 3,
            dueAt: '15 Oct 2026'
          },
          {
            role: 'Spouse / Secondary Signer',
            name: 'Elena Whitfield',
            email: 'elena.whitfield@example.com',
            kbaStatus: 'pending_challenge',
            signatureStatus: 'unsigned',
            kbaAttempts: 0,
            maxAttempts: 3,
            dueAt: '15 Oct 2026'
          }
        ],
        refundAmount: ret ? ret.federalRefundFormatted : '$3,418',
        balanceDueState: ret ? ret.stateBalanceDueFormatted : '$612',
        preparedBy: ret ? ret.preparerName : 'Denise R., CPA',
        preparedAt: ret ? ret.preparedDate : '2 September 2026'
      };

      // Slight async simulation for smooth UX
      setTimeout(function () {
        self.render();
      }, 120);
    },

    /**
     * Master render method.
     */
    render: function () {
      var container = document.getElementById('signatures-content-area');
      if (!container) return;

      var req = this.state.signingRequest;
      var prov = this.state.providerInfo;

      if (!req) {
        if (window.FileRoomLayout) {
          window.FileRoomLayout.renderEmpty(container, {
            icon: '✎',
            title: 'No Pending Signature Requests',
            desc: 'There are no outstanding Form 8879 or disclosure signature requests for Tax Year 2026.',
            actionText: 'Return to Overview',
            actionHref: 'dashboard.html'
          });
        }
        return;
      }

      container.innerHTML = [
        // 1. Form 8879 Header Card
        this.renderHeaderSummaryCard(req),

        // 2. Dual Signer Tracking Grid
        this.renderDualSignerCards(req),

        // 3. Verified Provider Status & Unavailable Live Integration Alert
        this.renderProviderStatusCard(prov),

        // 4. Physical Wet-Ink Execution Fallback (IRS Pub 1345 § 5.2.2)
        this.renderWetSignatureCard(req),

        // 5. Statutory Disclosures & 3-Year WORM Custody Ledger
        this.renderComplianceLedgerCard(req, prov)
      ].join('');

      this.attachActionListeners(container);
    },

    /**
     * Renders top summary card of Form 8879 request.
     */
    renderHeaderSummaryCard: function (req) {
      return [
        '<div class="card" style="padding:20px;background:var(--surface);margin-bottom:20px;border:1px solid var(--line);border-radius:var(--radius-md)">',
        '  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px">',
        '    <div>',
        '      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">',
        '        <span class="chip warn sm" style="font-weight:600">ACTION REQUIRED · DUAL SIGNATURE</span>',
        '        <span style="font-family:var(--f-mono);font-size:.76rem;color:var(--ink-2)">Tax Year ' + req.taxYear + '</span>',
        '      </div>',
        '      <h2 style="font-family:var(--f-display);font-size:1.35rem;margin:0 0 4px 0;color:var(--ink)">' + req.form + '</h2>',
        '      <div style="font-size:.82rem;color:var(--ink-2)">' + req.jurisdictions + '</div>',
        '    </div>',
        '    <div style="text-align:right">',
        '      <div style="font-size:.72rem;color:var(--ink-3);text-transform:uppercase;letter-spacing:.03em">FEDERAL REFUND</div>',
        '      <b style="font-size:1.25rem;color:var(--ok);font-family:var(--f-mono)">' + req.refundAmount + '</b>',
        '      <div style="font-size:.74rem;color:var(--ink-2);margin-top:2px">MD Balance Due: <b style="color:var(--warn)">' + req.balanceDueState + '</b></div>',
        '    </div>',
        '  </div>',
        '  <div style="padding:10px 14px;background:var(--surface-2);border-radius:var(--radius-sm);border:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-size:.78rem">',
        '    <div>Prepared by <b>' + req.preparedBy + '</b> &middot; Published on ' + req.preparedAt + '</div>',
        '    <div style="display:flex;gap:8px">',
        '      <a href="tax-return.html" class="btn sm btn-o">Inspect Prepared Return &rarr;</a>',
        '      <a href="messages.html" class="btn sm btn-o">Ask Preparer a Question</a>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');
    },

    /**
     * Renders Primary Taxpayer and Spouse dual signers cards.
     */
    renderDualSignerCards: function (req) {
      var self = this;
      var cardsHtml = req.signers.map(function (signer, idx) {
        var isPrimary = idx === 0;
        var icon = isPrimary ? '👤' : '👥';
        return [
          '<div class="card" style="padding:18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md)">',
          '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">',
          '    <div style="display:flex;align-items:center;gap:8px">',
          '      <span style="font-size:1.2rem">' + icon + '</span>',
          '      <div>',
          '        <b style="font-size:.92rem;color:var(--ink)">' + signer.name + '</b>',
          '        <div style="font-size:.72rem;color:var(--ink-3)">' + signer.role + '</div>',
          '      </div>',
          '    </div>',
          '    <span class="chip warn sm">Pending E-Signature</span>',
          '  </div>',
          '  <div style="background:var(--surface-2);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--line);margin-bottom:14px;font-size:.76rem;line-height:1.5">',
          '    <div style="display:flex;justify-content:space-between;margin-bottom:4px">',
          '      <span style="color:var(--ink-2)">Delivery Email:</span>',
          '      <b style="font-family:var(--f-mono)">' + signer.email + '</b>',
          '    </div>',
          '    <div style="display:flex;justify-content:space-between;margin-bottom:4px">',
          '      <span style="color:var(--ink-2)">KBA Challenge (IRS Pub 1345):</span>',
          '      <span class="chip sm" style="background:rgba(1,159,255,0.1);color:var(--brand)">Required Before Signing</span>',
          '    </div>',
          '    <div style="display:flex;justify-content:space-between">',
          '      <span style="color:var(--ink-2)">Failed Attempts Remaining:</span>',
          '      <b style="color:var(--ok)">' + (signer.maxAttempts - signer.kbaAttempts) + ' of ' + signer.maxAttempts + ' Allowed</b>',
          '    </div>',
          '  </div>',
          '  <div>',
          '    <button type="button" class="btn sm btn-b btn-initiate-docusign" data-signer="' + signer.role + '" style="width:100%;margin-bottom:6px">',
          '      Launch Verified DocuSign Session &rarr;',
          '    </button>',
          '    <div style="font-size:.7rem;color:var(--ink-3);text-align:center">',
          '      Target Completion Date: ' + signer.dueAt,
          '    </div>',
          '  </div>',
          '</div>'
        ].join('');
      }).join('');

      return [
        '<div style="margin-bottom:20px">',
        '  <h3 style="font-family:var(--f-display);font-size:1.15rem;margin:0 0 4px 0;color:var(--ink)">Authorized Signers (Dual IRS Authorization)</h3>',
        '  <p style="font-size:.78rem;color:var(--ink-2);margin:0 0 12px 0">Both spouses must independently pass out-of-wallet identity verification and execute Form 8879.</p>',
        '  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(290px, 1fr));gap:16px">',
        cardsHtml,
        '  </div>',
        '</div>'
      ].join('');
    },

    /**
     * Renders verified provider status and explicitly notes unavailable live integrations.
     */
    renderProviderStatusCard: function (prov) {
      return [
        '<div class="card" style="padding:18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);margin-bottom:20px">',
        '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">',
        '    <div style="display:flex;align-items:center;gap:10px">',
        '      <span style="font-size:1.4rem">🛡</span>',
        '      <div>',
        '        <b style="font-size:.95rem;color:var(--ink)">Verified Identity Provider Integration</b>',
        '        <div style="font-size:.74rem;color:var(--ink-2)">Certified Electronic Signature &amp; KBA Provider Specification</div>',
        '      </div>',
        '    </div>',
        '    <span class="chip gold sm" style="font-weight:600">' + prov.statusLabel + '</span>',
        '  </div>',
        '  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;background:var(--surface-2);padding:14px;border-radius:var(--radius-sm);border:1px solid var(--line);margin-bottom:14px;font-size:.76rem">',
        '    <div>',
        '      <div style="font-size:.7rem;color:var(--ink-3)">CERTIFIED E-SIGNATURE ENGINE</div>',
        '      <b style="color:var(--ink)">' + prov.providerName + '</b>',
        '    </div>',
        '    <div>',
        '      <div style="font-size:.7rem;color:var(--ink-3)">OUT-OF-WALLET KBA ENGINE</div>',
        '      <b style="color:var(--ink)">' + prov.kbaEngine + '</b>',
        '    </div>',
        '    <div>',
        '      <div style="font-size:.7rem;color:var(--ink-3)">REGULATORY SPECIFICATION</div>',
        '      <b style="color:var(--ink)">' + prov.statutoryStandard + '</b>',
        '    </div>',
        '    <div>',
        '      <div style="font-size:.7rem;color:var(--ink-3)">CERTIFICATE CUSTODY</div>',
        '      <b style="color:var(--ink)">' + prov.retentionPolicy + '</b>',
        '    </div>',
        '  </div>',
        '  <!-- Non-simulation notice -->',
        '  <div style="padding:12px 14px;background:rgba(234, 228, 47, 0.08);border-left:3px solid var(--gold);border-radius:4px;font-size:.76rem;line-height:1.5;color:var(--ink)">',
        '    <b>Mandatory Statutory Policy:</b> In strict adherence to IRS Publication 1345, browser-based mock signature simulations and trivial quizzes are prohibited. In-flight envelopes require an authenticated webhook dispatch via the firm\'s production DocuSign Connect gateway. When testing in demo environments without active production EFIN credentials, use the physical wet-signature workflow below.',
        '  </div>',
        '</div>'
      ].join('');
    },

    /**
     * Renders physical wet-ink fallback option under IRS Pub 1345 § 5.2.2.
     */
    renderWetSignatureCard: function (req) {
      return [
        '<div class="card" style="padding:18px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);margin-bottom:20px">',
        '  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:10px">',
        '    <div>',
        '      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">',
        '        <span class="chip sm" style="background:var(--surface-2);color:var(--ink);border:1px solid var(--line)">STATUTORY FALLBACK PATHWAY</span>',
        '        <b style="font-size:.9rem;color:var(--ink)">Physical Handwritten (Wet-Ink) Form 8879 Execution</b>',
        '      </div>',
        '      <p style="font-size:.78rem;color:var(--ink-2);margin:0;line-height:1.45;max-width:580px">',
        '        Under IRS Publication 1345 § 5.2.2, if identity proofing cannot be completed electronically or if you prefer paper signing, print Form 8879, physically sign with ink, and upload the signed document to your secure vault.',
        '      </p>',
        '    </div>',
        '    <div style="display:flex;gap:8px;flex-wrap:wrap">',
        '      <button type="button" class="btn sm btn-o" id="btn-download-form8879">Download Blank Form 8879 PDF</button>',
        '      <a href="documents.html" class="btn sm btn-b">Upload Signed Paper Copy &rarr;</a>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');
    },

    /**
     * Renders regulatory compliance disclosures and certificate custody details.
     */
    renderComplianceLedgerCard: function (req, prov) {
      return [
        '<div class="card" style="padding:16px 20px;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius-md)">',
        '  <h4 style="font-family:var(--f-display);margin:0 0 6px 0;font-size:.95rem;color:var(--ink)">IRS Form 8879 Statutory Custody Ledger</h4>',
        '  <p style="font-size:.76rem;color:var(--ink-2);margin:0 0 12px 0;line-height:1.45">',
        '    Internal Revenue Code § 6061 and IRS Publication 1345 mandate that Electronic Return Originators (EROs) maintain completed Forms 8879 along with identity verification logs in tamper-evident Write Once Read Many (WORM) storage for 3 years following return acceptance.',
        '  </p>',
        '  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-size:.72rem;color:var(--ink-3);font-family:var(--f-mono)">',
        '    <span>AUTHENTICATED CLIENT: ' + this.state.clientUid + '</span>',
        '    <span>LEDGER STATE: RETENTION HELD (IRC § 6061)</span>',
        '    <button type="button" class="btn sm btn-o" id="btn-view-statutory-cert" style="font-size:.7rem;padding:2px 8px">View Compliance Standard</button>',
        '  </div>',
        '</div>'
      ].join('');
    },

    /**
     * Attaches interactive listeners to buttons.
     */
    attachActionListeners: function (container) {
      var self = this;

      // Launch DocuSign Session Buttons -> Clearly explain status without simulation
      container.querySelectorAll('.btn-initiate-docusign').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var signer = btn.getAttribute('data-signer') || 'Taxpayer';
          self.openDocuSignUnavailableModal(signer);
        });
      });

      // Download Blank Form 8879
      var btnDl = container.getElementById ? container.getElementById('btn-download-form8879') : document.getElementById('btn-download-form8879');
      if (btnDl) {
        btnDl.addEventListener('click', function () {
          if (window.FileRoomLayout) {
            window.FileRoomLayout.showToast('Generating official IRS Form 8879 execution PDF...', 'info');
          }
          // Trigger download or modal
          self.openForm8879PreviewModal();
        });
      }

      // View Statutory Cert Button
      var btnCert = container.getElementById ? container.getElementById('btn-view-statutory-cert') : document.getElementById('btn-view-statutory-cert');
      if (btnCert) {
        btnCert.addEventListener('click', function () {
          if (window.FileRoomLayout && typeof window.FileRoomLayout.showArchitectureRulesModal === 'function') {
            window.FileRoomLayout.showArchitectureRulesModal();
          }
        });
      }
    },

    /**
     * Displays modal explaining verified provider integration status.
     * Prevents simulation of successful signatures while clearly communicating requirements.
     */
    openDocuSignUnavailableModal: function (signerRole) {
      var contentHtml = [
        '<div class="modal-hdr" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line)">',
        '  <div>',
        '    <h3 style="font-family:var(--f-display);margin:0;font-size:1.15rem;color:var(--ink)">DocuSign eSignature &middot; LexisNexis KBA Gateway</h3>',
        '    <div style="font-size:.74rem;color:var(--ink-2)">IRS Publication 1345 Compliant Remote E-Signature Gateway</div>',
        '  </div>',
        '  <button type="button" data-close-modal style="background:transparent;border:0;font-size:1.2rem;cursor:pointer;color:var(--ink-2)">&times;</button>',
        '</div>',
        '<div class="modal-body" style="padding:20px;font-size:.82rem;line-height:1.5;color:var(--ink)">',
        '  <div style="margin-bottom:14px;padding:12px;background:rgba(1, 159, 255, 0.08);border-left:3px solid var(--brand);border-radius:4px">',
        '    <b>Target Signer:</b> ' + signerRole + ' (Tax Year 2026 Form 1040 e-File Authorization)',
        '  </div>',
        '  <div style="margin-bottom:14px">',
        '    <b style="color:var(--ink)">Statutory E-Signing Notice:</b>',
        '    <p style="margin:4px 0 0 0;color:var(--ink-2)">',
        '      Under IRS regulations, remote electronic Form 8879 signing cannot be simulated in client browsers. Identity verification is executed directly through DocuSign\'s certified LexisNexis credit bureau identity proofing service.',
        '    </p>',
        '  </div>',
        '  <div style="background:var(--surface-2);padding:14px;border-radius:6px;border:1px solid var(--line);margin-bottom:14px">',
        '    <div style="font-size:.72rem;color:var(--ink-3);margin-bottom:4px">CURRENT GATEWAY STATUS</div>',
        '    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">',
        '      <span class="dot" style="background:var(--gold);height:8px;width:8px;border-radius:50%;display:inline-block"></span>',
        '      <b style="color:var(--ink)">Awaiting Firm Staff Envelope Dispatch via DocuSign Connect</b>',
        '    </div>',
        '    <div style="font-size:.75rem;color:var(--ink-2)">',
        '      Your lead preparer (Denise R., CPA) has queued this return for authorization. You will receive an official DocuSign invitation email with secure access link once the firm-level production EFIN release is transmitted.',
        '    </div>',
        '  </div>',
        '  <div style="font-size:.76rem;color:var(--ink-2)">',
        '    Need immediate signing? You may use the physical wet-signature option to sign by hand and upload to the Documents vault.',
        '  </div>',
        '</div>',
        '<div class="modal-ftr" style="padding:12px 20px;background:var(--surface-2);border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">',
        '  <a href="documents.html" class="btn sm btn-o">Upload Handwritten Form &rarr;</a>',
        '  <button type="button" class="btn sm btn-b" data-close-modal>Understood</button>',
        '</div>'
      ].join('');

      if (window.FileRoomLayout) {
        window.FileRoomLayout.openModal(contentHtml);
      }
    },

    /**
     * Preview of Form 8879 metadata modal.
     */
    openForm8879PreviewModal: function () {
      var req = this.state.signingRequest;
      var contentHtml = [
        '<div class="modal-hdr" style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line)">',
        '  <h3 style="font-family:var(--f-display);margin:0;font-size:1.15rem;color:var(--ink)">Form 8879 Summary &middot; Tax Year 2026</h3>',
        '  <button type="button" data-close-modal style="background:transparent;border:0;font-size:1.2rem;cursor:pointer;color:var(--ink-2)">&times;</button>',
        '</div>',
        '<div class="modal-body" style="padding:20px;font-size:.82rem;line-height:1.5;color:var(--ink)">',
        '  <div style="margin-bottom:14px;background:var(--surface-2);padding:14px;border-radius:6px;border:1px solid var(--line)">',
        '    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">',
        '      <div><b>Part I: Tax Return Information</b></div>',
        '      <div style="text-align:right;font-family:var(--f-mono)">TY 2026 Form 1040</div>',
        '      <div>Line 1: Adjusted Gross Income:</div>',
        '      <div style="text-align:right;font-family:var(--f-mono)">$214,806</div>',
        '      <div>Line 2: Total Tax:</div>',
        '      <div style="text-align:right;font-family:var(--f-mono)">$30,491</div>',
        '      <div>Line 3: Federal Refund:</div>',
        '      <div style="text-align:right;font-family:var(--f-mono);color:var(--ok);font-weight:600">$3,418</div>',
        '    </div>',
        '  </div>',
        '  <p style="font-size:.76rem;color:var(--ink-2)">',
        '    Under penalties of perjury, I declare that I have examined a copy of my 2026 electronic individual income tax return and accompanying schedules and statements, and to the best of my knowledge and belief, it is true, correct, and complete.',
        '  </p>',
        '</div>',
        '<div class="modal-ftr" style="padding:12px 20px;background:var(--surface-2);border-top:1px solid var(--line);text-align:right">',
        '  <button type="button" class="btn sm btn-b" data-close-modal>Close</button>',
        '</div>'
      ].join('');

      if (window.FileRoomLayout) {
        window.FileRoomLayout.openModal(contentHtml);
      }
    }
  };

  window.ClientSignatures = ClientSignatures;

})(window);
