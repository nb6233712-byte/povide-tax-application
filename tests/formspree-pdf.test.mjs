import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMSPREE_ENDPOINT, submitPdfToFormspree } from '../js/formspree.js';

test('Formspree PDF Transmission Service', async (t) => {
  await t.test('1. Endpoint Configuration', () => {
    assert.equal(FORMSPREE_ENDPOINT, 'https://formspree.io/f/xppqrdlv');
  });

  await t.test('2. File Validation: Requires a PDF file', async () => {
    await assert.rejects(
      async () => submitPdfToFormspree(null),
      /Please select a PDF document/
    );

    const nonPdf = {
      name: 'spreadsheet.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1024
    };
    await assert.rejects(
      async () => submitPdfToFormspree(nonPdf),
      /Invalid file format.*PDF/
    );
  });

  await t.test('3. File Validation: Enforces 10MB ceiling', async () => {
    const hugePdf = {
      name: 'large_tax_bundle.pdf',
      type: 'application/pdf',
      size: 11 * 1024 * 1024 // 11MB
    };
    await assert.rejects(
      async () => submitPdfToFormspree(hugePdf),
      /exceeds the 10 MB limit/
    );
  });

  await t.test('4. Successful AJAX submission dispatches FormData and parses response', async () => {
    const originalFetch = globalThis.fetch;
    let interceptedUrl = null;
    let interceptedOptions = null;

    globalThis.fetch = async (url, options) => {
      interceptedUrl = url;
      interceptedOptions = options;
      return {
        ok: true,
        json: async () => ({ ok: true, next: 'https://formspree.io/thanks' })
      };
    };

    try {
      const mockBlob = new Blob(['%PDF-1.4 dummy pdf content'], { type: 'application/pdf' });
      mockBlob.name = 'Form_1040_2026.pdf';

      const result = await submitPdfToFormspree(mockBlob, {
        name: 'Denise Vance',
        email: 'denise@pivot-aide.tax',
        taxYear: '2026',
        message: 'Final signed return'
      });

      assert.equal(result.success, true);
      assert.equal(interceptedUrl, 'https://formspree.io/f/xppqrdlv');
      assert.equal(interceptedOptions.method, 'POST');
      assert.equal(interceptedOptions.headers['Accept'], 'application/json');
      // Verify Content-Type is NOT manually set so browser boundary works
      assert.equal(interceptedOptions.headers['Content-Type'], undefined);
      assert.ok(interceptedOptions.body instanceof FormData);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('5. Error Handling: Formspree error responses', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => ({
      ok: false,
      json: async () => ({
        errors: [{ field: 'attachment', message: 'File could not be processed' }]
      })
    });

    try {
      const mockBlob = new Blob(['%PDF-1.4 dummy'], { type: 'application/pdf' });
      mockBlob.name = 'Form_W2.pdf';

      const result = await submitPdfToFormspree(mockBlob);
      assert.equal(result.success, false);
      assert.match(result.message, /File could not be processed/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('6. Configurable Formsphere API Key & Endpoint Resolution', async () => {
    const { getFormspreeEndpoint, setFormspreeApiKey, DEFAULT_FORMSPREE_KEY } = await import('../js/formspree.js');

    // Default endpoint
    assert.equal(getFormspreeEndpoint(), 'https://formspree.io/f/xppqrdlv');
    assert.equal(DEFAULT_FORMSPREE_KEY, 'xppqrdlv');

    // Clean key string
    assert.equal(getFormspreeEndpoint('mzzk_custom_key'), 'https://formspree.io/f/mzzk_custom_key');

    // Form ID with leading /f/
    assert.equal(getFormspreeEndpoint('/f/custom_key_99'), 'https://formspree.io/f/custom_key_99');

    // Full URL passthrough
    assert.equal(getFormspreeEndpoint('https://formspree.io/f/target123'), 'https://formspree.io/f/target123');

    // Global setter function
    const resolved = setFormspreeApiKey('formsphere_key_live');
    assert.equal(resolved, 'https://formspree.io/f/formsphere_key_live');
    assert.equal(getFormspreeEndpoint(), 'https://formspree.io/f/formsphere_key_live');

    // Reset back to default
    setFormspreeApiKey('xppqrdlv');
  });

  await t.test('7. Client-Side Email Resolution & _replyto Binding', async () => {
    const { resolveClientEmail, resolveClientName } = await import('../js/formspree.js');

    // Explicit email override
    assert.equal(resolveClientEmail('taxpayer.client@example.org'), 'taxpayer.client@example.org');

    // Mock localStorage session
    const originalStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (key) => (key === 'tfr_user_session' ? JSON.stringify({ email: 'client.session@pivot-aide.tax', name: 'Jordan Client' }) : null)
    };

    try {
      assert.equal(resolveClientEmail(), 'client.session@pivot-aide.tax');
      assert.equal(resolveClientName(), 'Jordan Client');
    } finally {
      globalThis.localStorage = originalStorage;
    }
  });

  await t.test('8. Transmits client email and custom Formsphere API key with attached PDF', async () => {
    const originalFetch = globalThis.fetch;
    let postedEndpoint = null;
    let postedFormData = null;

    globalThis.fetch = async (url, options) => {
      postedEndpoint = url;
      postedFormData = options.body;
      return {
        ok: true,
        json: async () => ({ ok: true, submissionId: 'sub_9981' })
      };
    };

    try {
      const mockBlob = new Blob(['%PDF-1.4 1040 test content'], { type: 'application/pdf' });
      mockBlob.name = 'Form_1040_Whitfield.pdf';

      const result = await submitPdfToFormspree(mockBlob, {
        apiKey: 'custom_formsphere_key_4417',
        clientEmail: 'm.whitfield@example.com',
        clientName: 'Michael Whitfield',
        taxYear: 2026,
        category: 'Form 1040 Schedule C',
        requestId: 'req_1040_2026'
      });

      assert.equal(result.success, true);
      assert.equal(postedEndpoint, 'https://formspree.io/f/custom_formsphere_key_4417');
      assert.equal(postedFormData.get('email'), 'm.whitfield@example.com');
      assert.equal(postedFormData.get('_replyto'), 'm.whitfield@example.com');
      assert.equal(postedFormData.get('name'), 'Michael Whitfield');
      assert.equal(postedFormData.get('taxYear'), '2026');
      assert.equal(postedFormData.get('category'), 'Form 1040 Schedule C');
      assert.equal(postedFormData.get('requestId'), 'req_1040_2026');
      assert.ok(postedFormData.get('attachment') !== null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
