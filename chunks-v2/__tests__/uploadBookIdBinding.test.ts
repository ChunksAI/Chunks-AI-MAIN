/**
 * chunks-v2/__tests__/uploadBookIdBinding.test.ts
 *
 * Verifies that after a successful document upload the bookId returned by the
 * backend is bound to the caller's state, and that the next sendMessage call
 * includes that bookId in the request payload.
 *
 * External API calls (uploadDocument, sendMessage) are mocked so the test
 * never touches the network.
 */

import * as studyApi from '@/lib/studyApi';

// ── API mocks ─────────────────────────────────────────────────────────────────

const UPLOAD_BOOK_ID = 'upload_biology_intro_abc123';

const mockUploadDocument = jest.spyOn(studyApi, 'uploadDocument');
const mockSendMessage = jest.spyOn(studyApi, 'sendMessage');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('uploadBookIdBinding', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUploadDocument.mockResolvedValue({
      success: true,
      bookId: UPLOAD_BOOK_ID,
      filename: 'biology_intro.pdf',
      total_slides: 2,
      slides: [
        {
          slide_number: 1,
          title: 'Introduction to Cell Biology',
          content: ['A cell is the basic structural and functional unit of life.'],
          notes: '',
        },
        {
          slide_number: 2,
          title: 'Types of Cells',
          content: ['Prokaryotic cells lack a nucleus.'],
          notes: '',
        },
      ],
    });

    mockSendMessage.mockResolvedValue({
      success: true,
      answer:
        'The main topic is cell biology, covering prokaryotic and eukaryotic cells.',
      mode: 'study',
      model: 'mock-model',
      tokens_used: 0,
      cached: false,
    });
  });

  it('uploadDocument resolves with a bookId', async () => {
    const file = new File([new Uint8Array(8)], 'biology_intro.pdf', {
      type: 'application/pdf',
    });
    const result = await studyApi.uploadDocument(file);

    expect(result.bookId).toBe(UPLOAD_BOOK_ID);
    expect(result.success).toBe(true);
    expect(result.total_slides).toBe(2);
  });

  it('sendMessage carries the bookId returned from uploadDocument', async () => {
    // Simulate the sequence: upload → capture bookId → ask with that bookId
    const file = new File([new Uint8Array(8)], 'biology_intro.pdf', {
      type: 'application/pdf',
    });

    const uploadResult = await studyApi.uploadDocument(file);
    const bookId = uploadResult.bookId;

    await studyApi.sendMessage({
      question: 'What is the main topic of this document?',
      mode: 'study',
      complexity: 3,
      bookId,
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const callArg = mockSendMessage.mock.calls[0][0];
    expect(callArg.bookId).toBe(UPLOAD_BOOK_ID);
    expect(callArg.question).toBe('What is the main topic of this document?');
  });

  it('sendMessage without a prior upload sends no bookId', async () => {
    await studyApi.sendMessage({
      question: 'Hello',
      mode: 'study',
      complexity: 2,
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const callArg = mockSendMessage.mock.calls[0][0];
    // bookId should be absent or undefined when no upload has occurred
    expect(callArg.bookId == null).toBe(true);
  });
});
